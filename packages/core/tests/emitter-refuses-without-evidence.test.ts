/**
 * The emitter refuses a verdict without evidence —
 * [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md),
 * built by [plan 0235](../../../work/plans/completed/0235-the-emitter-takes-a-receipt.md).
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
import {
  EMITTER_NO_RECEIPT,
  EMITTER_PASS_WITHOUT_EVIDENCE,
  EMITTER_EXPIRED_DECLARATION,
  EMITTER_CONTRADICTORY_EVIDENCE,
} from '../src/emitter-findings.js'
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

describe('a declaration that has expired (ADR-014 §3)', () => {
  // **Why this suite exists at all.** Without it `emitter/expired-declaration`
  // would be an id nothing proves can fire — which is bug 0190's exact shape, in
  // the change that closes 0190. Found by asking of this PR the question its own
  // enforcement review would ask.
  //
  // The expiry is not decoration: ADR-010 §3 admits a declaration ONLY because it
  // "fails the day it stops being true". A claim nothing can contradict is not an
  // assertion, which is the whole reason ADR-014 §3's amendment refuses to infer
  // one from `overrides: { id: 'off' }`.
  it('declared empty, then examined something, is the expired-declaration finding', () => {
    const expired = collectResult([], { examined: 3, declaredEmpty: true })
    const result = finishPreset(expired, { report: 'return' })
    expect(ids(result)).toContain(EMITTER_EXPIRED_DECLARATION)
  })

  it('names the number, because the number IS the finding', () => {
    const expired = collectResult([], { examined: 7, declaredEmpty: true })
    const result = finishPreset(expired, { report: 'return' })
    const found = result.find((v) => v.ruleId === EMITTER_EXPIRED_DECLARATION)
    expect(found?.message).toContain('7')
  })

  it('fires even beside real violations — the declaration is wrong independently', () => {
    const expired = collectResult([finding('some/real-rule')], {
      examined: 2,
      declaredEmpty: true,
    })
    const result = finishPreset(expired, { report: 'return' })
    expect(ids(result)).toContain(EMITTER_EXPIRED_DECLARATION)
    expect(ids(result)).toContain('some/real-rule')
  })

  it('CONTROL — declared empty AND examined zero stays green', () => {
    // The state the declaration exists for. If this reddened, the remedy would be
    // to stop declaring, which is the trained-suppression dynamic ADR-009 rule 1
    // names.
    const honest = collectResult([], { examined: 0, declaredEmpty: true })
    const result = finishPreset(honest, { report: 'return' })
    expect(ids(result)).not.toContain(EMITTER_EXPIRED_DECLARATION)
    expect(result).toHaveLength(0)
  })
})

describe('a notRun that contradicts its own evidence (ADR-014 §3)', () => {
  // **Why this suite exists.** `notRun` shipped as the one suppressing flag in
  // the evidence vocabulary with nothing that could contradict it — found by an
  // enforcement review of this PR, not by its author. It is the flag that
  // exempts a member from the merge's dead filter, so an unfalsifiable one is a
  // mute button, which is precisely what ADR-014 §3's amendment refuses.
  it('marked never-run, yet examined something, is the contradiction finding', () => {
    const lying = collectResult([], { examined: 4, notRun: true })
    const result = finishPreset(lying, { report: 'return' })
    expect(ids(result)).toContain(EMITTER_CONTRADICTORY_EVIDENCE)
  })

  it('marked never-run, yet carrying a violation, is the contradiction finding', () => {
    // The half `examined` alone does not cover: a rule that did not run cannot
    // have produced a finding either.
    const lying = collectResult([finding('some/real-rule')], { examined: 0, notRun: true })
    const result = finishPreset(lying, { report: 'return' })
    expect(ids(result)).toContain(EMITTER_CONTRADICTORY_EVIDENCE)
  })

  it('names both numbers, because which half contradicted the flag is the fix', () => {
    const lying = collectResult([finding('a'), finding('b')], { examined: 9, notRun: true })
    const found = finishPreset(lying, { report: 'return' }).find(
      (v) => v.ruleId === EMITTER_CONTRADICTORY_EVIDENCE,
    )
    expect(found?.message).toContain('9')
    expect(found?.message).toContain('2')
  })

  it('CONTROL — a genuine notRun (zero examined, nothing found) stays green', () => {
    // The state `dispatchRule`'s `'off'` branch produces on every disabled rule.
    // If this reddened, every preset with one rule turned off would red, and the
    // remedy would be to stop marking notRun — trained suppression, ADR-009 §1.
    const honest = collectResult([], { examined: 0, notRun: true })
    const result = finishPreset(honest, { report: 'return' })
    expect(ids(result)).not.toContain(EMITTER_CONTRADICTORY_EVIDENCE)
  })

  it('a contradictory MEMBER is caught by the merge, which the gate cannot see', () => {
    // The merged receipt carries no `notRun`, so this is the only door where a
    // lying member is visible at all.
    const lying = collectResult([], { examined: 7, notRun: true })
    const healthy = collectResult([], { examined: 100 })
    const result = finishPreset(mergeCollectResults([lying, healthy]), { report: 'return' })
    expect(ids(result)).toContain(EMITTER_CONTRADICTORY_EVIDENCE)
  })

  it('CONTROL — an honest notRun member beside a healthy one stays green', () => {
    // Bug 0261's shape: one disabled rule must not red a preset whose others
    // examined plenty.
    const off = collectResult([], { examined: 0, notRun: true })
    const healthy = collectResult([], { examined: 100 })
    const result = finishPreset(mergeCollectResults([off, healthy]), { report: 'return' })
    expect(result).toHaveLength(0)
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

  it('THROWS under warn for a contradicted notRun too — every emitter finding escalates', () => {
    // `isEmitterFinding` is the list that decides this, and a new id added to
    // the vocabulary without being added to that list would print above a zero
    // exit — the precise lie ADR-014 §5 exists to prevent, and the mistake this
    // assertion caught while the id was being wired.
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() =>
      finishPreset(collectResult([], { examined: 5, notRun: true }), { report: 'warn' }),
    ).toThrow()
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
