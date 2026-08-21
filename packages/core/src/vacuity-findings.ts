import type { ArchViolation } from './violation.js'
import type { RuleDescription } from './rule-description.js'

/**
 * What a rule can be asked about itself, without running it.
 *
 * Every finding here is a function of these three and nothing else — none of
 * them evaluates the rule. That is what let them leave `TerminalBuilder`: they
 * were never terminal behaviour, they were explanations OF it.
 */
export interface RuleFacts {
  /** The builder's own class, for naming the rule in a finding. */
  readonly ruleClass: { name: string }
  readonly reason: string | undefined
  describeRule(): RuleDescription
}

/**
 * The configuration finding for a rule that examined zero units with no
 * declared exemption — ADR-009 rule 2: named as a distinct cause (dead
 * selector, empty corpus, or an unreachable examining seam), not folded
 * into an ordinary violation message.
 */
export function zeroExaminedViolation(facts: RuleFacts): ArchViolation {
  const described = facts.describeRule()
  const name = described.id ?? described.rule ?? facts.ruleClass.name
  const message =
    `this rule examined zero units. If this is expected (the corpus is legitimately ` +
    `empty right now), declare it explicitly with .expectEmpty() — otherwise this is a ` +
    `dead selector, an empty project, or a rule that never reaches its own examining ` +
    `seam, and the fix is to widen the selection, not to suppress this finding.`
  return {
    rule: described.rule ?? name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message,
    suggestion: message,
    because: facts.reason,
    bypassFilters: true,
  }
}

/**
 * The configuration finding for a rule that examined zero units BECAUSE one
 * of its declared globs is diagnosably dead — `deadGlob` is the pre-formed
 * reason a dialect's `RuleBuilder.deadGlobDiagnosis()` computed (a typo, an
 * unanchored pattern, a directory glob pointed at a file — whatever the
 * dialect's own glob-evaluation determined). Strictly more actionable than
 * `zeroExaminedViolation()`'s generic message, which this replaces when a
 * diagnosis is available; see `evidencedViolations()`.
 */
export function deadGlobViolation(facts: RuleFacts, deadGlob: string): ArchViolation {
  const described = facts.describeRule()
  const name = described.id ?? described.rule ?? facts.ruleClass.name
  const message = `this rule examined zero units — ${deadGlob}`
  return {
    rule: described.rule ?? name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message,
    suggestion: message,
    because: facts.reason,
    bypassFilters: true,
  }
}

/**
 * The configuration finding for a `.expectNonEmpty()` declaration that
 * wasn't met — the corpus the author said should never be empty is empty
 * right now. Overrides `assertsCardinality()`'s silent pass on purpose:
 * the declaration is a stronger, caller-level claim than what the
 * condition itself would otherwise tolerate.
 */
export function unmetExpectNonEmptyViolation(facts: RuleFacts): ArchViolation {
  const described = facts.describeRule()
  const name = described.id ?? described.rule ?? facts.ruleClass.name
  const message =
    `this rule declared .expectNonEmpty() but examined zero units — the corpus this ` +
    `rule asserted should never be empty is empty right now. If that's still true, fix ` +
    `the selection (a glob typo, a missing folder); if the corpus legitimately can be ` +
    `empty, remove .expectNonEmpty().`
  return {
    rule: described.rule ?? name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message,
    suggestion: message,
    because: facts.reason,
    bypassFilters: true,
  }
}

/**
 * The configuration finding for the ADR-010 part 3 precedence case: the
 * family's own upstream source loaded nothing at all — a stronger claim
 * than an ordinary dead selector, and worded accordingly (the fix is not
 * "widen the selection", there is no selection yet to widen).
 */
export function zeroLoadedSourceViolation(facts: RuleFacts): ArchViolation {
  const described = facts.describeRule()
  const name = described.id ?? described.rule ?? facts.ruleClass.name
  const message =
    `this rule's source loaded zero units before any selection ran — an empty project, ` +
    `an unreadable tsconfig, or a glob resolving to nothing. This outranks any ` +
    `.expectEmpty() declaration and any condition satisfied by emptiness: fix the ` +
    `project/source configuration, not the rule.`
  return {
    rule: described.rule ?? name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message,
    suggestion: message,
    because: facts.reason,
    bypassFilters: true,
  }
}

/**
 * The configuration finding for a `.expectEmpty()` declaration that has
 * expired — ADR-010 part 3: the number IS the finding, so it is named.
 */
export function expiredExpectEmptyViolation(facts: RuleFacts, examined: number): ArchViolation {
  const described = facts.describeRule()
  const name = described.id ?? described.rule ?? facts.ruleClass.name
  const message =
    `this rule declared .expectEmpty() but examined ${String(examined)} unit(s) — the ` +
    `declaration has expired. If the corpus legitimately grew past empty, remove ` +
    `.expectEmpty() from this rule; the underlying violations (if any) above still stand.`
  return {
    rule: described.rule ?? name,
    ruleId: described.id,
    element: name,
    file: '',
    line: 0,
    message,
    suggestion: message,
    because: facts.reason,
    bypassFilters: true,
  }
}
