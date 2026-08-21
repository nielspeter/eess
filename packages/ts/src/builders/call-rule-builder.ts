import type { ArchProject } from '../core/project.js'
import { RuleBuilder } from '../core/rule-builder.js'
import type { ConditionContext } from '@nielspeter/eess'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import type { ArchCall } from '../models/arch-call.js'
import { collectCalls } from '../models/arch-call.js'
import { createElementCache, SOLE_POPULATION } from '../core/element-cache.js'

/** One collection per project, shared by every rule built from it (plan 0075). */
const cache = createElementCache<ArchCall>()
import {
  haveNameMatching as identityHaveNameMatching,
  haveNameStartingWith as identityHaveNameStartingWith,
  haveNameEndingWith as identityHaveNameEndingWith,
  resideInFile as identityResideInFile,
  resideInFolder as identityResideInFolder,
} from '../predicates/identity.js'
import {
  onObject as callOnObject,
  withMethod as callWithMethod,
  withArgMatching as callWithArgMatching,
  withStringArg as callWithStringArg,
} from '../predicates/call.js'
import {
  haveCallbackContaining as conditionHaveCallbackContaining,
  notHaveCallbackContaining as conditionNotHaveCallbackContaining,
  notExist as callNotExist,
  haveArgumentWithProperty as conditionHaveArgumentWithProperty,
  notHaveArgumentWithProperty as conditionNotHaveArgumentWithProperty,
  haveArgumentContaining as conditionHaveArgumentContaining,
  notHaveArgumentContaining as conditionNotHaveArgumentContaining,
} from '../conditions/call.js'

/**
 * Rule builder for call-expression-level architecture rules.
 *
 * Operates on CallExpression nodes across all source files,
 * wrapped in the ArchCall model for uniform predicate access.
 *
 * @example
 * ```typescript
 * // All Express route handlers must call handleError()
 * calls(project)
 *   .that().onObject('app')
 *   .and().withMethod(/^(get|post|put|delete|patch)$/)
 *   .should().haveCallbackContaining(call('handleError'))
 *   .because('unhandled errors crash the server')
 *   .check()
 *
 * // No route may call db.query() directly
 * calls(project)
 *   .that().onObject('app')
 *   .and().withMethod(/^(get|post|put|delete|patch)$/)
 *   .should().notHaveCallbackContaining(call('db.query'))
 *   .because('use repository methods instead')
 *   .check()
 *
 * // Select specific routes by path pattern
 * calls(project)
 *   .that().onObject('router')
 *   .and().withMethod('get')
 *   .and().withStringArg(0, '/api/users/**')
 *   .should().haveCallbackContaining(call('authenticate'))
 *   .check()
 * ```
 */
export class CallRuleBuilder extends RuleBuilder<ArchCall> {
  /**
   * Argument index to fold into the violation element/message. Set by
   * `.identifiedByArg(index)`. Threaded into `ConditionContext.identifyByArgument`
   * so the eight `archCall.getName()` sites in `src/conditions/call.ts`
   * can build identity-keyed violation strings.
   *
   * Survives a copy via `shallowClone` in `TerminalBuilder.copy` (a primitive
   * field, so no `copy()` override is needed). See plan 0057.
   */
  protected _identifyByArgument?: number

  protected getElements(): ArchCall[] {
    return cache.get(this.project, SOLE_POPULATION, () =>
      this.project.getSourceFiles().flatMap(collectCalls),
    )
  }

  protected override buildConditionContext(): ConditionContext {
    return {
      ...super.buildConditionContext(),
      identifyByArgument: this._identifyByArgument,
    }
  }

  // --- Identity predicates (subset: no areExported/areNotExported) ---

