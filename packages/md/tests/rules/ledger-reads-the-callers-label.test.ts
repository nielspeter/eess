import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { corpus, isArchConfigError } from '../../src/index.js'
import { honestyAtClose, ledgerStats, type HonestyAtCloseOptions } from '../../src/rules/ledger.js'

const fixtures = path.resolve(import.meta.dirname, '../fixtures')
const lane = (dir: string, roots: readonly string[] = ['plans/**']): ReturnType<typeof corpus> =>
  corpus({ cwd: path.join(fixtures, dir), roots })

/** `[rule, file name]` pairs, sorted, so a finding is pinned by identity rather than counted. */
const pairs = (
  dir: string,
  options: HonestyAtCloseOptions = {},
  roots?: readonly string[],
): string[][] =>
  honestyAtClose(lane(dir, roots), { report: 'return', ...options })
    .map((v) => [v.rule, v.element.split('/').pop() ?? v.element])
    .sort((a, b) => `${a[0] ?? ''}${a[1] ?? ''}`.localeCompare(`${b[0] ?? ''}${b[1] ?? ''}`))

const UNDER = 'ledger/state-under-another-label'
const MISMATCH = 'ledger/state-folder-mismatch'
const BOX = 'ledger/silent-open-box'

/**
 * Bug 0444 — `honestyAtClose` read only `State:`. A record written `**Status:**`
 * had no readable state, so neither direction of the placement check ran on it,
 * and the preset said nothing. The five records under `ledger-status/` are the
 * bug's own table.
 */
describe('honestyAtClose reads the caller’s label (bug 0444)', () => {
  it('with default options, every Status: record is named, not skipped', () => {
    expect(pairs('ledger-status')).toEqual([
      [BOX, '0001-status-done-open-box.md'],
      [BOX, '0003-state-done-open-box.md'],
      [MISMATCH, '0004-state-done-live.md'],
      [UNDER, '0001-status-done-open-box.md'],
      [UNDER, '0002-status-done-live.md'],
      [UNDER, '0005-status-draft-completed.md'],
    ])
  })

  it('with aliases: [Status], the Status: records are read and checked against their folders', () => {
    const expected = [
      [BOX, '0001-status-done-open-box.md'],
      [BOX, '0003-state-done-open-box.md'],
      [MISMATCH, '0002-status-done-live.md'],
      [MISMATCH, '0004-state-done-live.md'],
      [MISMATCH, '0005-status-draft-completed.md'],
    ]
    expect(pairs('ledger-status', { aliases: ['Status'] })).toEqual(expected)
    // An alias adds to the label, it does not replace it: 0004 (`State:`) is still read.
    expect(pairs('ledger-status', { label: 'Status', aliases: ['State'] })).toEqual(expected)
  })

  it('label is matched in any letter case, and replaces the default State', () => {
    const found = pairs('ledger-status', { label: 'status' })
    expect(found).toContainEqual([MISMATCH, '0002-status-done-live.md'])
    expect(found).toContainEqual([UNDER, '0004-state-done-live.md'])
  })

  it('a call whose documents carry no state at all is one finding, with a remedy from the options', () => {
    const found = honestyAtClose(lane('ledger-stateless'), { report: 'return' })
    expect(found.map((v) => v.rule)).toEqual(['ledger/no-readable-state'])
    expect(found[0]?.suggestion).toContain('narrow the corpus')
    expect(found[0]?.suggestion).toContain('`State:`')
    expect(found[0]?.suggestion).toContain('`## Status: Done` is read under the labels in force')
  })

  it('a plain Status: line is named too, beside records the preset reads', () => {
    expect(pairs('ledger-plain')).toEqual([
      [MISMATCH, 'a.md'],
      [UNDER, 'c.md'],
    ])
  })

  it('a non-record whose header holds a state word is reported, not skipped', () => {
    // The finding cannot tell such a page from a record; its remedy names boardFiles.
    expect(pairs('ledger-non-record')).toEqual([[UNDER, 'faq.md']])
  })

  it('a stateless folder beside records with a state gives no lane finding', () => {
    expect(pairs('ledger-status-mixed', {}, ['plans/**', 'mails/**'])).toEqual([])
  })

  it('an empty lane is one zero-examined finding, not two', () => {
    const empty = corpus({ cwd: path.join(fixtures, 'ledger-status'), roots: ['nope/**'] })
    const found = honestyAtClose(empty, { report: 'return' })
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('examined zero units')
  })

  it('an empty or blank label is refused, not read as nothing', () => {
    let thrown: unknown
    try {
      honestyAtClose(lane('ledger-status'), { label: ' ', report: 'return' })
    } catch (e) {
      thrown = e
    }
    expect(isArchConfigError(thrown)).toBe(true)
  })

  it('ledgerStats reads the same label', () => {
    const stats = (options: HonestyAtCloseOptions): number =>
      ledgerStats(lane('ledger-status'), options).withReadableState
    expect(stats({})).toBe(2)
    expect(stats({ label: 'Status' })).toBe(3)
    expect(stats({ aliases: ['Status'] })).toBe(5)
  })
})

/**
 * Bug 0476 — a record that writes its state as a heading (`## Status: Done`) was never read, and in a
 * call where other records were readable nothing said so. The heading form is now read under the
 * labels in force, and reported under any other label.
 */
describe('honestyAtClose reads a heading-form state (bug 0476)', () => {
  it('with label: Status, a ## Status: heading is read and checked against its folder', () => {
    expect(pairs('ledger-heading', { label: 'Status', aliases: ['State'] })).toEqual([
      [BOX, '0002-heading-done-open-box.md'],
      [MISMATCH, '0001-heading-done-live.md'],
    ])
  })

  it('with default options, a ## Status: heading beside a readable record is reported, not skipped', () => {
    expect(pairs('ledger-heading')).toEqual([
      [BOX, '0002-heading-done-open-box.md'],
      [UNDER, '0001-heading-done-live.md'],
      [UNDER, '0002-heading-done-open-box.md'],
    ])
  })

  it('a ## Label: heading continues the header, and a value outside the vocabulary is reported', () => {
    expect(pairs('ledger-heading-more', { label: 'Status' })).toEqual([
      [MISMATCH, '0001-status-after-severity.md'],
      ['ledger/unknown-state', '0002-status-shipped.md'],
    ])
  })

  it('a heading under another label is reported only when its whole value is a state word', () => {
    // 0003's only label is `## Background: Open questions`: not a state, so not reported.
    expect(pairs('ledger-heading-body')).toEqual([])
  })

  it('a field-shaped heading after a section heading is body, not header', () => {
    // 0002's `- **State:** Done` sits under `## Option A: Keep`, below `## Problem`: an option's
    // state, not the record's, so it is not read (else it would be a mismatch in a live folder).
    expect(pairs('ledger-heading-body', { report: 'return' })).not.toContainEqual([
      MISMATCH,
      '0002-option-state.md',
    ])
  })

  it('## State: of the art under the label in force is reported as an unknown state, not skipped', () => {
    expect(pairs('ledger-heading-more', { label: 'Status' })).toContainEqual([
      'ledger/unknown-state',
      '0002-status-shipped.md',
    ])
  })
})
