#!/usr/bin/env node
/**
 * Spike 0658: which engine does each part of eess-ts need?
 *
 * A census, not a build. It loads `packages/ts` with ts-morph and, for every callable the package
 * publishes (each exported function and constant, and each public method of an exported class),
 * follows the references it makes inside `packages/ts/src` and collects the ts-morph members it can
 * reach. Each member falls into one of four classes:
 *
 *   syntax      the tree alone answers it (`getName`, `getParameters`, `Node.isClassDeclaration`)
 *   binding     a name is resolved to its declaration (`getSymbol`, `getExportedDeclarations`)
 *   types       the type checker computes a type (`getType`, `Type.isUnion`, `Type.getText`)
 *   references  the language service searches the project (`findReferencesAsNodes`)
 *
 * It then reads the four dogfood rule files and reports the same classes per rule.
 *
 * The walk over-approximates: a reference to a function counts as a call of it, an interface
 * member reaches every implementation of it, and a method name in a rule file reaches every
 * method of that name. It under-approximates in one place: a call made through an interface
 * declared outside `packages/ts/src` (the kernel's `Condition.evaluate`) is followed only
 * lexically, from the function that built the object.
 *
 * Run: node scripts/measure-engine-needs.mjs [--json] [--why <name>]
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Node, Project, SyntaxKind } from 'ts-morph'

const ROOT = join(import.meta.dirname, '..')
const PKG = join(ROOT, 'packages/ts')
const SRC = join(PKG, 'src') + '/'
const args = process.argv.slice(2)
const json = args.includes('--json')
const why = args.includes('--why') ? args[args.indexOf('--why') + 1] : undefined
const RULE_FILES = ['arch.rules.ts', 'arch.internal.rules.ts', 'family.rules.ts', 'spec.rules.ts']

const started = performance.now()
const proj = new Project({ tsConfigFilePath: join(PKG, 'tsconfig.build.json') })
const inSrc = (node) => node.getSourceFile().getFilePath().startsWith(SRC)
const inMorph = (node) => {
  const fp = node.getSourceFile().getFilePath()
  return fp.includes('/node_modules/ts-morph/') || fp.includes('/node_modules/@ts-morph/common/')
}
const at = (node) =>
  `${relative(ROOT, node.getSourceFile().getFilePath())}:${String(node.getStartLineNumber())}`

// --- The four classes. -------------------------------------------------------------------------
const TYPE_OWNERS = new Set(['Type', 'TypeChecker', 'Signature'])
const TYPE_NAMES = new Set([
  'getType',
  'getReturnType',
  'getTypeAtLocation',
  'getApparentType',
  'getContextualType',
  'getBaseTypes',
  'getSignature',
  'getCallSignatures',
])
const REFERENCE_NAMES = new Set([
  'findReferencesAsNodes',
  'findReferences',
  'getDerivedClasses',
  'getImplementations',
  'getLanguageService',
])
const BINDING_NAMES = new Set([
  'getSymbol',
  'getSymbolOrThrow',
  'getExportedDeclarations',
  'getModuleSpecifierSourceFile',
  'getModuleSpecifierSourceFileOrThrow',
  'getDefinitionNodes',
  'getDefinitions',
  'getBaseClass',
  'getBaseClassOrThrow',
  'getDefaultExportSymbol',
  'getExportSymbols',
  'getReferencedSourceFiles',
  'getSymbolsInScope',
])
function classOf(owner, name) {
  if (TYPE_NAMES.has(name) || TYPE_OWNERS.has(owner)) return 'types'
  if (REFERENCE_NAMES.has(name) || owner === 'LanguageService') return 'references'
  if (BINDING_NAMES.has(name) || owner === 'Symbol') return 'binding'
  return 'syntax'
}

// --- Units: the pieces of code a reference can reach. ------------------------------------------
const MEMBER_KINDS = new Set([
  SyntaxKind.MethodDeclaration,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
  SyntaxKind.Constructor,
  SyntaxKind.PropertyDeclaration,
  SyntaxKind.PropertyAssignment,
  SyntaxKind.ShorthandPropertyAssignment,
])
const hasBody = (node) =>
  !(Node.isBodyable(node) || Node.isBodied(node)) ||
  (Node.isBodyable(node) ? node.getBody() !== undefined : true)

/** Members reached through an interface or an abstract method: implementations, found once. */
const detached = new Set()
const implementations = new Map()
function implementationsOf(decl) {
  const cached = implementations.get(decl)
  if (cached !== undefined) return cached
  const found = []
  const name = Node.hasName(decl) || Node.isPropertyNamed(decl) ? decl.getNameNode() : undefined
  if (name !== undefined && Node.isIdentifier(name)) {
    let locations = []
    try {
      locations = name.getImplementations()
    } catch {
      locations = [] // an implementation search the language service refuses reaches nothing
    }
    for (const location of locations) {
      const member = location.getNode().getParent()
      if (member !== undefined && MEMBER_KINDS.has(member.getKind()) && inSrc(member)) {
        if (member !== decl && hasBody(member)) found.push(member)
      }
    }
  }
  implementations.set(decl, found)
  return found
}
const isAbstract = (node) =>
  (Node.isMethodDeclaration(node) || Node.isPropertyDeclaration(node)) &&
  (node.isAbstract() || !hasBody(node))
