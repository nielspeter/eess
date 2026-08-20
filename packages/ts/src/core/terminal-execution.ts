import type { ArchViolation } from '@nielspeter/eess'
import type { RuleFacts } from './vacuity-diagnosis.js'
import {
  assertionLessFinding,
  deadSelectorFindings,
  evidenceFloor,
  expiredDeclarationViolation,
} from './vacuity-diagnosis.js'

/** A rule, reduced to what running it needs. */
export interface RuleRun {
  readonly facts: RuleFacts
  readonly expectsEmpty: boolean
  assertsSomething(): boolean
  ownsDiscoveryDiagnosis(): boolean
  collectViolations(): { violations: ArchViolation[]; examined: number }
}

/**
 * Run the rule, but let the gates speak first.
 *
 * Split from `TerminalBuilder` with the diagnoses it calls. The class kept the
 * ORDER of the gates — assertion, then dead selector, then the evidence floor —
 * tangled with the fluent surface that configures them; the order is the whole
 * content of this function and now reads as such.
 */
export function collectWithAssertionGuard(run: RuleRun): ArchViolation[] {
  if (run.assertsSomething()) {
    // Plan 0074 (R3b). AFTER the assertion gate, deliberately: a rule with a
    // dead glob AND no condition reports the missing assertion only, which is
    // the right root cause — no selector makes an assertion-less rule capable
    // of failing. The comment above already committed to that ordering; this
    // is the branch that honours it.
    //
    // Gate-first for a dead SELECTOR, before `collectViolations()`: a rule whose
    // selector cannot match will walk the whole AST to select nothing.
    //
    // But NOT gate-first for a dead **discovery** glob, and that asymmetry is
    // plan 0080's whole design. Admitting discovery globs to the gate without
    // it is destructive rather than additive: this early return means the gate
    // REPLACES a builder's own finding rather than adding to it, and the slice
    // builders already produce a better one (`emptyDiscoveryViolation`). Review
    // measured the cost of getting this wrong — **15 slice tests, 13 of them
    // the whole bug-0009 remedy corpus**, whose stated subject is that each
    // branch's advice is true. Trading a rule 1 defect for a rule 2 defect.
    //
    // So the owner **declares itself** — `ownsDiscoveryDiagnosis()` — rather than
    // the gate naming who to skip. An "except slice" list would be the same
    // unchecked claim about who owns what that this file used to carry in a
    // comment, and that comment being wrong is what plan 0080 exists to fix.
    // The precedent is `assertsCardinality()` directly above: knowledge lives
    // with the builder that has it.
    //
    // A first attempt derived it instead — run `collectViolations()` and prefer
    // any `bypassFilters` finding it produced. That cannot work, and slice is
    // the counterexample: for a **partially** empty `assignedFrom` it produces
    // nothing *deliberately* (a slice with no files yet is legitimate, and that
    // guard was withdrawn before release for firing on real projects). So
    // "prefer what it produced" reads silence as "no opinion" when it is in
    // fact the opinion.
    const dead = deadSelectorFindings(run.facts)
    if (dead.selector.length > 0) return dead.selector
    if (dead.discovery.length > 0 && !run.ownsDiscoveryDiagnosis()) return dead.discovery
    // Plan 0099: the floor. 0098 produced this evidence and discarded it here;
    // this is where discarding stops.
    const { violations, examined } = run.collectViolations()

    // ADR-010's floor: four branches that all answer one question — is a pass
    // here CONSTRUCTED from evidence, or defaulted? See `evidenceFloor`.
    const floor = evidenceFloor(run.facts, violations, examined)
    if (floor !== undefined) return floor

    // The expiry half, and it is the ROOT's alone — `rule-builder.ts` used to
    // carry its own, so keeping both double-reported one fault.
    //
    // `_expectEmpty`, NOT `declaresEmpty()`: `.notExist()` over a non-empty
    // selection is the condition doing its job, never an expired declaration,
    // and on `CorrespondenceBuilder` `declaresEmpty()` is an all-sides
    // conjunction whose per-side expiry that class reports itself.
    if (examined > 0 && run.expectsEmpty) {
      return [expiredDeclarationViolation(run.facts, examined), ...violations]
    }
    return violations
  }

  return assertionLessFinding(run.facts)
}
