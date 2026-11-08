#!/usr/bin/env node
/**
 * The instrument behind proposal 021's rewrite (2026-11-08): how this repository's code pointers
 * name the code they cite, and what a check of that name would say. A measurement, not a gate: it
 * prints counts and, with `--sample <n> --seed <s>`, a seeded sample as TSV for a judge.
 *
 * It reads the corpus `check:corpus` reads (same roots and frozen globs) through eess-md's own
 * `pointers()`, so a pointer here is a pointer there. A pointer is paired with a name in one of
 * three forms, each counted on its own:
 *
 *   before  `name` (`path:line`)  or  `name` at `path:line`: a backticked identifier ending at most
 *           12 characters before the pointer's code span
 *   inside  `path:line name`: an identifier after the pointer inside the same code span (bug 0215)
 *   after   `path:line` `name`: a backticked identifier starting at most 12 characters after it
 *
 * A name is an identifier, a trailing `()` and a leading `.` dropped, the last segment of a dotted
 * name kept. The cited file is resolved by path suffix against `git ls-files`, as `resolve()` does;
 * a pointer that does not resolve to one file is counted and left out. For each pair it records
 * whether the cited line or range holds the name as a whole token (never a substring), whether the
 * file does, and, for a TypeScript or JavaScript target, from the AST: every declaration of the
 * name and its span, whether the cited lines fall inside one, and what each occurrence on the cited
 * lines is (declaration, import or re-export, other use, or text only: a comment or a string).
 *
 * Run: node scripts/measure-code-reference-names.mjs [--sample 30 --seed 20261108 --pool holders|misses] [--json]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Project, Node, SyntaxKind } from 'ts-morph'
import { corpus, pointers } from '../packages/md/dist/index.js'

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const ROOTS = ['work/**', 'adr/**', 'docs/**']
const FROZEN = [
  '**/completed/**',
  '**/wont-do/**',
  '**/fixed/**',
  '**/archived/**',
  'work/spikes/**',
]
const AST_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const SAMPLE = Number(flag('--sample') ?? 0)
const SEED = Number(flag('--seed') ?? 20261108)

const started = Date.now()
const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
const resolvePath = (p) => {
  const clean = p.replace(/^\.\//, '')
  const hits = files.filter((f) => f === clean || f.endsWith('/' + clean))
  return hits.length === 1 ? hits[0] : hits.length === 0 ? 'none' : 'ambiguous'
}

/** `name()` → `name`, `.name` → `name`, `a.b.c` → `c`; undefined when it is not an identifier. */
function cleanName(raw) {
  const s = raw.trim().replace(/\(\)$/, '').replace(/^\./, '')
  const last = s.split('.').pop() ?? ''
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(last) && last.length >= 2 ? last : undefined
}

const tokenIn = (text, name) => text.split(/[^A-Za-z0-9_$]+/).includes(name)

/** The code span (backtick to backtick) holding offset `at` in `text`, or undefined. */
function spanAround(text, at) {
  const open = text.lastIndexOf('`', at)
  const close = text.indexOf('`', at)
  if (open === -1 || close === -1) return undefined
  return { start: open, end: close + 1, inner: text.slice(open + 1, close) }
}

const c = corpus({
  cwd: ROOT,
  roots: ROOTS,
  frozen: FROZEN,
  expectEmptyFrozen: ['**/wont-do/**', '**/archived/**'],
})
const all = pointers(c).select({ label: 'pointer', identify: (p) => ({ name: p.raw }) }).elements

