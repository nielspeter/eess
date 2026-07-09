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