const isSignature = (node) => Node.isPropertySignature(node) || Node.isMethodSignature(node)

let signatures = 0
for (const sf of proj.getSourceFiles()) {
  if (!sf.getFilePath().startsWith(SRC)) continue
  sf.forEachDescendant((node) => {
    if (isSignature(node) || isAbstract(node)) {
      signatures += 1
      for (const member of implementationsOf(node)) detached.add(member)
    }
  })
}

/** The units a declaration stands for. Empty for a type, a parameter or a local. */
function unitsOf(decl) {
  if (!inSrc(decl)) return []
  if (isSignature(decl) || isAbstract(decl)) return implementationsOf(decl)
  if (Node.isFunctionDeclaration(decl)) {
    const impl = decl.getImplementation() ?? decl
    return impl.getBody() === undefined ? [] : [impl]
  }
  if (Node.isVariableDeclaration(decl)) {
    const statement = decl.getVariableStatement()
    return statement !== undefined && Node.isSourceFile(statement.getParent()) ? [decl] : []
  }
  if (Node.isClassDeclaration(decl)) {
    return [...decl.getConstructors(), ...decl.getProperties().filter((p) => p.hasInitializer())]
  }
  return MEMBER_KINDS.has(decl.getKind()) ? [decl] : []
}

// --- One scan per unit: the members it touches and the units it references. --------------------
const scans = new Map()
const memberUse = new Map()
function scan(unit) {
  const cached = scans.get(unit)
  if (cached !== undefined) return cached
  const result = { members: new Map(), edges: new Set(), dispatch: new Set(), classes: new Set() }
  scans.set(unit, result)
  unit.forEachDescendant((node, traversal) => {
    if (detached.has(node)) {
      traversal.skip()
      return
    }
    if (!Node.isIdentifier(node)) return
    let symbol = node.getSymbol()
    if (symbol === undefined) return
    if (symbol.isAlias()) symbol = symbol.getAliasedSymbol() ?? symbol
    for (const decl of symbol.getDeclarations()) {
      if (inMorph(decl)) {
        const parent = decl.getParent()
        const owner = parent !== undefined && Node.hasName(parent) ? parent.getName() : '?'
        if (owner === 'SyntaxKind') continue
        const cls = classOf(owner, symbol.getName())
        const key = `${owner}.${symbol.getName()}`
        if (cls !== 'syntax' && !result.members.has(key)) result.members.set(key, cls)
        memberUse.set(key, { cls, sites: (memberUse.get(key)?.sites ?? 0) + 1 })
      } else if (inSrc(decl) && (isSignature(decl) || isAbstract(decl))) {
        for (const target of implementationsOf(decl)) result.dispatch.add(target)
      } else {
        if (Node.isClassDeclaration(decl) && inSrc(decl)) result.classes.add(decl)
        for (const target of unitsOf(decl)) if (target !== unit) result.edges.add(target)
      }
    }
  })
  return result
}

/**
 * What must be live before a dispatched member can run: the class that declares it, or the unit
 * whose body builds the object literal it sits in.
 */
const owners = new Map()
function ownerOf(member) {
  const cached = owners.get(member)
  if (cached !== undefined) return cached
  let owner = { kind: 'none' }
  for (const ancestor of member.getAncestors()) {
    if (Node.isClassDeclaration(ancestor)) {
      owner = { kind: 'class', node: ancestor }
      break
    }
    const isUnit =
      detached.has(ancestor) ||
      Node.isFunctionDeclaration(ancestor) ||
      (MEMBER_KINDS.has(ancestor.getKind()) && Node.isClassDeclaration(ancestor.getParent())) ||
      (Node.isVariableDeclaration(ancestor) && unitsOf(ancestor).length > 0)
    if (isUnit) {
      owner = { kind: 'unit', node: ancestor }
      break
    }
  }
  owners.set(member, owner)
  return owner
}

/**
 * Every class a root can reach, with the first path to each for `--why`. A member called through
 * an interface is followed only once its owner is live (rapid type analysis), so one matcher's
 * needs do not pass to every rule that runs a matcher.
 */
