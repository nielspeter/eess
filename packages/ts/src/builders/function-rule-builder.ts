import type { ArchProject } from '../core/project.js'
import type { Condition } from '@nielspeter/eess'
import { RuleBuilder } from '../core/rule-builder.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import {
  functionContain,
  functionNotContain,
  functionUseInsteadOf,
  functionNotHaveEmptyBody,
} from '../conditions/body-analysis-function.js'
import type { ArchFunction } from '../models/arch-function.js'
import { createElementCache, SOLE_POPULATION } from '../core/element-cache.js'
import { collectFunctions, type FunctionCollectionOptions } from '../models/arch-function.js'
import { followPattern as followPatternCondition } from '../conditions/pattern.js'
import type { ArchPattern } from '../helpers/pattern.js'
import {
  notExist as fnNotExist,
  beExported as fnBeExported,
  beAsync as fnBeAsync,
  haveNameMatching as fnConditionHaveNameMatching,
  acceptParameterOfType as fnAcceptParameterOfType,
  notAcceptParameterOfType as fnNotAcceptParameterOfType,
  haveReturnTypeMatching as fnHaveReturnTypeMatching,
  resideInFile as fnConditionResideInFile,
  resideInFolder as fnConditionResideInFolder,
} from '../conditions/function.js'
import {
  haveNameMatching as identityHaveNameMatching,
  haveNameStartingWith as identityHaveNameStartingWith,
  haveNameEndingWith as identityHaveNameEndingWith,
  resideInFile as identityResideInFile,
  resideInFolder as identityResideInFolder,
  areExported as identityAreExported,
  areNotExported as identityAreNotExported,
} from '../predicates/identity.js'
import type { TypeMatcher } from '../helpers/type-matchers.js'
import {
  arePublic as fnArePublic,
  areProtected as fnAreProtected,
  arePrivate as fnArePrivate,
  areAsync as fnAreAsync,
  areNotAsync as fnAreNotAsync,
  haveParameterCount as fnHaveParameterCount,
  haveParameterCountGreaterThan as fnHaveParameterCountGreaterThan,
  haveParameterCountLessThan as fnHaveParameterCountLessThan,
  haveParameterNamed as fnHaveParameterNamed,
  haveReturnType as fnHaveReturnType,
  haveRestParameter as fnHaveRestParameter,
  haveOptionalParameter as fnHaveOptionalParameter,
  haveParameterOfType as fnHaveParameterOfType,
  haveParameterNameMatching as fnHaveParameterNameMatching,
} from '../predicates/function.js'

/** One collection per (project, collection options), shared by every rule (plan 0075). */
const cache = createElementCache<ArchFunction>()

/**
 * A canonical key for a collection-options object.
 *
 * Derived from the object's own entries, sorted — **not** `JSON.stringify`,
 * which is key-order dependent, and not a hand-written list of the two fields,
 * which would silently drop a third field added later and serve the wrong
 * population under a colliding key.
 */
