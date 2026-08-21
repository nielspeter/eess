import type { ArchProject } from '../core/project.js'
import { RuleBuilder } from '../core/rule-builder.js'
import type { ArchJsxElement } from '../models/arch-jsx-element.js'
import { createElementCache, SOLE_POPULATION } from '../core/element-cache.js'
import { collectJsxElements } from '../models/arch-jsx-element.js'
import {
  haveNameMatching as identityHaveNameMatching,
  haveNameStartingWith as identityHaveNameStartingWith,
  haveNameEndingWith as identityHaveNameEndingWith,
  resideInFile as identityResideInFile,
  resideInFolder as identityResideInFolder,
} from '../predicates/identity.js'
import {
  areHtmlElements as jsxAreHtmlElements,
  areComponents as jsxAreComponents,
  withAttribute as jsxWithAttribute,
  withAttributeMatching as jsxWithAttributeMatching,
} from '../predicates/jsx.js'
import {
  notExist as jsxNotExist,
  haveAttribute as conditionHaveAttribute,
  notHaveAttribute as conditionNotHaveAttribute,
  haveAttributeMatching as conditionHaveAttributeMatching,
  notHaveAttributeMatching as conditionNotHaveAttributeMatching,
} from '../conditions/jsx.js'

/** One collection per project, shared by every rule built from it (plan 0075). */
const cache = createElementCache<ArchJsxElement>()

/**
 * Rule builder for JSX element architecture rules.
 *
 * Operates on JsxElement and JsxSelfClosingElement nodes across all .tsx/.jsx
 * source files, wrapped in the ArchJsxElement model for uniform predicate access.
 *
 * Uses **distinct names** for predicates vs conditions on attributes:
 * - Predicates (`.that()` phase): `withAttribute`, `withAttributeMatching`
 * - Conditions (`.should()` phase): `haveAttribute`, `notHaveAttribute`,
 *   `haveAttributeMatching`, `notHaveAttributeMatching`
 *
 * @example
 * ```typescript
 * // No raw <button> — use design system components
 * jsxElements(project)
 *   .that().areHtmlElements('button', 'input', 'select')
 *   .should().notExist()
 *   .because('use design system components instead of raw HTML')
 *   .check()
 *
 * // Every <img> must have alt
 * jsxElements(project)
 *   .that().areHtmlElements('img')
 *   .should().haveAttribute('alt')
 *   .because('images must have alt text for accessibility')
 *   .check()
 *
 * // Elements with onClick must have aria-label
 * jsxElements(project)
 *   .that().withAttribute('onClick')
 *   .should().haveAttribute('aria-label')
 *   .check()
 * ```
 */
export class JsxRuleBuilder extends RuleBuilder<ArchJsxElement> {
  protected getElements(): ArchJsxElement[] {
    return cache.get(this.project, SOLE_POPULATION, () =>
      this.project.getSourceFiles().flatMap(collectJsxElements),
    )
  }

  // --- Identity predicates (predicate-only, following CallRuleBuilder pattern) ---

  /**
   * Narrows the selection to JSX elements that have a name matching `pattern`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameMatching(pattern: RegExp | string): this {
    return this.addPredicate(identityHaveNameMatching<ArchJsxElement>(pattern))
  }

  /**
   * Narrows the selection to JSX elements that have a name starting with `prefix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith<ArchJsxElement>(prefix))
  }

  /**
   * Narrows the selection to JSX elements that have a name ending with `suffix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith<ArchJsxElement>(suffix))
  }

  /**
   * Narrows the selection to JSX elements that reside in a file matching `glob`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  resideInFile(glob: string): this {
    return this.addPredicate(identityResideInFile<ArchJsxElement>(glob))
  }

  /**
   * Narrows the selection to JSX elements that reside in a folder matching `glob`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  resideInFolder(glob: string): this {
    return this.addPredicate(identityResideInFolder<ArchJsxElement>(glob))
  }

  // --- JSX-specific predicates ---

  /**
   * Narrows the selection to JSX elements that are the HTML elements named in `tags`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areHtmlElements(...tags: string[]): this {
    return this.addPredicate(jsxAreHtmlElements(...tags))
  }

  /**
   * Narrows the selection to JSX elements that are the components named in `names`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areComponents(...names: string[]): this {
    return this.addPredicate(jsxAreComponents(...names))
  }

  /**
   * Narrows the selection to JSX elements that have the attribute `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  withAttribute(name: string): this {
    return this.addPredicate(jsxWithAttribute(name))
  }

  /**
   * Narrows the selection to JSX elements that have attribute `name` with a value matching `value`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  withAttributeMatching(name: string, value: string | RegExp): this {
    return this.addPredicate(jsxWithAttributeMatching(name, value))
  }

  // --- Condition methods ---

  /**
   * The filtered JSX element set must be empty.
   */
  notExist(): this {
    return this.addCondition(jsxNotExist())
  }

  /**
   * Every matched element must have the named attribute.
   */
  haveAttribute(name: string): this {
    return this.addCondition(conditionHaveAttribute(name))
  }

  /**
   * No matched element may have the named attribute.
   */
  notHaveAttribute(name: string): this {
    return this.addCondition(conditionNotHaveAttribute(name))
  }

  /**
   * Every matched element must have the named attribute matching the value.
   */
  haveAttributeMatching(name: string, value: string | RegExp): this {
    return this.addCondition(conditionHaveAttributeMatching(name, value))
  }

  /**
   * No matched element may have the named attribute matching the value.
   */
  notHaveAttributeMatching(name: string, value: string | RegExp): this {
    return this.addCondition(conditionNotHaveAttributeMatching(name, value))
  }
}

/**
 * Entry point for JSX element architecture rules.
 *
 * Scans all .tsx/.jsx source files in the project for JsxElement and
 * JsxSelfClosingElement nodes and wraps them in ArchJsxElement for
 * predicate/condition evaluation.
 *
 * @example
 * ```typescript
 * import { project, jsxElements, STANDARD_HTML_TAGS } from '@nielspeter/eess-ts'
 *
 * const p = project('tsconfig.json')
 *
 * // Ban raw HTML form elements
 * jsxElements(p)
 *   .that().areHtmlElements('button', 'input', 'select')
 *   .should().notExist()
 *   .check()
 *
 * // Every <img> must have alt
 * jsxElements(p)
 *   .that().areHtmlElements('img')
 *   .should().haveAttribute('alt')
 *   .check()
 * ```
 */
export function jsxElements(p: ArchProject): JsxRuleBuilder {
  return new JsxRuleBuilder(p)
}
