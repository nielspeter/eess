import type { ArchViolation } from './violation.js'
import {
  noReceiptViolation,
  passWithoutEvidenceViolation,
  contradictoryEvidenceViolation,
} from './emitter-findings.js'

/**
 * The receipt — [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md).
 *
 * **An `ArchViolation[]` carrying its own evidence**, not an object wrapping
 * one. That shape is load-bearing and the review measured why: a plain object
 * turns every untyped consumer green, because `result.length` reads `undefined`
 * and `undefined > 0` is `false`. An array keeps `.length`, iteration,
 * `flatMap` and every existing `for…of` working and correct, so a JavaScript
 * consumer who never reads `examined` still exits non-zero on violations.
 * "`CollectResult`'s shape by name" is a tidiness argument and it loses to that.
 *
 * **The name stays `CollectResult`.** Plan 0235 calls it a "receipt" in prose;
 * there is deliberately no second exported name for one concept.
 *
 * `JSON.stringify` drops an array's own properties, which is why
 * `formatViolationsJson` carries `examined` across by hand — see the note there.
 */
export interface CollectResult extends Array<ArchViolation> {
  /** Units this rule actually reached its assertion over. The denominator. */
  readonly examined: number
  /** The source loaded nothing at all, before any selection ran. */
  readonly sourceEmpty?: boolean
  /** A caller declared this set legitimately empty, and the claim can expire. */
  readonly declaredEmpty?: boolean
  /**
   * This rule was never run — explicitly disabled, not merely empty.
   *
   * A third state, and it has to be distinguishable from both. A rule that RAN
   * and examined nothing is dead and the merge must say so. A rule turned off
   * never ran, so it has no denominator to be suspicious about — and marking it
   * `declaredEmpty` instead would mint the declaration ADR-014 §3's amendment
   * refuses to infer from `overrides: { id: 'off' }`.
   *
   * **It is falsifiable, like every other declaration here.** A rule that never
   * ran examined nothing and found nothing, so `notRun` beside a non-zero
   * `examined` or a violation is `emitter/contradictory-evidence` — checked at
   * the gate and in the merge. Without that check this would be the one
   * suppressing flag in the vocabulary that nothing can contradict, which is the
   * shape ADR-014 §3's amendment exists to refuse.
   *
   * The two are not interchangeable: without this, one disabled rule reddened a
   * whole preset whose other rules examined plenty (measured — `adrEnforcement`
   * with `adr/valid-tiers` off). With it, a preset where EVERY member is `notRun`
   * still sums to zero examined with no declaration, so the all-off case reports
   * exactly as §3 requires.
   */
  readonly notRun?: boolean
  /**
   * A specific dead-glob explanation for a zero-examined rule, pre-formatted
   * by the dialect that computed it (`RuleBuilder.deadGlobDiagnosis()`) — the
   * kernel never touches picomatch or a project type to build this itself.
   */
  readonly deadGlob?: string
}

/** Evidence a caller supplies alongside the violations. */
export interface Evidence {
  readonly examined: number
  readonly sourceEmpty?: boolean
  readonly declaredEmpty?: boolean
  readonly notRun?: boolean
  readonly deadGlob?: string
}

/**
 * The one constructor. Every terminal produces its receipt through this.
 *
 * **Stamps a FRESH array, deliberately.** `applyFilters` returns the *same
 * reference* when no exclusion applies, so stamping `examined` onto what it
 * hands back would mutate whatever a family memoized — a rule's evidence
 * appearing on someone else's array, changing when it is re-read. The copy is
 * the cost of not having that bug.
 */
export function collectResult(
  violations: readonly ArchViolation[],
  evidence: Evidence,
): CollectResult {
  // `Object.assign` returns the intersection type, so no assertion is needed —
  // ADR-005. An earlier cut wrote `[...violations] as ArchViolation[] & {…}` and
  // the repo's own `check:arch` reported it, in the module this plan adds.
  return Object.assign([...violations], {
    examined: evidence.examined,
    ...(evidence.sourceEmpty === true ? { sourceEmpty: true as const } : {}),
    ...(evidence.declaredEmpty === true ? { declaredEmpty: true as const } : {}),
    ...(evidence.notRun === true ? { notRun: true as const } : {}),
    ...(evidence.deadGlob === undefined ? {} : { deadGlob: evidence.deadGlob }),
  })
}

/** Does this value carry evidence at all, or is it a bare array? */
export function hasEvidence(value: readonly ArchViolation[]): value is CollectResult {
  // `in` narrows without an assertion — ADR-005.
  return 'examined' in value && typeof value.examined === 'number'
}

