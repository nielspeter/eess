/**
 * The assertion-less remedy, by state — bug 0155.
 *
 * A pure function of three facts about a rule, deliberately outside
 * `RuleBuilder`: the class is gated at 300 lines and 20 methods by this repo's
 * own `arch.internal.rules.ts`, and this capability pushed it over both. It is
 * also genuinely independent of the builder — three inputs, one string — so a
 * dialect builder with its own hierarchy can reuse it rather than reinvent the
 * wording.
 *
 * **Branches on `reachedShould`/`misplaced`, never on the builder's phase:**
 * `.should().that()` lands back in the predicate phase having reached
 * `.should()`, and any phase-derived message would tell that author a
 * verifiable falsehood.
 */
// eess-exclude eess/no-unused-exports: parameter type of the exported assertionAdviceFor() API (must stay exported for declaration emit)
export interface AssertionState {
  /** Whether `.should()` was ever reached. */
  readonly reachedShould: boolean
  /** Descriptions of predicate-only methods written after `.should()`. */
  readonly misplaced: readonly string[]
  /** How many conditions the rule actually carries. */
  readonly conditionCount: number
}

export function assertionAdviceFor(state: AssertionState): string {
  if (!state.reachedShould) {
    return (
      'This rule never reached .should(), so it asserts nothing and can never fail. ' +
      'Add .should() and a condition, or delete the rule.'
    )
  }
  if (state.misplaced.length > 0) {
    const names = state.misplaced.map((d) => `"${d}"`).join(', ')
    const one = state.misplaced.length === 1
    const verb = one ? 'is a predicate, which filters' : 'are predicates, which filter'
    const it = one ? 'it' : 'them'
    // Two faults, two remedies. With conditions present the rule is not
    // "asserting nothing" in the reader's sense — it asserts something over a
    // set the misplaced predicate silently shrank. Telling this author to
    // "add a condition" would name a fix that leaves the rule as broken.
    if (state.conditionCount > 0) {
      return (
        `This rule's ${names} ${verb} subjects rather than asserting anything about them, ` +
        `and ${one ? 'it comes' : 'they come'} after .should() — so ${it} narrowed the ` +
        "selection this rule's conditions are evaluated over, and if that narrowed it to " +
        `nothing the conditions hold vacuously. Move ${it} before .should(), where the ` +
        'filtering is explicit.'
      )
    }
    return (
      `This rule asserts nothing: ${names} ${verb} subjects rather than asserting ` +
      `anything about them. Move ${it} before .should(), then add a condition.`
    )
  }
  return (
    'This rule reached .should() but no condition follows, so it asserts nothing and can ' +
    'never fail. Add a condition after .should() — or, if this rule is generated from ' +
    'configuration, skip generating it when there is nothing to assert.'
  )
}
