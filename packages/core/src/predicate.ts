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
   * Declaring them lets the builder answer "can this rule ever have subjects?"
   * without running it (plan 0069). Optional: a predicate that matches on
   * something other than a path — a name, a decorator, a type — declares
   * nothing and is treated as opaque, which is never a fault.
   *
   * Leaves are `DeclaredGlob`, so a predicate cannot claim a `position`; the
   * builder stamps that on according to where the predicate was registered.
   */
  readonly globs?: DeclaredGlobs

  /**
   * What to call this predicate's globs in a **configuration finding**, when
   * the call the user made is not the call the predicate makes.
   *
   * Plan 0074, the second consequence of 0069's appendix item 4: presets must
   * thread the option name into the site's origin (`shared: "…"`, not
   * `resideInFolder("…")`), or the message names a call the user never made.
   *
   * A preset option is one name that expands to several predicates —
   * `shared: ['…']` becomes `atPath()`, which is `or(resideInFile,
   * resideInFolder)`. Measured before this existed, the finding read "This
   * rule's selector reside in file matching … or reside in folder matching …
   * can never match anything", naming two calls the author never wrote and
   * omitting the option they did.
   *
   * Deliberately **not** `description`, which is overloaded: that renders the
   * human-readable rule text, and rewriting it would change every violation
   * message the preset produces, not just the configuration finding.
   */
  readonly originLabel?: string
}

/**
 * Record a predicate on a builder, noting it if it arrived after `.should()`.
 *
 * A free function for the same reason as `recordExclusions` and
 * `selectMatching`: the two builders sit in incompatible hierarchies, so there
 * is no common base to hold a method. The copies were 94% similar and differed
 * only in comment wording and braces — no behaviour.
 *
 * `phase` is read, never written: recording a misplaced predicate is a
 * diagnosis, not a state change.
 */
export function recordPredicate<T>(
  predicate: Predicate<T>,
  predicates: Predicate<T>[],
  misplaced: string[],
  phase: string,
): void {
  predicates.push(predicate)
  // Bug 0155 state 2: a predicate-only method used after `.should()`. Dual-use
  // methods dispatch to conditions in that phase and never reach here, so this is
  // a filter written where an assertion was meant — the one state whose fix is
  // "move it before .should()", not "add a condition".
  if (phase === 'condition') misplaced.push(predicate.description)
}
