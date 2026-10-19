import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * ADR-022 clause 3's ratchet, per symbol. `md/rules-import-only-the-root` (arch.rules.ts) excludes
 * `honestyAtClose`'s three edges into `model/` by module, so on its own it lets `ledger.ts` take an
 * eighth symbol over an excluded edge, or an excluded module re-export another internal for it
 * (PR #246's review measured both green). This pins the seven symbols that cross today, and that
 * each is declared in the module it is imported from, not re-exported there. Plan 0498 removes the
 * label edge and plan 0504 the other two; each shrinks `DEBT` in the same change.
 */
const src = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

const DEBT: Readonly<Record<string, readonly string[]>> = {
  label: ['LABEL_HEADING', 'PLAIN_LABEL', 'labelPattern', 'wrappedLabelOf'],
  prose: ['proseText', 'unterminatedFence'],
  'task-items': ['validateMarks'],
}

/** Every `import`/`export … from '../model/<m>.js'` in the source, as module → names (sorted). */
function modelImports(source: string): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  const re =
    /^(?:import|export)\s+(?:type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\*|[\w$]+(?:\s*,\s*\{[^}]*\})?)\s+from\s+'\.\.\/model\/([^']+)\.js'/gm
  for (const m of source.matchAll(re)) {
    const [, clause = '', module = ''] = m
    const names = clause
      .replace(/[{}]/g, '')
      .split(',')
      .map((n) => n.replace(/^\s*type\s+/, '').trim())
      .filter((n) => n !== '')
    found[module] = [...(found[module] ?? []), ...names].sort()
  }
  return found
}

describe('ADR-022: honestyAtClose imports exactly its seven model symbols', () => {
  it('ledger.ts takes exactly the pinned symbols from model/', () => {
    const ledger = readFileSync(join(src, 'rules', 'ledger.ts'), 'utf8')
    const pinned = Object.fromEntries(Object.entries(DEBT).map(([m, n]) => [m, [...n].sort()]))
    expect(modelImports(ledger)).toEqual(pinned)
  })

  it('no other module under rules/ imports from model/', () => {
    const adr = readFileSync(join(src, 'rules', 'adr.ts'), 'utf8')
    expect(modelImports(adr)).toEqual({})
  })

  it('each pinned symbol is declared in its module, not re-exported there', () => {
    for (const [module, names] of Object.entries(DEBT)) {
      const source = readFileSync(join(src, 'model', `${module}.ts`), 'utf8')
      for (const name of names) {
        const declared = new RegExp(`^export (?:const|function|let|class) ${name}\\b`, 'm')
        expect(declared.test(source), `${name} in model/${module}.ts`).toBe(true)
      }
    }
  })
})