function needsOf(roots, classes = []) {
  const needs = new Map()
  const seen = new Set(roots)
  const live = new Set(classes)
  const pending = new Map()
  const queue = roots.map((unit) => ({ unit, path: [unit] }))
  const isLive = (owner) =>
    owner.kind === 'none' || (owner.kind === 'class' ? live.has(owner.node) : seen.has(owner.node))
  while (queue.length > 0) {
    while (queue.length > 0) {
      const { unit, path } = queue.shift()
      const { members, edges, dispatch, classes: built } = scan(unit)
      for (const [key, cls] of members) {
        if (!needs.has(cls)) needs.set(cls, { member: key, path })
      }
      for (const cls of built) {
        for (let c = cls; c !== undefined && inSrc(c); c = c.getBaseClass()) live.add(c)
      }
      for (const next of edges) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push({ unit: next, path: [...path, next] })
      }
      for (const next of dispatch) {
        if (!seen.has(next) && !pending.has(next)) pending.set(next, [...path, next])
      }
    }
    for (const [member, path] of pending) {
      if (seen.has(member) || !isLive(ownerOf(member))) continue
      pending.delete(member)
      seen.add(member)
      queue.push({ unit: member, path })
    }
  }
  return needs
}

// --- Roots: what the package publishes. --------------------------------------------------------
const manifest = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
const entries = Object.entries(manifest.exports)
  .map(([subpath, target]) => [subpath, typeof target === 'string' ? target : target.import])
  .filter(([subpath, target]) => typeof target === 'string' && subpath !== './cli')
  .map(([subpath, target]) => [subpath, target.replace('./dist/', 'src/').replace(/\.js$/, '.ts')])

const roots = new Map()
const byName = new Map()
const remember = (name, root) => byName.set(name, [...(byName.get(name) ?? []), root])
for (const [subpath, file] of entries) {
  const sf = proj.getSourceFile(join(PKG, file))
  if (sf === undefined) continue
  for (const [name, decls] of sf.getExportedDeclarations()) {
    for (const decl of decls) {
      if (!inSrc(decl)) continue
      if (Node.isClassDeclaration(decl)) {
        for (let cls = decl; cls !== undefined && inSrc(cls); cls = cls.getBaseClass()) {
          for (const method of cls.getMethods()) {
            if (method.getScope() !== 'public' || method.isStatic()) continue
            const units = unitsOf(method)
            if (units.length === 0) continue
            const id = `${name}#${method.getName()}`
            if (roots.has(id)) continue
            const root = { id, kind: 'method', subpath, decl: method, units, classes: [decl] }
            roots.set(id, root)
            remember(method.getName(), root)
          }
        }
      }
      const units = unitsOf(decl)
      if (units.length === 0 || roots.has(name)) continue
      const root = { id: name, kind: 'export', subpath, decl, units, classes: [] }
      roots.set(name, root)
      remember(name, root)
    }
  }
}

const ORDER = ['syntax', 'binding', 'types', 'references']
const label = (needs) => ORDER.filter((cls) => needs.has(cls))
for (const root of roots.values()) root.needs = needsOf(root.units, root.classes)

// --- The dogfood rules. ------------------------------------------------------------------------
const TERMINALS = new Set(['rule', 'check', 'warn'])
const dogfood = []
for (const file of RULE_FILES) {
  const sf = proj.addSourceFileAtPath(join(ROOT, file))
  const locals = new Map()
  for (const statement of sf.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) locals.set(decl.getName(), decl)
  }
  for (const fn of sf.getFunctions()) {
    const name = fn.getName()
    if (name !== undefined) locals.set(name, fn)
  }
  const namesIn = (node, seen = new Set(), out = new Set()) => {
    for (const id of node.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const name = id.getText()
      out.add(name)
      const local = locals.get(name)
      if (
        local !== undefined &&
        !seen.has(local) &&
        !local.containsRange(id.getPos(), id.getEnd())
      ) {
        seen.add(local)
        namesIn(local, seen, out)
      }
    }
    return out
  }
  const chains = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const callee = call.getExpression()
    if (!Node.isPropertyAccessExpression(callee) || !TERMINALS.has(callee.getName())) return false
    const outer = call.getParent()
    return !(Node.isPropertyAccessExpression(outer) && Node.isCallExpression(outer.getParent()))
  })
  for (const chain of chains) {
    const idMatch = /\bid:\s*'([^']+)'/.exec(chain.getText())
    const units = []
    const classes = []
    for (const name of namesIn(chain)) {
      for (const root of byName.get(name) ?? []) {
        units.push(...root.units)
        classes.push(...root.classes)
      }
    }
    dogfood.push({
      file,
      line: chain.getStartLineNumber(),
      id: idMatch?.[1] ?? `${file}:${String(chain.getStartLineNumber())}`,
      needs: needsOf([...new Set(units)], classes),
    })
  }
}