function optionsKey(options?: FunctionCollectionOptions): string {
  if (options === undefined) return SOLE_POPULATION
  return Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${String(value)}`)
    .join('|')
}

/**
 * Rule builder for function-level architecture rules.
 *
 * Operates on both FunctionDeclarations and const arrow functions,
 * unified through the ArchFunction model.
 *
 * @example
 * ```typescript
 * // All parseXxxOrder functions should not exist
 * functions(project)
 *   .that().haveNameMatching(/^parse\w+Order$/)
 *   .should(notExist())
 *   .because('use shared parseOrder() utility instead')
 *   .check()
 *
 * // No function should have more than 5 parameters
 * functions(project)
 *   .that().haveParameterCountGreaterThan(5)
 *   .should(notExist())
 *   .because('functions with many parameters are hard to use')
 *   .check()
 *
 * // All exported async functions should have names starting with a verb
 * functions(project)
 *   .that().areExported().and().areAsync()
 *   .should().haveNameMatching(/^(get|find|create|update|delete|fetch|load|save)/)
 *   .because('async functions should use verb prefixes')
 *   .check()
 * ```
 */
export class FunctionRuleBuilder extends RuleBuilder<ArchFunction> {
  constructor(
    project: ArchProject,
    private readonly _collectionOptions?: FunctionCollectionOptions,
  ) {
    super(project)
  }

  protected getElements(): ArchFunction[] {
    // _collectionOptions survives `.should()` forks via RuleBuilder.fork()'s
    // shallowClone in TerminalBuilder.copy — verified by the named-selection test.
    //
    // The options are part of the cache key, not just the collection call:
    // `functions(p)` and `functions(p, COLLECT_ALL)` are DIFFERENT populations
    // of the same project, so a project-only key would serve one the other's
    // elements (plan 0075).
    return cache.get(this.project, optionsKey(this._collectionOptions), () =>
      this.project.getSourceFiles().flatMap((sf) => collectFunctions(sf, this._collectionOptions)),
    )
  }

  // --- Identity predicates (delegated to plan 0003 generics) ---

  /**
   * After `.that()`: filter functions whose name matches the pattern.
   * After `.should()`: assert matched functions have names matching the pattern.
   */
  haveNameMatching(pattern: RegExp | string): this {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    return this.dualUse(
      fnConditionHaveNameMatching(regex),
      identityHaveNameMatching<ArchFunction>(pattern),
    )
  }

  /**
   * Narrows the selection to functions that have a name starting with `prefix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith<ArchFunction>(prefix))
  }

  /**
   * Narrows the selection to functions that have a name ending with `suffix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith<ArchFunction>(suffix))
  }

  /**
   * After `.that()`: filter functions in a file matching the glob.
   * After `.should()`: assert functions reside in a file matching the glob.
   */
  resideInFile(glob: string): this {
    return this.dualUse(fnConditionResideInFile(glob), identityResideInFile<ArchFunction>(glob))
  }

  /**
   * After `.that()`: filter functions in a folder matching the glob.
   * After `.should()`: assert functions reside in a folder matching the glob.
   */
  resideInFolder(glob: string): this {
    return this.dualUse(fnConditionResideInFolder(glob), identityResideInFolder<ArchFunction>(glob))
  }

  /**
   * Narrows the selection to functions that are exported.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areExported(): this {
    return this.addPredicate(identityAreExported<ArchFunction>())
  }

  /**
   * Narrows the selection to functions that are not exported.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areNotExported(): this {
    return this.addPredicate(identityAreNotExported<ArchFunction>())
  }

  // --- Visibility predicates (plan 0032) ---

  /**
   * Narrows the selection to functions that are public.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  arePublic(): this {
    return this.addPredicate(fnArePublic())
  }

  /**
   * Narrows the selection to functions that are protected.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areProtected(): this {
    return this.addPredicate(fnAreProtected())
  }

  /**
   * Narrows the selection to functions that are private.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  arePrivate(): this {
    return this.addPredicate(fnArePrivate())
  }

  // --- Function-specific predicates ---

  /**
   * Narrows the selection to functions that are async.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areAsync(): this {
    return this.addPredicate(fnAreAsync())
  }

  /**
   * Narrows the selection to functions that are not async.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areNotAsync(): this {
    return this.addPredicate(fnAreNotAsync())
  }

  /**
   * Narrows the selection to functions that have exactly `n` parameters.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterCount(n: number): this {
    return this.addPredicate(fnHaveParameterCount(n))
  }

  /**
   * Narrows the selection to functions that have more than `n` parameters.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterCountGreaterThan(n: number): this {
    return this.addPredicate(fnHaveParameterCountGreaterThan(n))
  }

  /**
   * Narrows the selection to functions that have fewer than `n` parameters.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterCountLessThan(n: number): this {
    return this.addPredicate(fnHaveParameterCountLessThan(n))
  }

  /**
   * Narrows the selection to functions that have a parameter named `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterNamed(name: string): this {
    return this.addPredicate(fnHaveParameterNamed(name))
  }

  /**
   * Narrows the selection to functions that have a return type matching `pattern`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveReturnType(pattern: RegExp | string): this {
    return this.addPredicate(fnHaveReturnType(pattern))
  }

  /**
   * Narrows the selection to functions that have a rest parameter.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveRestParameter(): this {
    return this.addPredicate(fnHaveRestParameter())
  }

  /**
   * Narrows the selection to functions that have an optional parameter.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveOptionalParameter(): this {
    return this.addPredicate(fnHaveOptionalParameter())
  }

  /**
   * Narrows the selection to functions that have parameter `index` of a type matching `matcher`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterOfType(index: number, matcher: TypeMatcher): this {
    return this.addPredicate(fnHaveParameterOfType(index, matcher))
  }

  /**
   * Narrows the selection to functions that have a parameter name matching `pattern`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveParameterNameMatching(pattern: RegExp): this {
    return this.addPredicate(fnHaveParameterNameMatching(pattern))
  }

  // --- Condition methods ---

  /**
   * Register a condition. Public API for passing standalone conditions
   * (like notExist(), beExported()) into the builder chain.
   */
  withCondition(condition: Condition<ArchFunction>): this {
    return this.addCondition(condition)
  }

  /**
   * The filtered function set must be empty.
   */
  notExist(): this {
    return this.addCondition(fnNotExist())
  }

  /**
   * Functions must be exported from their module.
   */
  beExported(): this {
    return this.addCondition(fnBeExported())
  }

  /**
   * Functions must be async.
   */
  beAsync(): this {
    return this.addCondition(fnBeAsync())
  }

  /** @deprecated Use `haveNameMatching()` after `.should()` instead. */
  conditionHaveNameMatching(pattern: RegExp): this {
    return this.addCondition(fnConditionHaveNameMatching(pattern))
  }

  // --- Parameter type condition methods (plan 0031) ---

  /**
   * Assert that at least one parameter has a type matching the given matcher.
   *
   * **Scope note:** Scans only the function's own parameter list.
   * Unlike the class-level counterpart, does NOT scan set accessors
   * because `collectFunctions()` excludes them.
   */
  acceptParameterOfType(matcher: TypeMatcher): this {
    return this.addCondition(fnAcceptParameterOfType(matcher))
  }

  /**
   * Assert that NO parameter has a type matching the given matcher.
   * Reports one violation per matching parameter.
   *
   * **Scope note:** Scans only the function's own parameter list.
   * Unlike the class-level counterpart, does NOT scan set accessors
   * because `collectFunctions()` excludes them.
   */
  notAcceptParameterOfType(matcher: TypeMatcher): this {
    return this.addCondition(fnNotAcceptParameterOfType(matcher))
  }

  // --- Return type condition (plan 0033) ---

  /**
   * Assert that the function's return type satisfies the given TypeMatcher.
   *
   * Uses TypeMatcher for composability with `isString()`, `matching()`,
   * `not()`, `exactly()`, etc.
   *
   * @example
   * functions(project)
   *   .that().haveNameMatching(/^list/)
   *   .should().haveReturnTypeMatching(matching(/Collection/))
   *   .check()
   */
  haveReturnTypeMatching(matcher: TypeMatcher): this {
    return this.addCondition(fnHaveReturnTypeMatching(matcher))
  }

  // --- Body analysis condition methods (plan 0011) ---

  /**
   * Assert that the function body contains at least one match.
   */
  contain(matcher: ExpressionMatcher): this {
    return this.addCondition(functionContain(matcher))
  }

  /**
   * Assert that the function body does NOT contain any match.
   * Produces one violation per matching node found.
   */
  notContain(matcher: ExpressionMatcher): this {
    return this.addCondition(functionNotContain(matcher))
  }

  /**
   * Assert: must NOT contain 'bad' AND must contain 'good'.
   * Better violation messages than combining notContain + contain separately.
   */
  useInsteadOf(bad: ExpressionMatcher, good: ExpressionMatcher): this {
    return this.addCondition(functionUseInsteadOf(bad, good))
  }

  /**
   * Assert that matched functions do not have empty bodies.
   * Expression-bodied arrows always pass (no block body).
   */
  notHaveEmptyBody(): this {
    return this.addCondition(functionNotHaveEmptyBody())
  }

  /**
   * Assert that matched functions follow an architectural pattern.
   *
   * Checks that return types contain all properties defined in
   * the pattern's returnShape with matching types.
   */
  followPattern(pattern: ArchPattern): this {
    return this.addCondition(followPatternCondition(pattern))
  }
}

/**
 * Entry point for function-level architecture rules.
 *
 * Scans all source files in the project for both FunctionDeclarations
 * and const arrow functions (VariableDeclaration with ArrowFunction initializer).
 *
 * @example
 * ```typescript
 * import { project, functions } from '@nielspeter/eess-ts'
 *
 * const p = project('tsconfig.json')
 *
 * // All parseXxxOrder functions should not exist
 * functions(p)
 *   .that().haveNameMatching(/^parse\w+Order$/)
 *   .should(notExist())
 *   .because('use shared parseOrder() utility instead')
 *   .check()
 * ```
 */
export function functions(
  p: ArchProject,
  options?: FunctionCollectionOptions,
): FunctionRuleBuilder {
  return new FunctionRuleBuilder(p, options)
}
