import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { corpus } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'

const fixtures = path.resolve(import.meta.dirname, '../fixtures')
const lane = (dir: string): ReturnType<typeof corpus> =>
  corpus({ cwd: path.join(fixtures, dir), roots: ['plans/**', 'mails/**'] })

/**
 * Bug 0444 — `honestyAtClose` read only `State:`. A record written `**Status:**`
 * had no readable state, so neither direction of the placement check ran on it,
 * and the preset said nothing. The five records are the bug's own table.
 */
describe('honestyAtClose reads the caller’s label (bug 0444)', () => {
  const at = (found: readonly { element: string }[], name: string): number =>
    found.filter((v) => v.element.includes(name)).length

  it('with aliases: [Status], a Status: record in the wrong folder is reported, both ways', () => {
    const found = honestyAtClose(
      corpus({ cwd: path.join(fixtures, 'ledger-status'), roots: ['plans/**'] }),
      {
        aliases: ['Status'],
        report: 'return',
      },
    )
    expect(at(found, '0002-status-done-live')).toBeGreaterThan(0)
    expect(at(found, '0005-status-draft-completed')).toBeGreaterThan(0)
  })

  it('a lane whose records carry no state under the label in force is one finding, naming the label', () => {
    const found = honestyAtClose(
      corpus({ cwd: path.join(fixtures, 'ledger-status-only'), roots: ['plans/**'] }),
      { report: 'return' },
    )
    const lanes = found.filter((v) => v.message.includes('has a State: line'))
    expect(lanes).toHaveLength(1)
    expect(lanes[0]?.suggestion).toContain("label: 'Status'")
  })

  it('the same lane read with label: Status has no lane finding', () => {
    const found = honestyAtClose(
      corpus({ cwd: path.join(fixtures, 'ledger-status-only'), roots: ['plans/**'] }),
      { label: 'Status', report: 'return' },
    )
    expect(found.filter((v) => v.message.includes('records in this lane'))).toHaveLength(0)
  })

  it('a stateless folder beside records with a state gives no lane finding', () => {
    const found = honestyAtClose(lane('ledger-status-mixed'), { report: 'return' })
    expect(found.filter((v) => v.message.includes('records in this lane'))).toHaveLength(0)
  })
})
