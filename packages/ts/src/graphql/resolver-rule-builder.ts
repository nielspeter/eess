import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from '../core/violation.js'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { Predicate } from '@nielspeter/eess'
import { assertionLessViolation } from '@nielspeter/eess'
import { TerminalBuilder, type CollectResult } from '@nielspeter/eess'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import type { ArchFunction } from '../models/arch-function.js'
import { collectFunctions } from '../models/arch-function.js'
import {
  functionContain,
  functionNotContain,
  functionUseInsteadOf,
} from '../conditions/body-analysis-function.js'

/**
 * Predicate: filter to resolver functions for fields returning types matching the pattern.
 *
 * Heuristic: a resolver function is one whose name starts with an uppercase letter
 * (type name) or matches common resolver naming conventions. The return type is
 * checked against the pattern.
 *
 * @param pattern - Regex or string to match against the resolved return type text
 */
export function resolveFieldReturning(pattern: RegExp | string): Predicate<ArchFunction> {
  const desc = typeof pattern === 'string' ? `"${pattern}"` : String(pattern)
  return {
    description: `resolve field returning ${desc}`,
    test(fn: ArchFunction): boolean {
      const returnType = fn.getReturnType().getText()
      if (typeof pattern === 'string') {
        return returnType.includes(pattern)
      }
      return pattern.test(returnType)
    },
  }
}

/**
 * Fluent rule builder for GraphQL resolver architecture rules.
 *
 * Operates on TypeScript resolver files analyzed through the ArchFunction model.
 * Reuses the body analysis engine from plan 0011 for conditions like contain/notContain.
 *
 * @example
 * ```typescript
 * resolvers(p, 'src/resolvers/**')
 *   .that()
 *   .resolveFieldReturning(/^[A-Z]/)
 *   .should()
 *   .contain(call('loader.load'))
 *   .because('prevent N+1 queries')
 *   .check()
 * ```
 */
export class ResolverRuleBuilder extends TerminalBuilder {
  private _predicates: Predicate<ArchFunction>[] = []
  private _conditions: Condition<ArchFunction>[] = []

  constructor(private readonly sourceFiles: SourceFile[]) {
    super()
  }

  /**
   * Independent copy of `_predicates`/`_conditions` — see
   * `SliceRuleBuilder.copy()` for why this override is required: without it,
   * two branches derived from the same held selection via the inherited
   * `.because()`/`.excluding()`/`.rule()`/`.expectEmpty()` would share one
   * mutable array by reference.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._predicates = [...this._predicates]
    clone._conditions = [...this._conditions]
    return clone
  }

  // --- Predicate methods ---

  /**
   * Filter to resolver functions for fields returning types matching the pattern.
   */
  resolveFieldReturning(pattern: RegExp | string): this {
    const next = this.copy()
    next._predicates.push(resolveFieldReturning(pattern))
    return next
  }

  // --- Chain methods ---

  /**
   * Begin the predicate phase. Purely a readability marker.
   */
  that(): this {
    return this
  }

  /**
   * Add another predicate (AND).
   */
  and(): this {
    return this
  }

  /**
   * Begin the condition phase.
   */
  should(): this {
    return this
  }

  /**
   * Add another condition (AND).
   */
  andShould(): this {
    return this
  }

  // --- Condition methods (reuse body analysis) ---

  /**
   * Assert that the resolver body contains at least one match.
   */
  contain(matcher: ExpressionMatcher): this {
    const next = this.copy()
    next._conditions.push(functionContain(matcher))
    return next
  }

  /**
   * Assert that the resolver body does NOT contain any match.
   */
  notContain(matcher: ExpressionMatcher): this {
    const next = this.copy()
    next._conditions.push(functionNotContain(matcher))
    return next
  }

  /**
   * Assert: must NOT contain 'bad' AND must contain 'good'.
   */
  useInsteadOf(bad: ExpressionMatcher, good: ExpressionMatcher): this {
    const next = this.copy()
    next._conditions.push(functionUseInsteadOf(bad, good))
    return next
  }

  // --- Evaluation ---

  protected collectViolations(): CollectResult {
    const allElements = this.getElements()

    const filtered = allElements.filter((element) =>
      this._predicates.every((predicate) => predicate.test(element)),
    )

    if (filtered.length === 0) {
      // Deliberately not claiming sourceEmpty: `sourceFiles` is already a
      // glob-filtered list, so an empty result here is indistinguishable
      // from "the resolver glob legitimately matches nothing yet" (e.g.
      // mid-migration) versus "the project itself loaded nothing" — the
      // same ambiguity that broke JsxRuleBuilder's .notExist() case when
      // this was tried against getElements().length instead.
      return { violations: [], examined: 0 }
    }

    if (this._conditions.length === 0) {
      // Bug 0155 — a finding, not a warning. See the kernel's
      // `assertionLessViolation`.
      const ruleId = this._metadata?.id ?? this.buildRuleDescription()
      return {
        violations: [
          assertionLessViolation(ruleId, 'Add a condition after .should(), or delete the rule.'),
        ],
        examined: filtered.length,
      }
    }

    const context: ConditionContext = {
      rule: this.buildRuleDescription(),
      because: this._reason,
      ruleId: this._metadata?.id,
      suggestion: this._metadata?.suggestion,
      docs: this._metadata?.docs,
    }

    const violations: ArchViolation[] = []
    for (const condition of this._conditions) {
      violations.push(...condition.evaluate(filtered, context))
    }
    return { violations, examined: filtered.length }
  }

  private getElements(): ArchFunction[] {
    // Object-literal collection is opt-in for `functions()`, where turning it
    // on by default would flood every rule with inline callbacks. Here it is
    // the opposite: a GraphQL resolver map IS an object literal
    // (`{ Query: { assetCollection: async () => {} } }`), so without this the
    // builder named `resolvers()` selects the helper functions that happen to
    // sit beside the resolvers and none of the resolvers themselves — a real
    // schema shaped this way yields 0 resolvers found, and every rule written
    // against it then passes on the wrong subjects (ADR-008).
    return this.sourceFiles.flatMap((sf) =>
      collectFunctions(sf, { includeObjectLiteralFunctions: true }),
    )
  }

  private buildRuleDescription(): string {
    const predicateDesc = this._predicates.map((p) => p.description).join(' and ')
    const conditionDesc = this._conditions.map((c) => c.description).join(' and ')
    const parts: string[] = ['resolvers']
    if (predicateDesc) parts.push(`that ${predicateDesc}`)
    if (conditionDesc) parts.push(`should ${conditionDesc}`)
    return parts.join(' ')
  }
}
