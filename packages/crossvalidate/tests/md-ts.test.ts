import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve } from '../src/md-ts.js'
import { citedItTitles } from '../src/it-title.js'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/citations')
const proj = () => project(join(root, 'tsconfig.json'))
// A project holding exactly one test — see fixtures/citations/orphan.
const orphanProj = () => project(join(root, 'orphan/tsconfig.json'))
const c = (roots: string[]) => corpus({ roots, cwd: root })

const violationsOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

describe('adrCitationsResolve() — MD↔TS (AST-grounded)', () => {
  it('passes when a cited it() actually exists in the project', () => {
    expect(() => adrCitationsResolve(c(['docs/adr/0001-good.md']), proj())).not.toThrow()
  })

  it('fails when a cited it() does not exist', () => {
    let err: unknown
    try {
      adrCitationsResolve(c(['docs/adr/0002-bad.md']), proj())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/it\('missing'\).*no matching test/)
  })
})

// Bug 0104 end to end. The unit tests in it-title.test.ts pin the grammar; these
// two pin what the grammar cost the gate, one failure direction each.
describe('adrCitationsResolve() — a title ends at the delimiter that opened it', () => {
  it('resolves a citation whose title contains a backtick to the one test it names', () => {
    // Two tests are identical up to their first backtick. Truncating there keyed
    // both on `catches `, so this citation matched two tests and was reported
    // ambiguous — naming `it('catches ')`, a string in neither the ADR nor the
    // project. It names exactly one test and must resolve. (false red)
    expect(() => adrCitationsResolve(c(['docs/adr/0003-backticked.md']), proj())).not.toThrow()
  })

  it('does not resolve a citation against a different test that shares its truncated prefix', () => {
    // The serious direction. `it('catches `GONE` in a deleted test')` exists
    // nowhere; the orphan project holds one surviving test that truncates to the
    // same `catches ` key. This passed. (false green)
    const violations = violationsOf(() =>
      adrCitationsResolve(c(['docs/adr/0005-renamed.md']), orphanProj()),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toMatch(/catches `GONE` in a deleted test.*no matching test/)
  })

  it('round-trips titles delimited by ", ` and one holding an escaped quote', () => {
    // Its own denominator: `not.toThrow()` is trivially true if the ADR side
    // extracted nothing at all, so pin the citation count first.
    const adr = readFileSync(join(root, 'docs/adr/0004-delimiters.md'), 'utf8')
    expect(citedItTitles(adr)).toHaveLength(3)
    expect(() => adrCitationsResolve(c(['docs/adr/0004-delimiters.md']), proj())).not.toThrow()
  })
})
