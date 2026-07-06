import type { ArchProject } from '../core/project.js'
import type { Condition } from '@nielspeter/eess'
import { RuleBuilder } from '@nielspeter/eess'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import {
  functionContain,
  functionNotContain,
  functionUseInsteadOf,
  functionNotHaveEmptyBody,
} from '../conditions/body-analysis-function.js'
import type { ArchFunction } from '../models/arch-function.js'
import { collectFunctions } from '../models/arch-function.js'
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
export class FunctionRuleBuilder extends RuleBuilder<ArchFunction, ArchProject> {
  protected getElements(): ArchFunction[] {
    return this.project.getSourceFiles().flatMap((sf) => collectFunctions(sf))
  }

  // --- Identity predicates (delegated to plan 0003 generics) ---

  /**
   * After `.that()`: filter functions whose name matches the pattern.
   * After `.should()`: assert matched functions have names matching the pattern.
   */
  haveNameMatching(pattern: RegExp | string): this {
    if (this._phase === 'condition') {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
      return this.addCondition(fnConditionHaveNameMatching(regex))
    }
    return this.addPredicate(identityHaveNameMatching<ArchFunction>(pattern))
  }

  /** Filter to functions whose name starts with the given prefix. */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith<ArchFunction>(prefix))
  }

  /** Filter to functions whose name ends with the given suffix. */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith<ArchFunction>(suffix))
  }

  /**
   * After `.that()`: filter functions in a file matching the glob.
   * After `.should()`: assert functions reside in a file matching the glob.
   */
  resideInFile(glob: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(fnConditionResideInFile(glob))
    }
    return this.addPredicate(identityResideInFile<ArchFunction>(glob))
  }

  /**
   * After `.that()`: filter functions in a folder matching the glob.
   * After `.should()`: assert functions reside in a folder matching the glob.
   */
  resideInFolder(glob: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(fnConditionResideInFolder(glob))
    }
    return this.addPredicate(identityResideInFolder<ArchFunction>(glob))
  }

  /** Filter to functions that are exported from their module. */
  areExported(): this {
    return this.addPredicate(identityAreExported<ArchFunction>())
  }

  /** Filter to functions that are NOT exported from their module. */
  areNotExported(): this {
    return this.addPredicate(identityAreNotExported<ArchFunction>())
  }

  // --- Visibility predicates (plan 0032) ---

  /**
   * Filter to public functions. Class methods match when `public` or
   * unmarked; standalone and arrow functions are always public.
   */
  arePublic(): this {
    return this.addPredicate(fnArePublic())
  }

  /** Filter to `protected` class methods (standalone functions never match). */
  areProtected(): this {
    return this.addPredicate(fnAreProtected())
  }

  /** Filter to `private` class methods (standalone functions never match). */
  arePrivate(): this {
    return this.addPredicate(fnArePrivate())
  }

  // --- Function-specific predicates ---

  /** Filter to functions declared with the `async` keyword. */
  areAsync(): this {
    return this.addPredicate(fnAreAsync())
  }

  /** Filter to functions NOT declared `async`. */
  areNotAsync(): this {
    return this.addPredicate(fnAreNotAsync())
  }

  /** Filter to functions that declare exactly `n` parameters. */
  haveParameterCount(n: number): this {
    return this.addPredicate(fnHaveParameterCount(n))
  }

  /** Filter to functions that declare more than `n` parameters. */
  haveParameterCountGreaterThan(n: number): this {
    return this.addPredicate(fnHaveParameterCountGreaterThan(n))
  }

  /** Filter to functions that declare fewer than `n` parameters. */
  haveParameterCountLessThan(n: number): this {
    return this.addPredicate(fnHaveParameterCountLessThan(n))
  }

  /** Filter to functions that declare a parameter with the given exact name. */
  haveParameterNamed(name: string): this {
    return this.addPredicate(fnHaveParameterNamed(name))
  }

  /**
   * Filter to functions whose return type text matches the pattern
   * (e.g. `/Promise</`, `'void'`). A string is compiled to a RegExp.
   */
  haveReturnType(pattern: RegExp | string): this {
    return this.addPredicate(fnHaveReturnType(pattern))
  }

  /** Filter to functions that declare a rest parameter (`...args`). */
  haveRestParameter(): this {
    return this.addPredicate(fnHaveRestParameter())
  }

  /** Filter to functions with at least one optional (`x?`) or default-valued parameter. */
  haveOptionalParameter(): this {
    return this.addPredicate(fnHaveOptionalParameter())
  }

  /**
   * Filter to functions whose parameter at `index` has a type satisfying
   * the matcher. Out-of-bounds indices never match; for a rest parameter
   * the type is the array type (e.g. `string[]`).
   */
  haveParameterOfType(index: number, matcher: TypeMatcher): this {
    return this.addPredicate(fnHaveParameterOfType(index, matcher))
  }

  /** Filter to functions with at least one parameter whose name matches the regex. */
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
export function functions(p: ArchProject): FunctionRuleBuilder {
  return new FunctionRuleBuilder(p)
}
