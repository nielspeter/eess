import type { ArchViolation } from './violation.js'
import type { DeclaredGlobs } from './glob-site.js'

/**
 * Context passed to conditions during evaluation.
 *
 * Provides the rule description and optional rationale so that
 * violations can include meaningful error messages.
 */
export interface ConditionContext {
  /** Human-readable rule description assembled from the fluent chain */
  rule: string
  /** Optional rationale provided via .because() */
  because?: string
  /** Unique rule identifier from .rule({ id }) */
  ruleId?: string
  /** Actionable fix suggestion from .rule({ suggestion }) */
  suggestion?: string
  /** Link to documentation from .rule({ docs }) */
  docs?: string
  /**
   * Index of the call argument to fold into the violation element/message.
   *
   * Read by `calls()` conditions in `src/conditions/call.ts` when building
   * violations — threaded into `archCall.getName({ withArgument: ... })`
   * so identity-keyed registrations (HTTP routes, event handlers,
   * registry entries, etc.) can be excluded individually rather than
   * only by file. See proposal 011 / plan 0057.
   *
   * Conditions for other builder types (class, function, module, JSX,
   * etc.) simply ignore this field — it's a `calls()`-specific concern
   * placed on the shared context because abstraction cost would exceed
   * the leak for one optional primitive.
   */
  identifyByArgument?: number
}

/**
 * A condition that evaluates filtered elements and returns violations.
 *
 * Conditions receive the elements that passed predicate filtering.
 * They return violations for elements that DON'T satisfy the condition.
 *
 * Most conditions check each element individually. Some (like notExist)
 * check the entire set.
 */
export interface Condition<T> {
  /** Human-readable description of what this condition checks */
  readonly description: string

  /**
   * Evaluate elements against this condition.
   *
   * @param elements - The filtered elements (after predicates)
   * @param context - Rule description and rationale
   * @returns Violations for elements that don't satisfy the condition
   */
  evaluate(elements: T[], context: ConditionContext): ArchViolation[]

  /**
   * The path globs this condition matches against, if any. See
   * `Predicate.globs` — same contract, stamped with `position: 'condition'`.
   */
  readonly globs?: DeclaredGlobs
}

/**
 * Run every condition over the selected elements, carrying the evidence.
 *
 * `examined` is the count the conditions were actually HANDED — not the
 * pre-predicate population — and that distinction is the reason this is shared
 * rather than written per builder. `graphql/resolver-rule-builder.ts` records
 * what happened when two sibling builders derived it separately: one counted
 * pre-predicate and the other post, and a chain whose `.that()` selected nothing
 * reported 14 units examined, handed its conditions 0, and passed green with
 * `diagnose()` silent. That is the fail-open cell ADR-009 exists to close.
 *
 * The zero-element early exit is stated rather than implied by an empty
 * violation list (plan 0098): `{ violations: [], examined: 0 }` is the
 * zero-evidence case, and ADR-010 wants it said out loud.
 */
export function evaluateConditions<T>(
  elements: T[],
  conditions: readonly Condition<T>[],
  context: ConditionContext,
): { violations: ArchViolation[]; examined: number } {
  if (elements.length === 0) return { violations: [], examined: 0 }
  const violations: ArchViolation[] = []
  for (const condition of conditions) {
    violations.push(...condition.evaluate(elements, context))
  }
  return { violations, examined: elements.length }
}
