import type { ArchViolation } from './violation.js'
import { UNSUPPRESSABLE } from './unsuppressable.js'

/**
 * The emitter's own configuration findings — [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md).
 *
 * **Why these are not in `vacuity-findings.ts`.** Every finding there is built by
 * `configFinding(facts, message)`, which reads its `ruleId` from
 * `facts.describeRule()`. At the emitter there is no rule to describe: the value
 * arrived from a preset, a loop, or a hand-assembled array, and the whole point
 * of ADR-014 is that the emitter must speak about values it did not mint.
 *
 * That is not a stylistic difference, it is bug 0190's cause. The kernel's
 * previous preset finding took `(presetName, optionsHint)` and carried **no
 * `ruleId`**, so nothing could assert on it and no non-vacuity fixture could key
 * on it — a finding no test could name is a finding no one can prove fires. It
 * had no call site and was deleted rather than wired (plan 0235 Phase 0). These
 * two carry **hardcoded, stable ids**, and they are the first hardcoded rule ids
 * in the kernel for exactly that reason.
 *
 * **Why two and not one.** ADR-014 §4 separates them, and the remedies differ:
 *
 * - `emitter/no-receipt` — the value carried no evidence field at all. A shape
 *   defect. The remedy ("hand over what the pipeline minted") is real on every
 *   path, including one where the run was perfectly healthy.
 * - `emitter/pass-without-evidence` — the value carried evidence, and it says
 *   zero examined with zero violations and no declaration. A vacuous pass. The
 *   remedy is about the selection, not the shape.
 *
 * Folding them into one id would make the fixture for either satisfiable by the
 * other, which is the discrimination failure `check:nonvacuity` exists to catch.
 *
 * **What the kernel may say.** ADR-014 §4 is explicit that the kernel "never
 * names a preset's options at a seam that may not be a preset": a preset that
 * constructed zero rules owns its own remedy and names it before handing over.
 * So these messages speak only about the value and the loop that produced it —
 * the vocabulary any hand-assembler can act on.
 *
 * **`expectEmpty` is not an exception to that, it is the reason for the rule's
 * shape.** It lives on the KERNEL's own `PresetReportOptions`, so naming it
 * names this package's surface rather than a dialect's — and a product review
 * found the vacuous-pass message, the one most likely to red an adopter's
 * build, told them to "declare the set legitimately empty" without saying how.
 * A remedy an author cannot act on is ADR-009 rule 2's failure, and it sends
 * them to the one escape the message forbids in its next clause.
 */

/** The value handed to an emitter carried no evidence field at all. */
export const EMITTER_NO_RECEIPT = 'emitter/no-receipt'

/** Zero examined, zero violations, no declaration — a pass built from nothing. */
export const EMITTER_PASS_WITHOUT_EVIDENCE = 'emitter/pass-without-evidence'

/**
 * A declaration that has expired: declared empty, then examined something.
 *
 * **This is what makes a declaration legitimate at all.** ADR-010 §3 admits
 * `.expectEmpty()` precisely because it "fails the day it stops being true" —
 * a claim that can never be contradicted is not an assertion, and the whole
 * 2026-09-05 amendment to ADR-014 §3 turns on that property. Without this
 * finding the emitter would accept a declaration nothing can ever falsify,
 * which is the shape that amendment refused for `overrides: 'off'`.
 */
export const EMITTER_EXPIRED_DECLARATION = 'emitter/expired-declaration'

/**
 * A receipt that claims it never ran, and carries evidence that it did.
 *
 * **The falsifier `notRun` was shipped without.** `declaredEmpty` has one — the
 * expiry above — and that property is the entire reason ADR-010 §3 admits a
 * declaration at all. `notRun` suppresses too: it is the one condition that
 * excludes a member from `mergeCollectResults`'s dead-member filter, so a zero
 * marked `notRun` is a zero the merge will not complain about. A suppressor with
 * no contradiction is exactly the shape ADR-014 §3's amendment refuses, and
 * shipping one inside the change that establishes the rule is the defect an
 * enforcement review caught here.
 *
 * A rule that never ran examined nothing and found nothing. Both halves are
 * checked, because either alone is a lie the other does not cover: `examined > 0`
 * is a denominator that could not exist, and a violation is a finding that could
 * not have been produced.
 */
export const EMITTER_CONTRADICTORY_EVIDENCE = 'emitter/contradictory-evidence'

/**
 * Every id this module can produce.
 *
 * One list, because there were two: `report.ts` had a four-way `||` and
 * `dedupe-config-findings.ts` grew a second `Set` of the same four. Both are
 * private, neither knew about the other, and a fifth id added to one and not the
 * other silently reintroduces the defect the second was written to fix — N
 * distinct dead builders collapsing into one finding annotated "they are one
 * edit". The argument for naming the constants rather than testing an `emitter/`
 * prefix only holds if there is ONE place to add the next one.
 *
 * Internal: exported for the kernel's own consumers, not on the root surface.
 */
