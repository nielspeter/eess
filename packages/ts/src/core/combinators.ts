import type { Predicate } from '@nielspeter/eess'
import type { TypeMatcher } from './type-matcher.js'
import {
  combineGlobs,
  negateGlobs,
  assertHomogeneous as kernelAssertHomogeneous,
} from '@nielspeter/eess/internal'

/**
 * Negates a predicate or type matcher.
 *
 * Accepts both `Predicate<T>` objects (used in `.that()` chains) and
 * `TypeMatcher` functions (used in `.should()` condition arguments).
 *
 * @example
 * // Negate a predicate:
 * functions(p).that().satisfy(not(areAsync())).should()...
 *
 * // Negate a type matcher:
 * .should().haveReturnTypeMatching(not(matching(/void/)))
 */
export function not<T>(input: Predicate<T>): Predicate<T>
export function not(input: TypeMatcher): TypeMatcher
export function not<T>(input: Predicate<T> | TypeMatcher): Predicate<T> | TypeMatcher {
  if (typeof input === 'function') {
    return (type) => !input(type)
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

/** The kernel's, with this dialect's noun for the function kind. */
function assertHomogeneous<T>(inputs: (Predicate<T> | TypeMatcher)[]): void {
  kernelAssertHomogeneous(inputs, 'TypeMatcher')
}

/**
 * Combines predicates or type matchers with AND logic.
 *
 * All inputs must be the same kind: either all `Predicate<T>` or all
 * `TypeMatcher`. Requires at least one argument.
 *
 * @example
 * // Combine predicates:
 * functions(p).that().satisfy(and(areAsync(), areExported())).should()...
 *
 * // Combine type matchers:
 * .should().haveReturnTypeMatching(and(matching(/Promise/), not(matching(/void/))))
 */
export function and<T>(...predicates: Predicate<T>[]): Predicate<T>
export function and(...matchers: TypeMatcher[]): TypeMatcher
export function and<T>(...inputs: (Predicate<T> | TypeMatcher)[]): Predicate<T> | TypeMatcher {
  return combine(inputs, 'all')
}

/**
 * Combines predicates or type matchers with OR logic.
 *
 * All inputs must be the same kind: either all `Predicate<T>` or all
 * `TypeMatcher`. Requires at least one argument.
 *
 * @example
 * // Combine predicates:
 * functions(p).that().satisfy(or(areAsync(), areExported())).should()...
 *
 * // Combine type matchers:
 * .should().haveReturnTypeMatching(or(matching(/Promise/), matching(/Collection/)))
 */
export function or<T>(...predicates: Predicate<T>[]): Predicate<T>
export function or(...matchers: TypeMatcher[]): TypeMatcher
export function or<T>(...inputs: (Predicate<T> | TypeMatcher)[]): Predicate<T> | TypeMatcher {
  return combine(inputs, 'any')
}

/**
 * The body `and()` and `or()` share — see the kernel's `combine()`, which this
 * mirrors for `TypeMatcher`. Three choices must agree (quantifier, joining
 * word, glob node) and deriving all three from `op` is what makes a mismatch
 * unreachable: pairing `some` with an `'all'` glob node reports a live selector
 * as dead.
 */
function combine<T>(
  inputs: (Predicate<T> | TypeMatcher)[],
  op: 'all' | 'any',
): Predicate<T> | TypeMatcher {
  assertHomogeneous(inputs)
  const holds = <X>(xs: readonly X[], f: (x: X) => boolean): boolean =>
    op === 'all' ? xs.every(f) : xs.some(f)

  if (typeof inputs[0] === 'function') {
    const matchers = inputs.filter((input): input is TypeMatcher => typeof input === 'function')
    const fn: TypeMatcher = (type) => holds(matchers, (m) => m(type))
    return fn
  }
  const predicates = inputs.filter((input): input is Predicate<T> => typeof input !== 'function')
  return {
    description: predicates.map((p) => p.description).join(op === 'all' ? ' and ' : ' or '),
    test: (element: T) => holds(predicates, (p) => p.test(element)),
    globs: combineGlobs(
      op,
      predicates.map((p) => p.globs),
    ),
  }
}
