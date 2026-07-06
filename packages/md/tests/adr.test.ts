import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '../src/index.js'
import { adrEnforcement } from '../src/rules/adr.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')
const c = (roots: string[]) => corpus({ roots, cwd: fixtureRoot })

/** Run the preset, return the violation messages it throws (or [] if it passes). */
function messagesFrom(fn: () => void): string[] {
  try {
    fn()
    return []
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations.map((v) => v.message)
    throw e
  }
}

describe('adrEnforcement() preset', () => {
  it('passes a well-formed ADR (valid tiers, resolvable citations)', () => {
    expect(() => adrEnforcement(c(['docs/adr/0001-good.md']))).not.toThrow()
  })

  it('fails an ADR with no Enforcement table', () => {
    expect(() => adrEnforcement(c(['docs/adr/0002-missing.md']))).toThrow()
  })

  it('fails an ADR with an invalid tier', () => {
    const msgs = messagesFrom(() => adrEnforcement(c(['docs/adr/0003-bad-tier.md'])))
    expect(msgs.some((m) => /no valid tier/.test(m))).toBe(true)
  })

  it('fails an ADR citing a missing file', () => {
    const msgs = messagesFrom(() => adrEnforcement(c(['docs/adr/0004-bad-cite.md'])))
    expect(msgs.some((m) => /cites missing file/.test(m))).toBe(true)
  })

  it('override can downgrade a single rule to off', () => {
    // the invalid tier is the only problem; turning off valid-tiers makes it pass
    expect(() =>
      adrEnforcement(c(['docs/adr/0003-bad-tier.md']), {
        overrides: { 'adr/valid-tiers': 'off' },
      }),
    ).not.toThrow()
  })

  it('verifyCitations:false skips the citation check', () => {
    expect(() =>
      adrEnforcement(c(['docs/adr/0004-bad-cite.md']), { verifyCitations: false }),
    ).not.toThrow()
  })

  // The ADR-dir index (README.md / index.md) is not an ADR and is exempt (0064).
  describe('index README exemption', () => {
    const adrIndex = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/adr-index')
    const ci = (roots: string[]) => corpus({ roots, cwd: adrIndex })

    it('exempts a README with no Enforcement table', () => {
      // README + a valid ADR: passes because README is not required to be an ADR.
      expect(() =>
        adrEnforcement(ci(['adr/README.md', 'adr/0001-good.md']), { dir: 'adr/**' }),
      ).not.toThrow()
    })

    it('still fails a real ADR missing its table even beside an exempt README', () => {
      const msgs = messagesFrom(() =>
        adrEnforcement(ci(['adr/README.md', 'adr/0002-missing-table.md']), { dir: 'adr/**' }),
      )
      expect(msgs.some((m) => /0002-missing-table/.test(m) || /Enforcement/i.test(m))).toBe(true)
    })
  })
})
