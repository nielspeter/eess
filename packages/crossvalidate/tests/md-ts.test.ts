import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve, adrCitationStats } from '../src/md-ts.js'
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
// pin what the grammar cost the gate, one failure direction each.
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

// Bug 0105. Modifier forms are a callee concern, not a delimiter one, so they
// get their own block. Each test pins its own citation count first: review
// showed that misspelling `## Enforcement` in a fixture ADR made the bare
// `not.toThrow()` versions pass while checking nothing.
describe('adrCitationsResolve() — which callee shapes count as a test', () => {
  const citations = (doc: string) => adrCitationStats(c([doc]), { dir: 'docs/adr/**' }).citations

  it('resolves citations to tests written in modifier form (bug 0105)', () => {
    // `it.skip` is named `'it.skip'` by eess-ts, and the callee guard compared
    // the full name — so a skipped test, the honest record of a known gap, was
    // dropped before its title was read and its ADR row went red.
    expect(citations('docs/adr/0006-modifiers.md')).toBe(4)
    expect(() => adrCitationsResolve(c(['docs/adr/0006-modifiers.md']), proj())).not.toThrow()
  })

  it('resolves a citation itself written as it.skip(…) — the form the ADR side already allowed', () => {
    expect(citations('docs/adr/0007-cited-in-modifier-form.md')).toBe(1)
    expect(() =>
      adrCitationsResolve(c(['docs/adr/0007-cited-in-modifier-form.md']), proj()),
    ).not.toThrow()
  })

  it('refuses a templated title, a conditional modifier, a suite, and the test alias', () => {
    // The containment half. The `test(…)` row is the load-bearing one: md↔ts
    // takes `it` only while gherkin↔ts takes `it` and `test`, and until this row
    // existed, making them agree was a silently-green change.
    expect(citations('docs/adr/0008-not-tests.md')).toBe(4)
    const violations = violationsOf(() =>
      adrCitationsResolve(c(['docs/adr/0008-not-tests.md']), proj()),
    )
    expect(violations).toHaveLength(4)
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/a templated guarantee %s.*no matching test/),
        expect.stringMatching(/a conditionally skipped guarantee.*no matching test/),
        expect.stringMatching(/a suite that is not a test.*no matching test/),
        expect.stringMatching(/an alias-defined guarantee.*no matching test/),
      ]),
    )
  })
})
