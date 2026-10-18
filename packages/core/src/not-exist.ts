import { marksAssertsCardinality } from './cardinality.js'
import type { Condition, ConditionContext } from './condition.js'
import type { ArchViolation } from './violation.js'

/** How a dialect names and reports one element that should not exist. */
export interface NotExistOptions<T> {
  /**
   * How the message names the element: `class Foo`, `work/plans/0001-x.md`.
   * Takes the context because eess-ts's `calls()` names a call by
   * `ctx.identifyByArgument`.
   */
  readonly name: (element: T, ctx: ConditionContext) => string
  /** The dialect's own constructor, so its finding's shape survives. */
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

/**
 * The one `notExist` condition (proposal 017, decision 4): every selected
 * element is a finding, and an empty selection satisfies it. Marked as
 * asserting cardinality, which freezes it (bug 0462), so the kernel exempts an
 * empty selection unless the dialect reports a selector fault (bug 0460).
 */
export function notExistCondition<T>(opts: NotExistOptions<T>): Condition<T> {
  return marksAssertsCardinality({
    description: 'not exist',
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] =>
      elements.map((e) => opts.toViolation(e, `${opts.name(e, ctx)} should not exist`, ctx)),
  })
}