  /**
   * Narrows the selection to call expressions that have a name matching `pattern`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameMatching(pattern: RegExp | string): this {
    return this.addPredicate(identityHaveNameMatching<ArchCall>(pattern))
  }

  /**
   * Narrows the selection to call expressions that have a name starting with `prefix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith<ArchCall>(prefix))
  }

  /**
   * Narrows the selection to call expressions that have a name ending with `suffix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith<ArchCall>(suffix))
  }

  /**
   * Narrows the selection to call expressions that reside in a file matching `glob`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  resideInFile(glob: string): this {
    return this.addPredicate(identityResideInFile<ArchCall>(glob))
  }

  /**
   * Narrows the selection to call expressions that reside in a folder matching `glob`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  resideInFolder(glob: string): this {
    return this.addPredicate(identityResideInFolder<ArchCall>(glob))
  }

  // Note: areExported() and areNotExported() are intentionally omitted.
  // Call expressions cannot are exported. See spec section 5.1.

  // --- Call-specific predicates ---

  /**
   * Narrows the selection to call expressions that are called on the object `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  onObject(name: string): this {
    return this.addPredicate(callOnObject(name))
  }

  /**
   * Narrows the selection to call expressions that call a method matching `nameOrRegex`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  withMethod(nameOrRegex: string | RegExp): this {
    return this.addPredicate(callWithMethod(nameOrRegex))
  }

  /**
   * Narrows the selection to call expressions that have argument `index` matching `pattern`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  withArgMatching(index: number, pattern: string | RegExp): this {
    return this.addPredicate(callWithArgMatching(index, pattern))
  }

  /**
   * Narrows the selection to call expressions that have string argument `index` matching `glob`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  withStringArg(index: number, glob: string): this {
    return this.addPredicate(callWithStringArg(index, glob))
  }

  // --- Identity enrichment ---

  /**
   * Fold the indexed argument's source text into the violation
   * `element` and `message`, so identity-keyed registrations (HTTP
   * routes, event handlers, registry entries, etc.) can be excluded
   * individually rather than only by file.
   *
   * When the indexed argument is a `StringLiteral` or
   * `NoSubstitutionTemplateLiteral`, the violation reads
   * `` `${callee}(${rawText})` `` (e.g. `app.post("/auth/token")`).
   * Otherwise (template with substitutions, `as const`, parenthesized,
   * identifier, spread, out-of-bounds, non-string literal) it degrades
   * gracefully to the bare `${callee}` form.
   *
   * **Identity scope — predicates see the bare callee.** This method
   * affects violation output and `.excluding()` matching only;
   * predicates that read `archCall.getName()` (e.g. `haveNameMatching`,
   * `haveNameStartingWith`) continue to see the bare `app.post`. To
   * filter by argument value, use `.withStringArg(i, glob)` or
   * `.withArgMatching(i, pattern)`.
   *
   * @example Filtering by path AND naming each violation by path:
   * ```ts
   * calls(p).that()
   *   .onObject('app').withMethod(/^(get|post)$/)
   *   .withStringArg(0, '/auth/**')     // filter: only /auth routes
   *   .identifiedByArg(0)                // identity: name violations by path
   *   .should().haveArgumentWithProperty('preHandler')
   *   .excluding(/"\/auth\/(login|register)"/)
   *   .check()
   * ```
   *
   * @example Footgun — predicates do NOT see the enriched name:
   * ```ts
   * // This produces ZERO violations regardless of source — the
   * // predicate sees bare "app.post", which never matches the regex.
   * calls(p).that()
   *   .haveNameMatching(/app\.post\("\/auth/)   // <-- never matches
   *   .identifiedByArg(0)
   *   .should()...
   * ```
   *
   * See proposal 011 / plan 0057 for the full design, the 8-case
   * generic-pattern table, and the edge-case behavior matrix.
   *
   * @param index — zero-based argument index to fold into the identity.
   */
  identifiedByArg(index: number): this {
    const next = this.copy()
    next._identifyByArgument = index
    return next
  }

  // --- Condition methods ---

  /**
   * Assert that the call's callback argument(s) contain a match.
   */
  haveCallbackContaining(matcher: ExpressionMatcher): this {
    return this.addCondition(conditionHaveCallbackContaining(matcher))
  }

  /**
   * Assert that the call's callback argument(s) do NOT contain a match.
   */
  notHaveCallbackContaining(matcher: ExpressionMatcher): this {
    return this.addCondition(conditionNotHaveCallbackContaining(matcher))
  }

  /**
   * The filtered call set must be empty.
   */
  notExist(): this {
    return this.addCondition(callNotExist())
  }

  /**
   * Assert that at least one object literal argument has ALL named properties.
   */
  haveArgumentWithProperty(...names: string[]): this {
    return this.addCondition(conditionHaveArgumentWithProperty(...names))
  }

  /**
   * Assert that NO object literal argument has ANY of the named properties.
   */
  notHaveArgumentWithProperty(...names: string[]): this {
    return this.addCondition(conditionNotHaveArgumentWithProperty(...names))
  }

  /**
   * Assert that at least one argument subtree contains a match.
   *
   * Searches ALL arguments recursively — a superset of `haveCallbackContaining`.
   * Use `haveCallbackContaining` when you only want to search callback bodies.
   */
  haveArgumentContaining(matcher: ExpressionMatcher): this {
    return this.addCondition(conditionHaveArgumentContaining(matcher))
  }

  /**
   * Assert that NO argument subtree contains a match.
   *
   * Searches ALL arguments recursively — a superset of `notHaveCallbackContaining`.
   * Use `notHaveCallbackContaining` when you only want to search callback bodies.
   */
  notHaveArgumentContaining(matcher: ExpressionMatcher): this {
    return this.addCondition(conditionNotHaveArgumentContaining(matcher))
  }

  // --- Public accessors (used by plan 0015 within()) ---

  /**
   * Get the ArchCall elements that match the current predicate chain.
   * Used by within() to extract callbacks from matched calls.
   */
  getMatchedCalls(): ArchCall[] {
    return this.getElements().filter((archCall) => this._predicates.every((p) => p.test(archCall)))
  }
}

/**
 * Entry point for call-expression architecture rules.
 *
 * Scans all source files in the project for CallExpression nodes
 * and wraps them in ArchCall for predicate/condition evaluation.
 *
 * @example
 * ```typescript
 * import { project, calls, call } from '@nielspeter/eess-ts'
 *
 * const p = project('tsconfig.json')
 *
 * calls(p)
 *   .that().onObject('app').and().withMethod('get')
 *   .should().haveCallbackContaining(call('authenticate'))
 *   .check()
 * ```
 */
export function calls(p: ArchProject): CallRuleBuilder {
  return new CallRuleBuilder(p)
}