const pairs = []
const unpairedByExt = {}
for (const p of all) {
  const text = p.doc.text
  const span = spanAround(text, p.pathStart)
  if (span === undefined) continue
  const found = []
  // before: a backticked identifier ending ≤12 chars before the span
  const head = text.slice(Math.max(0, span.start - 80), span.start)
  const mb = /`([^`\n]{2,80})`([^`\n]{0,12})$/.exec(head)
  if (mb) {
    const n = cleanName(mb[1])
    if (n) found.push({ form: 'before', name: n })
  }
  // inside: an identifier after the pointer within the same code span
  const afterRaw = span.inner.slice(span.inner.indexOf(p.raw) + p.raw.length)
  const mi = /^\s+([A-Za-z_$.][A-Za-z0-9_$.]*(?:\(\))?)\s*$/.exec(afterRaw)
  if (mi) {
    const n = cleanName(mi[1])
    if (n) found.push({ form: 'inside', name: n })
  }
  // after: a backticked identifier starting ≤12 chars after the span
  const tail = text.slice(span.end, span.end + 100)
  const ma = /^([^`\n]{0,12})`([^`\n]{2,80})`/.exec(tail)
  if (ma) {
    const n = cleanName(ma[2])
    if (n) found.push({ form: 'after', name: n })
  }
  const ext = (p.path.match(/\.[a-z0-9]+$/i) ?? ['(none)'])[0]
  if (found.length === 0) {
    unpairedByExt[ext] = (unpairedByExt[ext] ?? 0) + 1
    continue
  }
  for (const f of found) pairs.push({ p, ...f, ext })
}

const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } })
const astCache = new Map()
const DECL = (n) =>
  Node.isFunctionDeclaration(n) ||
  Node.isClassDeclaration(n) ||
  Node.isInterfaceDeclaration(n) ||
  Node.isTypeAliasDeclaration(n) ||
  Node.isEnumDeclaration(n) ||
  Node.isVariableDeclaration(n) ||
  Node.isMethodDeclaration(n) ||
  Node.isMethodSignature(n) ||
  Node.isPropertyDeclaration(n) ||
  Node.isPropertySignature(n) ||
  Node.isPropertyAssignment(n) ||
  Node.isGetAccessorDeclaration(n) ||
  Node.isSetAccessorDeclaration(n) ||
  Node.isModuleDeclaration(n) ||
  Node.isEnumMember(n)

/** Per file: name → { decls: [{start,end,nameLine}], occ: Map<line, Set<kind>> }. */
function astOf(rel) {
  if (astCache.has(rel)) return astCache.get(rel)
  const sf = project.createSourceFile(
    '/' + rel.replace(/\.(mjs|cjs)$/, '.js'),
    readFileSync(join(ROOT, rel), 'utf8'),
    {
      overwrite: true,
    },
  )
  const index = new Map()
  const entry = (n) => {
    if (!index.has(n)) index.set(n, { decls: [], occ: new Map() })
    return index.get(n)
  }
  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.Identifier && node.getKind() !== SyntaxKind.PrivateIdentifier)
      return
    const name = node.getText()
    const line = node.getStartLineNumber()
    const parent = node.getParent()
    let kind = 'use'
    if (parent && DECL(parent) && parent.getNameNode?.() === node) {
      kind = 'declaration'
      const owner = Node.isVariableDeclaration(parent)
        ? (parent.getVariableStatement() ?? parent)
        : parent
      entry(name).decls.push({
        start: owner.getStartLineNumber(),
        end: owner.getEndLineNumber(),
        nameLine: line,
      })
    } else if (
      parent &&
      (Node.isImportSpecifier(parent) ||
        Node.isImportClause(parent) ||
        Node.isNamespaceImport(parent) ||
        Node.isExportSpecifier(parent) ||
        Node.isImportEqualsDeclaration(parent))
    ) {
      kind = 'import'
    }
    const e = entry(name)
    if (!e.occ.has(line)) e.occ.set(line, new Set())
    e.occ.get(line).add(kind)
  })
  astCache.set(rel, index)
  return index
}

const rows = []
const unresolved = { none: 0, ambiguous: 0, pastEnd: 0 }
for (const { p, form, name, ext } of pairs) {
  const rel = resolvePath(p.path)
  if (rel === 'none' || rel === 'ambiguous') {
    unresolved[rel]++
    continue
  }
  const lines = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  if (p.endLine > lines.length) {
    unresolved.pastEnd++
    continue
  }
  const cited = lines.slice(p.startLine - 1, p.endLine)
  const lineHolds = cited.some((l) => tokenIn(l, name))
  const fileHolds = lines.some((l) => tokenIn(l, name))
  const row = {
    form,
    name,
    live: !p.doc.frozen,
    doc: `${p.doc.relPath}:${String(p.line)}`,
    pointer: p.raw,
    file: rel,
    ext,
    range: p.endLine > p.startLine,
    lineHolds,
    fileHolds,
    ast: false,
  }
  if (AST_EXT.test(rel)) {
    try {
      const e = astOf(rel).get(name)
      row.ast = true
      row.decls = e ? e.decls.length : 0
      row.declLines = e ? e.decls.map((d) => d.nameLine) : []
      row.inDeclSpan = e ? e.decls.some((d) => d.start <= p.startLine && p.endLine <= d.end) : false
      row.onDeclLine = e
        ? e.decls.some((d) => d.nameLine >= p.startLine && d.nameLine <= p.endLine)
        : false
      const kinds = new Set()
      if (e)
        for (let l = p.startLine; l <= p.endLine; l++)
          for (const k of e.occ.get(l) ?? []) kinds.add(k)
      if (lineHolds && kinds.size === 0) kinds.add('text-only')
      row.kinds = [...kinds].sort()
    } catch {
      row.ast = false
    }
  }
  rows.push(row)
}

