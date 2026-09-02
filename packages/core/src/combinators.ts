import type { Predicate } from './predicate.js'
import { combineGlobs, negateGlobs } from './glob-site.js'

/**
 * A function that tests a value against a condition.
 *
 * Dialect-independent generalization of a matcher. The TS dialect's
 * `TypeMatcher = (type: Type) => boolean` is structurally a `Matcher<Type>`, so
 * it composes with `not`/`and`/`or` without the kernel knowing about ts-morph.
 */
export type Matcher<V> = (value: V) => boolean

/**
 * Negates a predicate or matcher.
 *
 * Accepts both `Predicate<T>` objects (used in `.that()` chains) and
 * `Matcher<V>` functions (e.g. type matchers used in `.should()` arguments).
 *
 * @example
 * // Negate a predicate:
 * functions(p).that(not(areAsync())).should()...
 *
 * // Negate a type matcher:
 * .should().haveReturnTypeMatching(not(matching(/void/)))
 */
export function not<T>(input: Predicate<T>): Predicate<T>
export function not<V>(input: Matcher<V>): Matcher<V>
export function not<T, V>(input: Predicate<T> | Matcher<V>): Predicate<T> | Matcher<V> {
  if (typeof input === 'function') {
    return (value: V) => !input(value)
  }
  return {
    description: `not (${input.description})`,
    test: (element: T) => !input.test(element),
    // Negation-normal-form push-down: `op` inverts as well as `polarity`.
    // `not(unsatisfiable)` selects everything, so a negated site is
    // over-selection rather than vacuity and can never be a fault — but a
    // `not` nested inside the subtree flips it back, which is why this cannot
    // just flip polarity. See `negateGlobs`.
    globs: input.globs && negateGlobs(input.globs),
  }
}

/**
 * Every input to `and()`/`or()` must be the same kind.
 *
 * `eess-ts` carried a byte-identical copy — `no-copy-paste` reported it at
 * 100%, with only the noun in the message differing — so the noun is now the
 * parameter and the check has one owner.
 *
 * A `TypeError` and not a filtered result: mixing an object predicate with a
 * matcher function silently drops one kind (the implementations below filter
 * by `typeof`), so a rule composed that way would narrow by half of what its
 * author wrote and pass on the rest. Refusing at composition time is the only
 * point where the mistake is still visible.
 */
export function assertHomogeneous<T, V>(
  inputs: (Predicate<T> | Matcher<V>)[],
  matcherNoun = 'Matcher',
): void {
  if (inputs.length === 0) return
  const firstIsFunction = typeof inputs[0] === 'function'
  if (inputs.some((i) => (typeof i === 'function') !== firstIsFunction)) {
    throw new TypeError(`Cannot mix Predicate objects and ${matcherNoun} functions in and()/or()`)
  }
}

/**
 * Combines predicates or matchers with AND logic.
 *
 * All inputs must be the same kind: either all `Predicate<T>` or all
 * `Matcher<V>`. Requires at least one argument.
 *
 * @example
 * // Combine predicates:
 * functions(p).that(and(areAsync(), areExported())).should()...
 *
 * // Combine type matchers:
 * .should().haveReturnTypeMatching(and(matching(/Promise/), not(matching(/void/))))
 */
export function and<T>(...predicates: Predicate<T>[]): Predicate<T>
export function and<V>(...matchers: Matcher<V>[]): Matcher<V>
export function and<T, V>(...inputs: (Predicate<T> | Matcher<V>)[]): Predicate<T> | Matcher<V> {
  assertHomogeneous(inputs)
  if (typeof inputs[0] === 'function') {
    const matchers = inputs.filter((input): input is Matcher<V> => typeof input === 'function')
    const fn: Matcher<V> = (value) => matchers.every((m) => m(value))
    return fn
  }
  const predicates = inputs.filter((input): input is Predicate<T> => typeof input !== 'function')
  return {
    description: predicates.map((p) => p.description).join(' and '),
    test: (element: T) => predicates.every((p) => p.test(element)),
    // A conjunction selects nothing as soon as ONE input does.
    globs: combineGlobs(
      'all',
      predicates.map((p) => p.globs),
    ),
  }
}

/**
 * Combines predicates or matchers with OR logic.
 *
 * All inputs must be the same kind: either all `Predicate<T>` or all
 * `Matcher<V>`. Requires at least one argument.
 *
 * @example
 * // Combine predicates:
 * functions(p).that(or(areAsync(), areExported())).should()...
 *
 * // Combine type matchers:
 * .should().haveReturnTypeMatching(or(matching(/Promise/), matching(/Collection/)))
 */
export function or<T>(...predicates: Predicate<T>[]): Predicate<T>
export function or<V>(...matchers: Matcher<V>[]): Matcher<V>
export function or<T, V>(...inputs: (Predicate<T> | Matcher<V>)[]): Predicate<T> | Matcher<V> {
  assertHomogeneous(inputs)
  if (typeof inputs[0] === 'function') {
    const matchers = inputs.filter((input): input is Matcher<V> => typeof input === 'function')
    return (value) => matchers.some((m) => m(value))
  }
  const predicates = inputs.filter((input): input is Predicate<T> => typeof input !== 'function')
  return {
    description: predicates.map((p) => p.description).join(' or '),
    test: (element: T) => predicates.some((p) => p.test(element)),
    // A disjunction selects nothing only when EVERY input does. Inputs that
    // declare no globs become retained opaque children rather than being
    // dropped — dropping them here is what would red `or(deadGlob, byName)`.
    globs: combineGlobs(
      'any',
      predicates.map((p) => p.globs),
    ),
  }
}
