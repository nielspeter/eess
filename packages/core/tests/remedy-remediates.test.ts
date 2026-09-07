/**
 * Every emitter finding's remedy is applied, and must clear it — plan 0263
 * Phase 3, ADR-014 §4 and ADR-009 rule 2's behavioural corollary.
 *
 * **The half nobody writes.** It is easy to assert that a corrupt input produces
 * a finding; that only proves the gate fires. What goes wrong in practice is the
 * other half — a message names a remedy that does not work, or cannot be reached
 * from the seam the reader is standing at. Both happened in this codebase and
 * both were caught by review rather than by a test:
 *
 * - `checkAll([])`'s finding told the reader to guard the array before calling,
 *   which makes the check vanish instead of satisfying it;
 * - this gate's `pass-without-evidence` message named `expectEmpty: true in a
 *   preset's report options` at a seam that is frequently not a preset — the
 *   thing ADR-014 §4 forbids in as many words.
 *
 * So each case below states the remedy its message names, applies exactly that,
 * and asserts the finding is gone. A remedy that cannot be applied here cannot
 * be applied by a reader either.
 */
import { describe, it, expect } from 'vitest'
import { collectResult } from '../src/collect-result.js'
import { finishPreset } from '../src/report.js'
import type { ArchViolation } from '../src/violation.js'

const ids = (violations: readonly ArchViolation[]): (string | undefined)[] =>
  violations.map((v) => v.ruleId)

/** The gate, in the mode that hands findings back rather than emitting them. */
const gate = (receipt: Parameters<typeof finishPreset>[0]): ArchViolation[] => [
  ...finishPreset(receipt, { report: 'return' }),
]

describe('every emitter remedy remediates (ADR-009 rule 2)', () => {
  describe('emitter/no-receipt — a bare array', () => {
    // Remedy, verbatim: "return collectResult(violations, { examined }) instead
    // of a plain array, where `examined` is how many units you actually looked at".
    it('fires, and returning a receipt clears it', () => {
      // `@ts-expect-error`, not a cast: the TYPE already refuses a bare array
      // (ADR-014's D1), and this gate exists for the untyped JavaScript caller
      // the type cannot reach. ADR-005 forbids the `as` that would silence it,
      // and the sibling test in `emitter-refuses-without-evidence.test.ts` drives
      // it the same way.
      // @ts-expect-error — a bare array is exactly the shape under test.
      const before = gate([])
      expect(ids(before)).toContain('emitter/no-receipt')

      const after = gate(collectResult([], { examined: 7 }))
      expect(ids(after)).not.toContain('emitter/no-receipt')
      expect(after).toHaveLength(0)
    })

    it('names the call the remedy requires, so the reader can apply it', () => {
      // @ts-expect-error — a bare array is exactly the shape under test.
      const [finding] = gate([])
      expect(finding?.message).toContain('collectResult(violations, { examined })')
    })
  })

  describe('emitter/pass-without-evidence — zero examined, undeclared', () => {
    // Two remedies are named: widen the selection, or declare the emptiness ON
    // THE RECEIPT. Both are applied below, because a message that offers two
    // must be right about both.
    it('fires, and widening the selection clears it', () => {
      const before = gate(collectResult([], { examined: 0 }))
      expect(ids(before)).toContain('emitter/pass-without-evidence')

      const after = gate(collectResult([], { examined: 12 }))
      expect(after).toHaveLength(0)
    })

    it('fires, and declaring the emptiness on the receipt clears it', () => {
      const after = gate(collectResult([], { examined: 0, declaredEmpty: true }))
      expect(after).toHaveLength(0)
    })

    it('names no preset option — ADR-014 §4, at a seam that may not be a preset', () => {
      const [finding] = gate(collectResult([], { examined: 0 }))
      expect(finding?.message).not.toMatch(/preset/i)
      // And it names what IS reachable from a hand-assembled receipt.
      expect(finding?.message).toContain('declaredEmpty: true')
    })
  })

  describe('emitter/source-empty — the source loaded nothing', () => {
    // Remedy, verbatim: "Fix the source configuration — the project, the
    // tsconfig, or the glob — not the declaration."
    it('fires, and a source that loaded units clears it', () => {
      const before = gate(collectResult([], { examined: 0, sourceEmpty: true }))
      expect(ids(before)).toContain('emitter/source-empty')

      const after = gate(collectResult([], { examined: 4 }))
      expect(after).toHaveLength(0)
    })

    it('OUTRANKS a declaration, which is the remedy it refuses to offer', () => {
      // ADR-014 §4: "an empty source outranks any declaration and names the
      // source". Before this phase the gate honoured `declaredEmpty` first and
      // this receipt returned GREEN — a hand-assembled verdict declaring away an
      // absent source, which is the escape hatch the code's own comment claimed
      // was closed.
      const declaredAway = gate(
        collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }),
      )
      expect(ids(declaredAway)).toContain('emitter/source-empty')

      const notRunAway = gate(collectResult([], { examined: 0, sourceEmpty: true, notRun: true }))
      expect(ids(notRunAway)).toContain('emitter/source-empty')
    })

    it('does not send the reader to the remedy that cannot work', () => {
      const [finding] = gate(collectResult([], { examined: 0, sourceEmpty: true }))
      expect(finding?.message).toContain('outranks any declaration')
      expect(finding?.message).toContain('Fix the source configuration')
    })
  })

  describe('emitter/expired-declaration — declared empty, then examined', () => {
    // Remedy, verbatim: "If the set legitimately grew past empty, remove the
    // declaration; the violations above (if any) still stand."
    it('fires, and removing the declaration clears it', () => {
      const before = gate(collectResult([], { examined: 3, declaredEmpty: true }))
      expect(ids(before)).toContain('emitter/expired-declaration')

      const after = gate(collectResult([], { examined: 3 }))
      expect(after).toHaveLength(0)
    })

    it('names the number, so the reader knows the declaration is stale', () => {
      const [finding] = gate(collectResult([], { examined: 3, declaredEmpty: true }))
      expect(finding?.message).toContain('examined 3 unit(s)')
    })
  })

  describe('emitter/contradictory-evidence — notRun beside evidence', () => {
    // Remedy, verbatim: "Drop the notRun flag if the rule ran, or drop the
    // evidence if it did not". Both halves are applied.
    it('fires, and dropping the flag clears it', () => {
      const before = gate(collectResult([], { examined: 5, notRun: true }))
      expect(ids(before)).toContain('emitter/contradictory-evidence')

      const after = gate(collectResult([], { examined: 5 }))
      expect(after).toHaveLength(0)
    })

    it('fires, and dropping the evidence clears it', () => {
      const after = gate(collectResult([], { examined: 0, notRun: true }))
      expect(after).toHaveLength(0)
    })
  })

  it('CONTROL — an honest receipt reaches none of these', () => {
    // Without this, "every remedy clears its finding" is satisfied by a gate
    // that never fires at all.
    expect(gate(collectResult([], { examined: 9 }))).toHaveLength(0)
    expect(gate(collectResult([], { examined: 0, declaredEmpty: true }))).toHaveLength(0)
  })
})
