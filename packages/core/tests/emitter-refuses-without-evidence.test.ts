/**
 * The emitter refuses a verdict without evidence —
 * [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md),
 * built by [plan 0235](../../../work/plans/0235-the-emitter-takes-a-receipt.md).
 *
 * **RED FIRST.** These are written against the receipt API that Phase 2 builds;
 * until it lands they do not compile, which is the intended red. Do not
 * "fix" them by loosening an assertion — the point of each is a specific
 * corruption it must catch.
 *
 * **Every assertion keys on the rule ID, never on a count.** The plan's Phase 1
 * says why: the existing `report.test.ts` asserts `toHaveLength(n)` on bare
 * arrays, and every one of those becomes `n + 1` the moment a finding is
 * appended — a test that changes meaning under the change it is meant to guard
 * is not a guard. `expect(ids(result)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)`
 * survives an unrelated finding arriving beside it, and fails for exactly one
 * reason.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { reportViolations, finishPreset } from '../src/report.js'
import { EMITTER_NO_RECEIPT, EMITTER_PASS_WITHOUT_EVIDENCE } from '../src/emitter-findings.js'
import { collectResult, mergeCollectResults } from '../src/collect-result.js'
import type { ArchViolation } from '../src/violation.js'

afterEach(() => vi.restoreAllMocks())

/** A violation carrying its own id, so identity assertions can tell it apart. */
const finding = (id: string): ArchViolation => ({
  rule: id,
  ruleId: id,
  element: 'e',
  file: 'f.ts',
  line: 1,
  message: `m:${id}`,
})

const ids = (vs: readonly ArchViolation[]): (string | undefined)[] => vs.map((v) => v.ruleId)

/** A receipt the pipeline would have minted, through the real constructor. */
const receipt = (violations: ArchViolation[], examined: number) =>
  collectResult(violations, { examined })

describe('a pass with no evidence at all', () => {
  it('a bare array reaching reportViolations throws, carrying the no-receipt finding', () => {
    // Corrected while building Phase 2: this first asserted the finding was
    // RETURNED. That contradicted ADR-014 §5, which the last describe in this
    // file asserts — a bare `reportViolations` hands nothing back to act on, so
    // the finding escalates to a throw. The implementation was right and the
    // test was wrong; fixed here rather than by weakening the emitter.
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    let thrown: unknown
    try {
      // @ts-expect-error — a bare array is exactly what ADR-014 makes
      // unrepresentable. ADR-005-legal and self-sabotaging: loosen the emitter's
      // type and `tsc` reds on this unused directive.
      reportViolations([])
    } catch (e) {
      thrown = e
    }
    const violations = (thrown as { violations?: ArchViolation[] } | undefined)?.violations ?? []
    expect(ids(violations)).toContain(EMITTER_NO_RECEIPT)
    expect(err).toHaveBeenCalled()
  })

  it('a bare array reaching finishPreset is the no-receipt finding', () => {
    // @ts-expect-error — see above.
    const result = finishPreset([], { report: 'return' })
    expect(ids(result)).toContain(EMITTER_NO_RECEIPT)
  })

  it('fires even when the run was healthy — the defect is the shape, not the verdict', () => {
    // The one an author will argue about. A run that found real violations still
    // cannot be checked if it arrived with no denominator, and the path where
    // that matters most is the one where the loop examined nothing.
    // @ts-expect-error — bare array.
    const result = finishPreset([finding('some/real-rule')], { report: 'return' })
    expect(ids(result)).toContain(EMITTER_NO_RECEIPT)
    expect(ids(result)).toContain('some/real-rule')
  })
})

describe('a pass whose evidence proves nothing', () => {
  it('zero examined, zero violations, no declaration is the vacuous-pass finding', () => {
    const result = finishPreset(receipt([], 0), { report: 'return' })
    expect(ids(result)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('CONTROL — zero examined WITH a declaration stays green', () => {
    const declared = collectResult([], { examined: 0, declaredEmpty: true })
    const result = finishPreset(declared, { report: 'return' })
    expect(ids(result)).not.toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    expect(result).toHaveLength(0)
  })

  it('CONTROL — a healthy run that examined units and found nothing stays green', () => {
    const result = finishPreset(receipt([], 42), { report: 'return' })
    expect(ids(result)).not.toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    expect(ids(result)).not.toContain(EMITTER_NO_RECEIPT)
    expect(result).toHaveLength(0)
  })

  it('does NOT stack on a receipt that already carries a finding', () => {
    // ADR-014 §4: "a value that already carries a finding is red, and the
    // emitter adds nothing to it." A terminal that examined nothing has already
    // said so with its own cause; "you constructed nothing" beside "your glob is
    // dead" is a false second remedy.
    const already = receipt([finding('core/zero-examined')], 0)
    const result = finishPreset(already, { report: 'return' })
    expect(ids(result)).toContain('core/zero-examined')
    expect(ids(result)).not.toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('carries THAT finding through, asserted by identity not by length', () => {
    const original = finding('core/zero-examined')
    const result = finishPreset(receipt([original], 0), { report: 'return' })
    expect(result).toContain(original)
  })
})

describe('the finding leaves by every door (ADR-014 §5)', () => {
  it('rides the throw under the default throw mode', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    let thrown: unknown
    try {
      finishPreset(receipt([], 0))
    } catch (e) {
      thrown = e
    }
    const violations = (thrown as { violations?: ArchViolation[] } | undefined)?.violations ?? []
    expect(ids(violations)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('THROWS under warn — a printed unsuppressable finding above a zero exit is the lie', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => finishPreset(receipt([], 0), { report: 'warn' })).toThrow()
  })

  it('THROWS under a bare reportViolations, which hands nothing back to act on', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => reportViolations(receipt([], 0))).toThrow()
  })

  it('is returned, not thrown, under report: return — the caller owns it', () => {
    const result = finishPreset(receipt([], 0), { report: 'return' })
    expect(ids(result)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })
})

describe('the merge is fail-closed (ADR-014 §7, D7)', () => {
  it('declared only if EVERY zero-contributing member declared', () => {
    // A `some()` where an `every()` was meant lets one declared part vouch for a
    // hand-counted zero. Only a test pins it.
    const declared = collectResult([], { examined: 0, declaredEmpty: true })
    const undeclared = receipt([], 0)
    const merged = finishPreset(mergeCollectResults([declared, undeclared]), { report: 'return' })
    expect(ids(merged)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('a bare member is the no-receipt finding, not a silent zero', () => {
    // No @ts-expect-error: the merge deliberately ACCEPTS bare members — that is
    // the shape it has to defend against — and poisons the result instead.
    const merged = mergeCollectResults([receipt([], 5), []])
    const result = finishPreset(merged, { report: 'return' })
    expect(ids(result)).toContain(EMITTER_NO_RECEIPT)
  })

  it('zero members is zero examined, not an absent denominator', () => {
    const result = finishPreset(mergeCollectResults([]), { report: 'return' })
    expect(ids(result)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('sourceEmpty on any member outranks a declaration on another', () => {
    const empty = collectResult([], { examined: 0, sourceEmpty: true })
    const declared = collectResult([], { examined: 0, declaredEmpty: true })
    const merged = mergeCollectResults([empty, declared])
    expect(merged.sourceEmpty).toBe(true)
    expect(merged.declaredEmpty).not.toBe(true)
  })
})
