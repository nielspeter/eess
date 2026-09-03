import type { ArchProject } from '../core/project.js'
import { RuleBuilder } from '../core/rule-builder.js'
import type { TypeMatcher } from '../helpers/type-matchers.js'
import {
  areInterfaces,
  areTypeAliases,
  haveProperty,
  havePropertyOfType,
  extendType,
  type TypeDeclaration,
} from '../predicates/type.js'
import { havePropertyType } from '../conditions/type-level.js'
import {
  havePropertyNamed as memberHavePropertyNamed,
  notHavePropertyNamed as memberNotHavePropertyNamed,
  havePropertyMatching as memberHavePropertyMatching,
  notHavePropertyMatching as memberNotHavePropertyMatching,
  haveOnlyReadonlyProperties as memberHaveOnlyReadonlyProperties,
  maxProperties as memberMaxProperties,
} from '../conditions/members.js'
import {
  beExported as conditionBeExported,
  notExist as conditionNotExist,
  haveNameMatching as conditionHaveNameMatching,
  resideInFile as conditionResideInFile,
  resideInFolder as conditionResideInFolder,
} from '../conditions/structural.js'
import { createElementCache, SOLE_POPULATION } from '../core/element-cache.js'
import {
  haveNameMatching as identityHaveNameMatching,
  resideInFile as identityResideInFile,
  resideInFolder as identityResideInFolder,
  areExported as identityAreExported,
  areNotExported as identityAreNotExported,
} from '../predicates/identity.js'

/** One collection per project, shared by every rule built from it (plan 0075). */
const cache = createElementCache<TypeDeclaration>()

/**
 * Rule builder for interface and type alias declarations.
 *
 * Returned by the `types()` entry point. Provides type-specific
 * predicates and conditions on top of the base RuleBuilder chain.
 *
 * @example
 * types(project)
 *   .that().haveProperty('sortBy')
 *   .should().havePropertyType('sortBy', not(isString()))
 *   .because('sortBy must be a union of literals, not bare string')
 *   .check()
 */
export class TypeRuleBuilder extends RuleBuilder<TypeDeclaration> {
  constructor(project: ArchProject) {
    super(project)
  }

  /**
   * Collect all InterfaceDeclarations and TypeAliasDeclarations
   * from all source files in the project.
   */
  protected getElements(): TypeDeclaration[] {
    return cache.get(this.project, SOLE_POPULATION, () => {
      const elements: TypeDeclaration[] = []
      for (const sf of this.project.getSourceFiles()) {
        elements.push(...sf.getInterfaces())
        elements.push(...sf.getTypeAliases())
      }
      return elements
    })
  }

  // --- Type-specific predicates ---

  /**
   * Narrows the selection to types that are interfaces.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areInterfaces(): this {
    return this.addPredicate(areInterfaces())
  }

  /**
   * Narrows the selection to types that are type aliases.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areTypeAliases(): this {
    return this.addPredicate(areTypeAliases())
  }

  /**
   * Narrows the selection to types that have a property named `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveProperty(name: string): this {
    return this.addPredicate(haveProperty(name))
  }

  /**
   * Narrows the selection to types that have property `name` of a type matching `matcher`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  havePropertyOfType(name: string, matcher: TypeMatcher): this {
    return this.addPredicate(havePropertyOfType(name, matcher))
  }

  /**
   * Narrows the selection to types that extend the type `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  extendType(name: string): this {
    return this.addPredicate(extendType(name))
  }

  // --- Type-specific conditions ---

  /**
   * Asserts that the selected types have property `name` of a type matching `matcher`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  havePropertyType(name: string, matcher: TypeMatcher): this {
    return this.addCondition(havePropertyType(name, matcher))
  }

  /**
   * Asserts that the selected types are exported.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  beExported(): this {
    return this.addCondition(conditionBeExported())
  }

  /**
   * Asserts that the selected types do not exist.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  notExist(): this {
    return this.addCondition(conditionNotExist())
  }

  /** @deprecated Use `haveNameMatching()` after `.should()` instead. */
  conditionHaveNameMatching(pattern: RegExp): this {
    return this.addCondition(conditionHaveNameMatching(pattern))
  }

  // --- Member property conditions (plan 0030) ---

  /**
   * Asserts that the selected types have a property named by each of `names`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  havePropertyNamed(...names: string[]): this {
    return this.addCondition(memberHavePropertyNamed(...names))
  }

  /**
   * Asserts that the selected types do not have a property named by any of `names`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  notHavePropertyNamed(...names: string[]): this {
    return this.addCondition(memberNotHavePropertyNamed(...names))
  }

  /**
   * Asserts that the selected types have a property matching `pattern`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  havePropertyMatching(pattern: RegExp): this {
    return this.addCondition(memberHavePropertyMatching(pattern))
  }

  /**
   * Asserts that the selected types do not have a property matching `pattern`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  notHavePropertyMatching(pattern: RegExp): this {
    return this.addCondition(memberNotHavePropertyMatching(pattern))
  }

  /**
   * Asserts that the selected types have only readonly properties.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  haveOnlyReadonlyProperties(): this {
    return this.addCondition(memberHaveOnlyReadonlyProperties())
  }

  /**
   * Asserts that the selected types have at most `max` properties.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  maxProperties(max: number): this {
    return this.addCondition(memberMaxProperties(max))
  }

  // --- Identity predicates (convenience wrappers) ---

  /**
   * After `.that()`: filter types whose name matches the pattern.
   * After `.should()`: assert matched types have names matching the pattern.
   */
  haveNameMatching(pattern: RegExp | string): this {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    return this.dualUse(conditionHaveNameMatching(regex), identityHaveNameMatching(pattern))
  }

  /**
   * Narrows the selection to types that are exported.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areExported(): this {
    return this.addPredicate(identityAreExported())
  }

  /**
   * Narrows the selection to types that are not exported.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areNotExported(): this {
    return this.addPredicate(identityAreNotExported())
  }

  /**
   * After `.that()`: filter types in a file matching the glob.
   * After `.should()`: assert types reside in a file matching the glob.
   */
  resideInFile(glob: string): this {
    return this.dualUse(conditionResideInFile(glob), identityResideInFile(glob))
  }

  /**
   * After `.that()`: filter types in a folder matching the glob.
   * After `.should()`: assert types reside in a folder matching the glob.
   */
  resideInFolder(glob: string): this {
    return this.dualUse(conditionResideInFolder(glob), identityResideInFolder(glob))
  }
}

/**
 * Entry point for rules on interface and type alias declarations.
 *
 * Returns a TypeRuleBuilder that can filter and assert on all
 * InterfaceDeclaration and TypeAliasDeclaration nodes in the project.
 *
 * @example
 * // All types with a sortBy property must not use bare string
 * types(project)
 *   .that().haveProperty('sortBy')
 *   .should().havePropertyType('sortBy', not(isString()))
 *   .check()
 */
export function types(p: ArchProject): TypeRuleBuilder {
  return new TypeRuleBuilder(p)
}
