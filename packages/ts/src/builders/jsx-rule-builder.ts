import type { ArchProject } from '../core/project.js'
import { RuleBuilder } from '@nielspeter/eess'
import type { ArchJsxElement } from '../models/arch-jsx-element.js'
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
export class JsxRuleBuilder extends RuleBuilder<ArchJsxElement, ArchProject> {
  protected getElements(): ArchJsxElement[] {
    return this.project.getSourceFiles().flatMap(collectJsxElements)
  }

  // --- Identity predicates (predicate-only, following CallRuleBuilder pattern) ---

  /** Filter to JSX elements whose tag/component name matches the pattern. */
  haveNameMatching(pattern: RegExp | string): this {
    return this.addPredicate(identityHaveNameMatching<ArchJsxElement>(pattern))
  }

  /** Filter to JSX elements whose tag/component name starts with the prefix. */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith<ArchJsxElement>(prefix))
  }

  /** Filter to JSX elements whose tag/component name ends with the suffix. */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith<ArchJsxElement>(suffix))
  }

  /** Filter to JSX elements in a file whose absolute path matches the glob. */
  resideInFile(glob: string): this {
    return this.addPredicate(identityResideInFile<ArchJsxElement>(glob))
  }

  /** Filter to JSX elements in a folder whose path matches the glob. */
  resideInFolder(glob: string): this {
    return this.addPredicate(identityResideInFolder<ArchJsxElement>(glob))
  }

  // --- JSX-specific predicates ---

  /**
   * Filter to intrinsic HTML elements with any of the given lowercase tags
   * (e.g. `areHtmlElements('button', 'input')`). Requires at least one tag.
   */
  areHtmlElements(...tags: string[]): this {
    return this.addPredicate(jsxAreHtmlElements(...tags))
  }

  /**
   * Filter to component elements (uppercase or dotted names). With no
   * arguments matches all components; with names, only those (use the full
   * dotted name for namespaced components, e.g. `'Icons.Check'`).
   */
  areComponents(...names: string[]): this {
    return this.addPredicate(jsxAreComponents(...names))
  }

  /** Filter to elements that have the named attribute, regardless of value. */
  withAttribute(name: string): this {
    return this.addPredicate(jsxWithAttribute(name))
  }

  /** Filter to elements whose named attribute value equals the string or matches the regex. */
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
