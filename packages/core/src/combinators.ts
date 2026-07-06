import type { Predicate } from './predicate.js'

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
  }
}

function assertHomogeneous<T, V>(inputs: (Predicate<T> | Matcher<V>)[]): void {
  if (inputs.length === 0) return
  const firstIsFunction = typeof inputs[0] === 'function'
  if (inputs.some((i) => (typeof i === 'function') !== firstIsFunction)) {
    throw new TypeError('Cannot mix Predicate objects and Matcher functions in and()/or()')
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
  }
}
