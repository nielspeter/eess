import type { DeclaredGlobs } from './glob-site.js'

/**
 * Why a predicate cannot judge one subject (ADR-021): where the cause is, and what it is. The builder
 * that applies the predicate makes it a finding with the rule's context.
 */
export interface Undecided {
  readonly file: string
  readonly line: number
  /** What the finding names, e.g. `work/bugs/b.md:3,4`. Also the key `.excluding()` would match. */
  readonly element: string
  readonly message: string
}

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

  /**
   * Why this predicate cannot judge `element`, or nothing when it can (ADR-021).
   *
   * Optional, and declared only by a predicate that can fail to judge: a value read from a document
   * that gives it twice, for instance. A non-empty result makes the subject **undecided**: the kernel
   * neither selects it nor drops it, but reports each cause as an unsuppressable finding wherever the
   * rule's verdict depends on it, and a door that hands no findings back (`matchingElements`,
   * `.select()`) refuses. The combinators carry it in strong Kleene logic.
   *
   * **The contract for a predicate that declares it:** `test` is never called by the kernel on a
   * subject this reports, and a `test` called directly on one must throw rather than answer, so a
   * wrapper written by hand around `test` cannot drop it silently.
   *
   * Method syntax, as `test` is, on purpose: a function-typed property would make `Predicate<T>`
   * invariant in `T`, and builders that widen their predicates would stop compiling (measured in
   * spike 0485), with `this: void` so it can be passed around unbound. It takes no rule context, so a
   * producer can memoize it per subject.
   */
  undecided?(this: void, element: T): readonly Undecided[]
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
