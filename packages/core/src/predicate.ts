import type { DeclaredGlobs } from './glob-site.js'

/**
 * A predicate that tests whether an architectural element matches a condition.
 * Used in `.that()` clauses to filter elements before rule evaluation.
 */
export interface Predicate<T> {
  /** Human-readable description for violation messages, e.g. "have name matching /^parse/" */
  readonly description: string
  /** Returns true if the element matches this predicate. */
  test(element: T): boolean
  /**
   * The path globs this predicate matches against, if any.
   *
   * `RuleBuilder.globs()` walks every predicate/condition's own declaration —
   * this field is how a glob-matching predicate (`resideInFolder`,
   * `resideInFile`, …) makes itself visible to the dead-glob diagnosis this
   * `.globs()` result feeds. A predicate with no glob (`haveNameMatching`, a
   * regex test) simply omits it.
   */
  readonly globs?: DeclaredGlobs
}