/**
 * The one merge — ADR-014 §7. Fail-closed, and each rule below is a rule a
 * hand-rolled sum got wrong somewhere (bug 0205's class: four emitters
 * restating one rule and disagreeing).
 *
 * - **`examined` sums.** Zero members sums to zero — an absent denominator is
 *   not a large one.
 * - **`declaredEmpty` requires EVERY zero-contributing member to declare.** A
 *   `some()` here lets one declared part vouch for a hand-counted zero beside
 *   it, which is the whole failure this merge exists to prevent.
 * - **`sourceEmpty` on any member outranks every declaration.** ADR-010 §3's
 *   precedence: a declaration asserts a fact about a loaded corpus, and over
 *   an empty source it asserts nothing.
 * - **A member with no evidence poisons the merge**, rather than being counted
 *   as zero. A dead member must not be able to hide inside a healthy sum, so
 *   the result carries no evidence either and the emitter says so.
 */
export function mergeCollectResults(parts: readonly (readonly ArchViolation[])[]): CollectResult {
  const violations = parts.flat()
  if (!parts.every(hasEvidence)) {
    // A member with no evidence at all. The merge REPORTS it rather than
    // returning an evidence-free value for the emitter to notice later: the
    // guarantee is this function's, and deferring it was also the last `as` in
    // this file (an evidence-free value is not a `CollectResult`).
    return collectResult([...violations, noReceiptViolation()], { examined: 0 })
  }

  // **ADR-014 §7's headline guarantee, and it needs its own pass.** Summing
  // alone lets a dead member hide: measured, a check examining 0 merged with one
  // examining 900 produced `examined: 900` and no finding — nine checks in
  // `check-corpus.mjs`, one of them with a `continue` planted at the top of its
  // loop, and the total still reads healthy. That is the plan's own top success
  // criterion, and the field failure proposal 009 records, reproduced inside the
  // primitive built to prevent it.
  //
  // A member is dead when it examined nothing, said nothing, and declared
  // nothing. One that carries its own finding has spoken; one that declared
  // empty has been accounted for.
  // A member that never RAN is not a dead check — it is an absent one, with no
  // denominator to be suspicious about. Excluding it is what keeps ONE disabled
  // rule from reddening a preset whose others examined plenty (measured:
  // `adrEnforcement` with `adr/valid-tiers` off). The all-off case still
  // reports: every member is then `notRun`, the sum is zero and nobody
  // declared, which the emitter's own gate catches downstream.
  // A member whose `notRun` contradicts its own evidence, checked HERE and not
  // only at the gate: the merged receipt carries no `notRun`, so a contradictory
  // member is invisible downstream — it would slip through the one door that
  // could see it. `notRun` is also the flag that exempts a member from the dead
  // filter below, so an unchecked one is a suppressor with no falsifier (the
  // asymmetry with `declaredEmpty` an enforcement review found in plan 0235).
  const contradictory = parts.find((p) => p.notRun === true && (p.examined > 0 || p.length > 0))
  if (contradictory !== undefined) {
    return collectResult(
      [...violations, contradictoryEvidenceViolation(contradictory.examined, contradictory.length)],
      { examined: parts.reduce((n, p) => n + p.examined, 0) },
    )
  }

  const dead = parts.filter(
    (p) =>
      p.examined === 0 &&
      p.length === 0 &&
      p.notRun !== true &&
      p.declaredEmpty !== true &&
      p.sourceEmpty !== true,
  )
  if (dead.length > 0 && parts.length > 1) {
    return collectResult([...violations, passWithoutEvidenceViolation()], {
      examined: parts.reduce((n, p) => n + p.examined, 0),
    })
  }
  const examined = parts.reduce((n, p) => n + p.examined, 0)
  const anySourceEmpty = parts.some((p) => p.sourceEmpty === true)
  return collectResult(violations, {
    examined,
    sourceEmpty: anySourceEmpty ? true : undefined,
    // **Only when the WHOLE verdict examined nothing.** A member's declaration
    // is about that member: `honestyAtClose` merges three rules and one of them
    // legitimately declares itself empty while the other two examine plenty.
    // Propagating that up marked the merged verdict declared-empty over a
    // non-zero total, and the emitter's expiry then fired on it — correctly,
    // which is how this was found. The member's own declaration is already
    // satisfied by its own zero; the merge has nothing to add.
    //
    // `every`, not `some`: one declared part must never vouch for a
    // hand-counted zero beside it.
    declaredEmpty:
      !anySourceEmpty &&
      examined === 0 &&
      parts.length > 0 &&
      parts.every((p) => p.declaredEmpty === true)
        ? true
        : undefined,
  })
}