const count = (f) => rows.filter(f).length
const by = (pred) => ({
  total: count(pred),
  live: count((r) => pred(r) && r.live),
  frozen: count((r) => pred(r) && !r.live),
})
const holdKind = (r, k) => r.lineHolds && r.kinds?.includes(k)
const summary = {
  pointers: all.length,
  pointersLive: all.filter((p) => !p.doc.frozen).length,
  paired: pairs.length,
  byForm: Object.fromEntries(
    ['before', 'inside', 'after'].map((f) => [f, count((r) => r.form === f)]),
  ),
  unresolved,
  resolvedPairs: by(() => true),
  lineHolds: by((r) => r.lineHolds),
  lineMisses: by((r) => !r.lineHolds),
  fileHoldsWhenLineMisses: by((r) => !r.lineHolds && r.fileHolds),
  ast: {
    pairs: count((r) => r.ast),
    holdsOnDeclarationLine: count((r) => r.ast && r.lineHolds && r.onDeclLine),
    holdsButNotDeclaration: count((r) => r.ast && r.lineHolds && !r.onDeclLine),
    holdKinds: {
      import: count((r) => r.ast && holdKind(r, 'import') && !r.onDeclLine),
      use: count((r) => r.ast && holdKind(r, 'use') && !r.onDeclLine && !holdKind(r, 'import')),
      textOnly: count((r) => r.ast && holdKind(r, 'text-only')),
    },
    missesInsideTheNamedDeclarationSpan: count((r) => r.ast && !r.lineHolds && r.inDeclSpan),
    missesDeclaredElsewhereOnce: count(
      (r) => r.ast && !r.lineHolds && !r.inDeclSpan && r.decls === 1,
    ),
    missesDeclaredMoreThanOnce: count((r) => r.ast && !r.lineHolds && !r.inDeclSpan && r.decls > 1),
    missesNotDeclaredInFile: count((r) => r.ast && !r.lineHolds && r.decls === 0),
    namesDeclaredMoreThanOnceInFile: count((r) => r.ast && r.decls > 1),
  },
  unpairedPointersByExtension: unpairedByExt,
  ms: Date.now() - started,
}

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify({ summary, rows }, null, 2) + '\n')
} else {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
}

if (SAMPLE > 0) {
  // Mulberry32, seeded: the same seed draws the same rows.
  let a = SEED
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // --pool holders (the cited line holds the name) or misses (it does not, and the name is declared
  // exactly once elsewhere in the file: drifted, or citing a neighbour?).
  const which = flag('--pool') ?? 'holders'
  const pool =
    which === 'misses'
      ? rows.filter((r) => !r.lineHolds && r.ast && !r.inDeclSpan && r.decls === 1)
      : rows.filter((r) => r.lineHolds)
  const drawn = []
  const left = [...pool]
  while (drawn.length < Math.min(SAMPLE, pool.length))
    drawn.push(left.splice(Math.floor(rand() * left.length), 1)[0])
  process.stderr.write('id\tdoc\tname\tpointer\tfile\tkinds\tonDeclLine\tdeclLines\tlive\n')
  drawn.forEach((r, i) =>
    process.stderr.write(
      `${which === 'misses' ? 'm' : 'h'}${String(i + 1).padStart(2, '0')}\t${r.doc}\t${r.name}\t${r.pointer}\t${r.file}\t${(r.kinds ?? ['n/a']).join(',')}\t${String(r.onDeclLine ?? 'n/a')}\t${(r.declLines ?? []).join(',')}\t${String(r.live)}\n`,
    ),
  )
}