// --- Report. -----------------------------------------------------------------------------------
const elapsed = ((performance.now() - started) / 1000).toFixed(1)
const tally = (items) => {
  const out = { total: items.length, syntaxOnly: 0, binding: 0, types: 0, references: 0 }
  for (const item of items) {
    const classes = label(item.needs)
    if (classes.length === 0) out.syntaxOnly += 1
    for (const cls of classes) out[cls] += 1
  }
  return out
}
const areaOf = (root) => {
  const rel = relative(SRC, root.decl.getSourceFile().getFilePath())
  return rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '(root)'
}
const areas = new Map()
for (const root of roots.values()) {
  areas.set(areaOf(root), [...(areas.get(areaOf(root)) ?? []), root])
}
const sites = [...scans]
  .filter(([, result]) => result.members.size > 0)
  .map(([unit, result]) => ({ at: at(unit), members: [...result.members.keys()].sort() }))
  .sort((a, b) => (a.at < b.at ? -1 : 1))

if (json) {
  const plain = (needs) =>
    Object.fromEntries(
      [...needs].map(([cls, v]) => [cls, { member: v.member, at: at(v.path[v.path.length - 1]) }]),
    )
  console.log(
    JSON.stringify(
      {
        roots: [...roots.values()].map((r) => ({
          id: r.id,
          area: areaOf(r),
          needs: plain(r.needs),
        })),
        dogfood: dogfood.map((r) => ({ id: r.id, file: r.file, needs: plain(r.needs) })),
        sites,
      },
      null,
      2,
    ),
  )
} else {
  const row = (name, t) =>
    `${name.padEnd(34)}${String(t.total).padStart(6)}${String(t.syntaxOnly).padStart(13)}${String(t.binding).padStart(9)}${String(t.types).padStart(7)}${String(t.references).padStart(12)}`
  const head = `${''.padEnd(34)}${'total'.padStart(6)}${'syntax only'.padStart(13)}${'binding'.padStart(9)}${'types'.padStart(7)}${'references'.padStart(12)}`
  console.log(`interface and abstract members examined: ${String(signatures)}`)
  console.log(`members reached only through one of them: ${String(detached.size)}`)
  console.log(`units scanned: ${String(scans.size)}\n`)
  console.log('PUBLISHED CALLABLES, by source folder\n' + head)
  for (const [area, items] of [...areas].sort()) console.log(row(area, tally(items)))
  console.log(row('all', tally([...roots.values()])))
  console.log('\nDOGFOOD RULES, by rule file\n' + head)
  for (const file of RULE_FILES)
    console.log(row(file, tally(dogfood.filter((r) => r.file === file))))
  console.log(row('all', tally(dogfood)))
  console.log('\nDOGFOOD RULES THAT ARE NOT SYNTAX ONLY')
  for (const rule of dogfood) {
    const classes = label(rule.needs)
    if (classes.length > 0) {
      console.log(
        `  ${rule.id} — ${classes.map((cls) => `${cls} (${rule.needs.get(cls).member})`).join(', ')}`,
      )
    }
  }
  console.log('\nWHERE THE CHECKER IS TOUCHED (unit, then the members it uses)')
  for (const site of sites) console.log(`  ${site.at} — ${site.members.join(', ')}`)
  console.log('\nNON-SYNTAX MEMBERS, by class')
  for (const cls of ORDER.slice(1)) {
    const members = [...memberUse].filter(([, use]) => use.cls === cls)
    const total = members.reduce((sum, [, use]) => sum + use.sites, 0)
    console.log(`  ${cls}: ${String(members.length)} members, ${String(total)} sites`)
  }
  if (why !== undefined) {
    for (const rule of dogfood.filter((r) => r.id === why)) {
      console.log(`\nWHY rule ${rule.id}`)
      for (const [cls, { member, path }] of rule.needs) {
        console.log(`  ${cls}: ${member}\n    ${path.map(at).join('\n    -> ')}`)
      }
    }
    for (const root of byName.get(why) ?? []) {
      console.log(`\nWHY ${root.id}`)
      for (const [cls, { member, path }] of root.needs) {
        console.log(`  ${cls}: ${member}\n    ${path.map(at).join('\n    -> ')}`)
      }
    }
  }
  console.log(
    `\n${String(roots.size)} published callables, ${String(dogfood.length)} dogfood rules (${elapsed}s)`,
  )
}
