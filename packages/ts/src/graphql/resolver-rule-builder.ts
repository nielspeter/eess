import type { SourceFile } from 'ts-morph'
import type { Predicate } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import type { GlobNode } from '@nielspeter/eess'
import { stampGlobs } from '@nielspeter/eess/internal'
import { globAnyOf } from '@nielspeter/eess'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import type { ArchFunction } from '../models/arch-function.js'
import { collectFunctions } from '../models/arch-function.js'
import {
  functionContain,
  functionNotContain,
  functionUseInsteadOf,
} from '../conditions/body-analysis-function.js'
import { GraphqlRuleBuilder } from './graphql-rule-builder.js'

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
export class ResolverRuleBuilder extends GraphqlRuleBuilder<ArchFunction> {
  /**
   * @param sourceFiles - The resolver files, already filtered by `resolvers()`.
   * @param glob - The glob they were filtered by, for diagnostics only.
   *
   * `glob` is **optional** because this class is re-exported from the public
   * `./graphql` subpath, so its constructor is public API and a required
   * second parameter would break anyone constructing it directly — which
   * would make R2a a breaking release, and R2a is the one people install in
   * order to measure before R3. `resolvers()` always passes it.
   *
   * Threading it at all is the point: `resolvers()` filters eagerly and hands
   * this builder only the surviving files, so without the glob string no
   * `globs()` could ever report `resolvers(p, 'src/reslvers/**')` — the rule
   * would silently examine zero resolvers and pass.
   */
  constructor(
    private readonly sourceFiles: SourceFile[],
    private readonly glob?: string,
    private readonly project?: ArchProject,
  ) {
    super()
  }

  /** The project this rule was built against. See `RuleBuilder.getProject`. */
  getProject(): ArchProject | undefined {
    return this.project
  }

  /**
   * The discovery glob, if `resolvers()` supplied it.
   *
   * `tsconfig-relative` is load-bearing, not cosmetic: it is what exempts this
   * glob from the anchor check, because `resolvers(p, 'src/resolvers/**')` — the
   * spelling in this class's own example — is correct as written. Declared
   * `'absolute'` it would be reported unanchored, telling the author to break a
   * working rule.
   */
  override globs(): readonly GlobNode[] {
    if (this.glob === undefined) return []
    return [
      stampGlobs(
        globAnyOf([this.glob], 'file-path', 'tsconfig-relative'),
        'discovery',
        (g) => `resolvers(p, "${g.glob}")`,
      ),
    ]
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

  /**
   * This family counts resolvers — the resolver functions it selected.
   *
   * Plan 0099: `CollectResult.examined` is unit-typed per family (ADR-009 part
   * 1), and the zero-examined message prints the noun. Inheriting the base
   * `'subjects'` is a category error in a sentence whose whole job is naming what
   * was and was not looked at.
   */
  protected override examinedUnitNoun(): string {
    return 'resolvers'
  }

  protected override descriptionSubject(): string {
    return 'resolvers'
  }

  protected override conditionExamples(): string {
    return 'contain(...), notContain(...) or useInsteadOf(...)'
  }

  protected override getElements(): ArchFunction[] {
    // Object-literal collection is opt-in for `functions()`, where turning it on
    // by default would flood every rule with inline callbacks. Here it is the
    // opposite: a GraphQL resolver map IS an object literal
    // (`{ Query: { assetCollection: async () => {} } }`), so without this the
    // builder named `resolvers()` selects the helper functions that happen to
    // sit beside the resolvers and none of the resolvers themselves — measured
    // on a real schema as 60 subjects, 0 of them resolvers. Every rule written
    // against it then passes on the wrong subjects (ADR-008).
    return this.sourceFiles.flatMap((sf) =>
      collectFunctions(sf, { includeObjectLiteralFunctions: true }),
    )
  }
}
