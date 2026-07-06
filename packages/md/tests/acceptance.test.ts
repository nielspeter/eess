import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, docs, links, pointers } from '../src/index.js'
import { adrEnforcement } from '../src/rules/adr.js'

const fixtures = dirname(fileURLToPath(import.meta.url))
const madrRoot = join(fixtures, 'fixtures/madr')
const danskRoot = join(fixtures, 'fixtures/dansk')

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
// adrEnforcement preset validates a Danish ADR via header/section patterns.
describe('acceptance: localized (Danish) ADR via adrEnforcement config', () => {
  it('validates a Håndhævelse / Mekanisme table with config, no fork', () => {
    const c = corpus({ roots: ['docs/adr/*.md'], cwd: danskRoot })
    expect(() =>
      adrEnforcement(c, {
        section: /håndhævelse/i,
        columns: { tier: /tier/i, mechanism: /mekanisme/i, status: /status/i },
      }),
    ).not.toThrow()
  })
})
