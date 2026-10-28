import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus, docs, links, pointers } from '../src/index.js'
import { adrEnforcement } from '../src/rules/adr.js'

const fixtures = dirname(fileURLToPath(import.meta.url))
const madrRoot = join(fixtures, 'fixtures/madr')
const deutschRoot = join(fixtures, 'fixtures/deutsch')

// Acceptance B (generic fitness): a stranger with plain MADR ADRs — no
// enforcement tiers — gets real value using ONLY the generic primitives,
// never importing adrEnforcement.
describe('acceptance: plain MADR corpus (generic primitives only)', () => {
  it('validates MADR section completeness without adrEnforcement', () => {
    const c = corpus({ roots: ['adr/*.md'], cwd: madrRoot })
    const missing = docs(c)
      .that()
      .resideInFolder('adr/**')
      .should()
      .haveSection('Decision')
      .violations()
    // 0002-incomplete.md has no Decision section
    expect(missing).toHaveLength(1)
    expect(missing[0]?.element).toContain('0002-incomplete.md')
  })

  it('grounds links and code pointers in a plain corpus', () => {
    const c = corpus({ roots: ['adr/*.md'], cwd: madrRoot })
    expect(links(c).that().areInternal().should().resolve().violations()).toHaveLength(0)
    expect(pointers(c).that().areLive().should().resolve().violations()).toHaveLength(0)
  })

  it('a well-formed MADR record passes a composed generic gate', () => {
    const c = corpus({ roots: ['adr/0001-use-postgres.md'], cwd: madrRoot })
    expect(() =>
      docs(c)
        .should()
        .haveSection('Status')
        .andShould()
        .haveSection('Decision')
        .andShould()
        .haveSection('Consequences')
        .check(),
    ).not.toThrow()
  })
})

// Acceptance A flavor (localization is config, not fork): the same
// adrEnforcement preset validates a German ADR via header/section patterns.
describe('acceptance: localized (German) ADR via adrEnforcement config', () => {
  it('validates a Durchsetzung / Umsetzung table with config, no fork', () => {
    const c = corpus({ roots: ['docs/adr/*.md'], cwd: deutschRoot })
    expect(() =>
      adrEnforcement(c, {
        section: /durchsetzung/i,
        columns: { tier: /tier/i, mechanism: /umsetzung/i, status: /status/i },
      }),
    ).not.toThrow()
  })

  it('needs its columns option: without it the localized table is not found', () => {
    // The red half: the German header is not one the default pattern reads, so dropping
    // `columns` (or a default widened to read it) is seen here, not only by hand. Line 5 is
    // the header row: a section with no table at all gives the same message on line 1.
    const c = corpus({ roots: ['docs/adr/*.md'], cwd: deutschRoot })
    let found: { ruleId: string | undefined; line: number; message: string }[] = []
    try {
      adrEnforcement(c, { section: /durchsetzung/i })
    } catch (e) {
      if (!(e instanceof ArchRuleError)) throw e
      found = e.violations.map((v) => ({ ruleId: v.ruleId, line: v.line, message: v.message }))
    }
    expect(found).toEqual([
      {
        ruleId: 'adr/enforcement-declared',
        line: 5,
        message:
          'no table with the required columns (/tier/i, /mechanism/i, /status/i) in section "/durchsetzung/i"',
      },
    ])
  })
})
