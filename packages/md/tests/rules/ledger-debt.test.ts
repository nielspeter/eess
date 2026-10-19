import { describe, it, expect } from 'vitest'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * ADR-022 clause 3's ratchet, per symbol. `md/rules-import-only-the-root` (arch.rules.ts) excludes
 * `honestyAtClose`'s three edges into `model/` by module, so on its own it lets `ledger.ts` take an
 * eighth symbol over an excluded edge, or an excluded module re-export another internal for it
 * (PR #246's review measured both green). This pins the seven symbols that cross today, and that
 * each is declared in the module it is imported from, not re-exported there. Plan 0498 removes the
 * label edge and plan 0504 the other two; each shrinks `DEBT` in the same change.
 *
 * Specifiers are resolved as paths from `src/rules/`, not matched by spelling, so
 * `'./../model/label.js'` and `'../rules/../model/label.js'` are the label edge too (PR #246's
 * verification found both passing a spelling match). Static imports, re-exports, side-effect
 * imports and dynamic imports of a literal are read; a dynamic import of a computed string is not,
 * as no eess-ts edge rule reads it either.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')
const rules = join(src, 'rules')
const model = join(src, 'model')

const DEBT: Readonly<Record<string, readonly string[]>> = {
  label: ['LABEL_HEADING', 'PLAIN_LABEL', 'labelPattern', 'wrappedLabelOf'],
  prose: ['proseText', 'unterminatedFence'],
  'task-items': ['validateMarks'],
}

/** The `model/` module a specifier written in `src/rules/` resolves to, or undefined. */
function modelModule(specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  const target = relative(model, resolve(rules, specifier))
  if (target === '' || target.startsWith('..') || target.includes(sep)) return undefined
  return target.replace(/\.(js|ts)$/, '')
}

const STATIC =
  /^(?:import|export)\s+(?:type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\*|[\w$]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/gm
const SIDE_EFFECT = /^import\s+['"]([^'"]+)['"]/gm
const DYNAMIC = /\bimport\(\s*['"`]([^'"`]+)['"`]\s*\)/g

/** Every import of a `model/` module in the source, as module → names (sorted). */
function modelImports(source: string): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  const add = (specifier: string, names: readonly string[]): void => {
    const module = modelModule(specifier)
    if (module === undefined) return
    found[module] = [...(found[module] ?? []), ...names].sort()
  }
  for (const [, clause = '', specifier = ''] of source.matchAll(STATIC)) {
    add(
      specifier,
      clause
        .replace(/[{}]/g, '')
        .split(',')
        .map((n) => n.replace(/^\s*type\s+/, '').trim())
        .filter((n) => n !== ''),
    )
  }
  for (const [, specifier = ''] of source.matchAll(SIDE_EFFECT)) add(specifier, ['(side effect)'])
  for (const [, specifier = ''] of source.matchAll(DYNAMIC)) add(specifier, ['(dynamic)'])
  return found
}

describe('ADR-022: honestyAtClose imports exactly its seven model symbols', () => {
  it('ledger.ts takes exactly the pinned symbols from model/', () => {
    const ledger = readFileSync(join(rules, 'ledger.ts'), 'utf8')
    const pinned = Object.fromEntries(Object.entries(DEBT).map(([m, n]) => [m, [...n].sort()]))
    expect(modelImports(ledger)).toEqual(pinned)
  })

  it('no other module under rules/ imports from model/', () => {
    const adr = readFileSync(join(rules, 'adr.ts'), 'utf8')
    expect(modelImports(adr)).toEqual({})
  })

  it('a specifier is resolved as a path, not matched by its spelling', () => {
    const spellings = [
      "import { isNearMiss } from './../model/label.js'",
      "import { isNearMiss } from '../rules/../model/label.js'",
      'import { isNearMiss } from "../model/./label.js"',
      "import '../model/label.js'",
      "const m = await import('../model/label.js')",
    ].join('\n')
    expect(modelImports(spellings)).toEqual({
      label: ['(dynamic)', '(side effect)', 'isNearMiss', 'isNearMiss', 'isNearMiss'],
    })
    expect(modelImports("import { docs } from '../index.js'")).toEqual({})
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
