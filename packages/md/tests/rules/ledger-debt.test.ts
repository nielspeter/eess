import { describe, it, expect } from 'vitest'
import { basename, dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Node, Project, SyntaxKind, type SourceFile } from 'ts-morph'

/**
 * ADR-022 clause 3's ratchet, per symbol. `md/rules-import-only-the-root` (arch.rules.ts) excludes
 * `honestyAtClose`'s three edges into `model/` by module, so on its own it lets `ledger.ts` take an
 * eighth symbol over an excluded edge, or an excluded module re-export another internal for it
 * (PR #246's review measured both green). This pins the seven symbols that cross today, and that
 * each is declared in the module it is imported from, not re-exported there. Plan 0498 removes the
 * label edge and plan 0504 the other two; each shrinks `DEBT` in the same change.
 *
 * The edges are read with ts-morph (ADR-002) and keyed on the file each one resolves to, as the arch
 * rule resolves them, not on how the specifier is spelled: `./../model/label.js`,
 * `../rules/../model/label.js`, an absolute path, and an import after a block comment are all the
 * label edge (PR #246's review found each of those passing a match on source text). Imports,
 * re-exports and dynamic imports of a literal are read; a dynamic import of a computed string is
 * not, as no eess-ts edge rule reads it either.
 */
const pkg = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const rules = join(pkg, 'src', 'rules')
const model = join(pkg, 'src', 'model')

const DEBT: Readonly<Record<string, readonly string[]>> = {
  label: ['LABEL_HEADING', 'PLAIN_LABEL', 'labelPattern', 'wrappedLabelOf'],
  prose: ['proseText', 'unterminatedFence'],
  'task-items': ['validateMarks'],
}

const project = new Project({
  tsConfigFilePath: join(pkg, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
})

/** The `model/` module a resolved file is, or undefined when it is anywhere else. */
function modelModule(target: SourceFile | undefined): string | undefined {
  const path = target?.getFilePath()
  if (path === undefined || dirname(path) !== model.replaceAll('\\', '/')) return undefined
  return basename(path).replace(/\.ts$/, '')
}

/** Every edge of the file into a `model/` module, as module → names (sorted). */
function modelImports(sf: SourceFile): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  const add = (target: SourceFile | undefined, names: readonly string[]): void => {
    const module = modelModule(target)
    if (module === undefined) return
    found[module] = [...(found[module] ?? []), ...names].sort()
  }
  for (const d of sf.getImportDeclarations()) {
    const names = [
      ...d.getNamedImports().map((n) => n.getName()),
      ...(d.getDefaultImport() === undefined ? [] : ['default']),
      ...(d.getNamespaceImport() === undefined ? [] : ['*']),
    ]
    add(d.getModuleSpecifierSourceFile(), names.length > 0 ? names : ['(side effect)'])
  }
  for (const d of sf.getExportDeclarations()) {
    const named = d.getNamedExports().map((n) => n.getName())
    add(d.getModuleSpecifierSourceFile(), named.length > 0 ? named : ['*'])
  }
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue
    const [arg] = call.getArguments()
    if (arg === undefined || !Node.isStringLiteral(arg)) continue
    const declaration = arg.getSymbol()?.getDeclarations()[0]
    add(Node.isSourceFile(declaration) ? declaration : undefined, ['(dynamic)'])
  }
  return found
}

const fileIn = (name: string): SourceFile => project.addSourceFileAtPath(join(rules, name))
const textIn = (source: string): SourceFile =>
  project.createSourceFile(join(rules, '__ledger_debt_spellings__.ts'), source, { overwrite: true })

describe('ADR-022: honestyAtClose imports exactly its seven model symbols', () => {
  it('ledger.ts takes exactly the pinned symbols from model/', () => {
    const pinned = Object.fromEntries(Object.entries(DEBT).map(([m, n]) => [m, [...n].sort()]))
    expect(modelImports(fileIn('ledger.ts'))).toEqual(pinned)
  })

  it('no other module under rules/ imports from model/', () => {
    expect(modelImports(fileIn('adr.ts'))).toEqual({})
  })

  it('an edge is keyed on the file it resolves to, not on how it is spelled', () => {
    const absolute = join(model, 'label.js').replaceAll('\\', '/')
    const spellings = [
      "import { isNearMiss as b1 } from './../model/label.js'",
      "import { isNearMiss as b2 } from '../rules/../model/label.js'",
      "/* c */ import { isNearMiss as c } from '../model/label.js'",
      `import { isNearMiss as a } from '${absolute}'`,
      "import { isNearMiss as t } from '../model/label.js' // trailing",
      "import '../model/label.js'",
      "export const d = await import('../model/label.js')",
    ].join('\n')
    expect(modelImports(textIn(spellings))).toEqual({
      label: [
        '(dynamic)',
        '(side effect)',
        'isNearMiss',
        'isNearMiss',
        'isNearMiss',
        'isNearMiss',
        'isNearMiss',
      ],
    })
    expect(modelImports(textIn("import { docs } from '../index.js'"))).toEqual({})
  })

  it('each pinned symbol is declared in its module, not re-exported there', () => {
    for (const [module, names] of Object.entries(DEBT)) {
      const source = readFileSync(join(model, `${module}.ts`), 'utf8')
      for (const name of names) {
        const declared = new RegExp(`^export (?:const|function|let|class) ${name}\\b`, 'm')
        expect(declared.test(source), `${name} in model/${module}.ts`).toBe(true)
      }
    }
  })
})
