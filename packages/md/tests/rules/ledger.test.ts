import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError, type ArchViolation } from '@nielspeter/eess'
import { corpus } from '../../src/index.js'
import { taskItems } from '../../src/builders/task-items.js'
import { honestyAtClose } from '../../src/rules/ledger.js'

// this test lives in tests/rules/, fixtures live in tests/fixtures/
const ledgerRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'ledger')

// A single-fixture corpus so each case is isolated.
function corpusFor(glob: string) {
  return corpus({ roots: [glob], cwd: ledgerRoot })
}

/** The violations `honestyAtClose` raises (empty if it passes). */
function findingsOf(run: () => void): ArchViolation[] {
  try {
    run()
    return []
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
}

describe('taskItems() primitive — mdast gives the false-positive guards for free', () => {
  it('yields open boxes but not the ones in a blockquote', () => {
    // guard-blockquote.md quotes `> - [ ]` boxes (skipped) and has one real `- [x]`.
    const items = taskItems(corpusFor('guard-blockquote.md'))
      .areOpen()
      .select({ label: 't', identify: () => ({ name: '' }) }).elements
    expect(items).toHaveLength(0)
  })

  it('does not see a `- [ ]` inside a fenced code block', () => {
    const items = taskItems(corpusFor('guard-code-fence.md'))
      .areOpen()
      .select({ label: 't', identify: () => ({ name: '' }) }).elements
    expect(items).toHaveLength(0)
  })

  it('sees a real open box even when a code fence sits above it', () => {
    const items = taskItems(corpusFor('red-fence-above-box.md'))
      .areOpen()
      .select({ label: 't', identify: () => ({ name: '' }) }).elements
    expect(items.length).toBeGreaterThan(0)
  })
})

describe('honestyAtClose — ledger reconciliation (closeInPlace to isolate from placement)', () => {
  const opts = { closeInPlace: true }

  it('flags a silent open box in a done-item (red)', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('red-silent-open-box.md'), opts))
    expect(f.some((v) => v.rule === 'ledger/silent-open-box')).toBe(true)
  })

  it('passes a done-item whose every open box is disposed (green)', () => {
    expect(() => honestyAtClose(corpusFor('green-reconciled.md'), opts)).not.toThrow()
  })

  it('flags a `Deferred: none` summary contradicted by a deferred box (red)', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('red-deferred-none-lie.md'), opts))
    expect(f.some((v) => v.rule === 'ledger/deferred-none-lie')).toBe(true)
  })

  it('does not trip on boxes quoted inside a blockquote (guard)', () => {
    expect(() => honestyAtClose(corpusFor('guard-blockquote.md'), opts)).not.toThrow()
  })

  it('does not trip on a `- [ ]` inside a code fence (guard)', () => {
    expect(() => honestyAtClose(corpusFor('guard-code-fence.md'), opts)).not.toThrow()
  })

  it('a real open box after a code fence still fails (fence does not mask it)', () => {
    expect(() => honestyAtClose(corpusFor('red-fence-above-box.md'), opts)).toThrow()
  })
})

describe('honestyAtClose — state↔folder placement', () => {
  it('flags a Draft item stranded in a done-folder', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('completed/red-draft-in-done.md')))
    expect(f.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(true)
  })

  it('flags a Done item not in a done-folder (orphaned close) — unless closeInPlace', () => {
    const stranded = findingsOf(() => honestyAtClose(corpusFor('green-reconciled.md')))
    expect(stranded.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(true)
    // closeInPlace disables the orphaned-close half.
    const inPlace = findingsOf(() =>
      honestyAtClose(corpusFor('green-reconciled.md'), { closeInPlace: true }),
    )
    expect(inPlace.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(false)
  })
})

// Bug 0118. An unrecognised `State:` token used to leave `stateLine` at 0, so
// placementViolation returned null and the state↔folder check silently switched
// itself off. Four of this repo's own plans carried such a token; the gate had
// been half-off for them since it was written, and said nothing.
describe('honestyAtClose — an unreadable State token is a finding, not silence', () => {
  it('flags a State token outside the vocabulary instead of skipping the document', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('red-unknown-state.md')))
    const unknown = f.filter((v) => v.rule === 'ledger/unknown-state')
    expect(unknown).toHaveLength(1)
    expect(unknown[0]?.message).toMatch(/IMPLEMENTED/)
    // It names what IS allowed, or the author cannot act on it.
    expect(unknown[0]?.message).toMatch(/Done/)
  })

  it('accepts a token the caller declares — the vocabulary is the caller-s', () => {
    const f = findingsOf(() =>
      honestyAtClose(corpusFor('red-unknown-state.md'), {
        states: ['Draft', 'Ready', 'IMPLEMENTED'],
        terminalStates: ['IMPLEMENTED'],
        closeInPlace: true,
      }),
    )
    expect(f.some((v) => v.rule === 'ledger/unknown-state')).toBe(false)
  })

  it('reports a bug-lane orphaned close once the bug vocabulary is declared', () => {
    // The differential 0118 measured: identical to the plan-lane case that has
    // always been caught, invisible only because `Fixed` was not in the enum.
    const withVocab = findingsOf(() =>
      honestyAtClose(corpusFor('red-bug-orphaned-close.md'), {
        states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
        terminalStates: ['Fixed', 'Rejected'],
      }),
    )
    expect(withVocab.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(true)
  })

  it('passes a bug closed into fixed/ with the same vocabulary', () => {
    const f = findingsOf(() =>
      honestyAtClose(corpusFor('fixed/green-bug-closed.md'), {
        states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
        terminalStates: ['Fixed', 'Rejected'],
      }),
    )
    expect(f).toEqual([])
  })

  it('says nothing about a document with no State line at all', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('guard-blockquote.md')))
    expect(f.some((v) => v.rule === 'ledger/unknown-state')).toBe(false)
  })
})

// Bug 0119. Every fixture above puts `State:` in the preamble — the one shape
// the real corpus does not use. Scanning stopped at the first `##`, so all 55
// records that carry a State line under `## Status` were invisible and the
// placement check reported green having examined nothing.
describe('honestyAtClose — the State line sits under ## Status, as every record writes it', () => {
  it('reads a State token below the first heading, not only in the preamble', () => {
    const f = findingsOf(() => honestyAtClose(corpusFor('completed/red-state-under-status.md')))
    expect(f.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(true)
  })

  it('still reads a State token written in the preamble', () => {
    // The old shape must keep working — this widens the region, it does not move it.
    const f = findingsOf(() => honestyAtClose(corpusFor('completed/red-draft-in-done.md')))
    expect(f.some((v) => v.rule === 'ledger/state-folder-mismatch')).toBe(true)
  })

  it('does not read a State line from a later section', () => {
    // The region is the preamble plus the FIRST section. A `State:` mentioned in
    // prose further down is not this document's state.
    const f = findingsOf(() => honestyAtClose(corpusFor('green-state-mentioned-later.md')))
    expect(f).toEqual([])
  })
})