export const EMITTER_IDS: ReadonlySet<string> = new Set([
  EMITTER_NO_RECEIPT,
  EMITTER_PASS_WITHOUT_EVIDENCE,
  EMITTER_EXPIRED_DECLARATION,
  EMITTER_CONTRADICTORY_EVIDENCE,
])

/** Is this one of the emitter's own findings, as opposed to a caller's? */
export function isEmitterFinding(violation: { ruleId?: string; rule?: string }): boolean {
  return EMITTER_IDS.has(violation.ruleId ?? violation.rule ?? '')
}

/**
 * Shared shape. `file: ''` / `line: 0` for the same reason `vacuity-findings.ts`
 * uses them: the fault is the verdict, not a place in anyone's code.
 * `bypassFilters` because a suppression mechanism that can suppress the
 * complaint about itself is not a mechanism.
 */
function emitterFinding(ruleId: string, message: string): ArchViolation {
  return {
    rule: ruleId,
    ruleId,
    element: ruleId,
    file: '',
    line: 0,
    message,
    suggestion: `${message} ${UNSUPPRESSABLE}`,
    bypassFilters: true,
  }
}

/**
 * A value reached an emitter with no evidence at all — a bare array, or an
 * object with no `examined`.
 *
 * This fires even when the run was healthy and found real violations, because
 * the defect is that the verdict cannot be checked, not that it is wrong. That
 * is deliberate: a shape that *sometimes* carries evidence is a shape nobody can
 * rely on, and the one path where it matters most is the path where the loop
 * examined nothing.
 */
export function noReceiptViolation(): ArchViolation {
  return emitterFinding(
    EMITTER_NO_RECEIPT,
    'this verdict arrived with no evidence of what was examined, so eess cannot tell a ' +
      'clean run from a loop that never ran. Hand the emitter what the pipeline minted — ' +
      "a builder's violations(), or a preset's result — rather than an array assembled by hand. " +
      // Naming the call, because the audience changed. This message was written
      // for someone calling `finishPreset([])` directly; since plan 0263 Phase 2
      // it is also what a rule-file author meets, and THEIR builder is the thing
      // returning the array — so "hand the emitter a builder's violations()"
      // describes what they already did. The changeset's migration line was the
      // actionable one and lived only in the changelog. `collectResult` and
      // `mergeCollectResults` are kernel root exports, re-exported by the
      // dialects, so naming them costs an adopter no second install.
      'If you are writing the builder: return collectResult(violations, { examined }) ' +
      'instead of a plain array, where `examined` is how many units you actually ' +
      'looked at. If you are combining builders, use mergeCollectResults([...]).',
  )
}

/**
 * A pass with evidence that proves nothing: zero examined, zero violations, no
 * declaration.
 *
 * The remedy names the selection, never a preset's options — ADR-014 §4.
 */
export function passWithoutEvidenceViolation(): ArchViolation {
  return emitterFinding(
    EMITTER_PASS_WITHOUT_EVIDENCE,
    'this verdict reports success over zero examined units: the loop reached its ' +
      'assertion no times, so nothing was checked and the pass certifies nothing. Widen ' +
      'the selection, or — if the set is legitimately empty — declare it: ' +
      "expectEmpty: true in a preset's report options, .expectEmpty() on a builder. " +
      'The declaration expires the day the subject appears, which is why it is not a ' +
      'mute button. Do not suppress this.',
  )
}

/**
 * The declaration was true when written and is not true now.
 *
 * The mirror of the terminal's own `expiredExpectEmptyViolation`, at the seam a
 * preset's declaration reaches (ADR-014 §3). The number IS the finding, so it
 * is named.
 */
export function expiredDeclarationViolation(examined: number): ArchViolation {
  return emitterFinding(
    EMITTER_EXPIRED_DECLARATION,
    `this verdict was declared empty but examined ${String(examined)} unit(s) — the ` +
      'declaration has expired. If the set legitimately grew past empty, remove the ' +
      'declaration; the violations above (if any) still stand.',
  )
}

/**
 * `notRun` beside evidence of a run.
 *
 * The mirror of {@link expiredDeclarationViolation} for the third state. The
 * numbers ARE the finding, so both are named: a caller debugging this needs to
 * know which half contradicted the flag.
 */
export function contradictoryEvidenceViolation(
  examined: number,
  violations: number,
): ArchViolation {
  return emitterFinding(
    EMITTER_CONTRADICTORY_EVIDENCE,
    `this verdict is marked as never having run, but examined ${String(examined)} unit(s) ` +
      `and carries ${String(violations)} violation(s) — a rule that did not run can have ` +
      'neither. Drop the notRun flag if the rule ran, or drop the evidence if it did not; ' +
      'notRun exists for a rule turned off, not for one whose result you want quiet.',
  )
}
