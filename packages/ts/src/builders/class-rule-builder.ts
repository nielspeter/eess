import type { ClassDeclaration } from 'ts-morph'
import { RuleBuilder } from '../core/rule-builder.js'
import type { ArchProject } from '../core/project.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import {
  classContain,
  classNotContain,
  classUseInsteadOf,
  classNotHaveEmptyBody,
} from '../conditions/body-analysis.js'

// Identity predicates (plan 0003)
import {
  haveNameMatching as identityHaveNameMatching,
  haveNameStartingWith as identityHaveNameStartingWith,
  haveNameEndingWith as identityHaveNameEndingWith,
  resideInFile as predicateResideInFile,
  resideInFolder as predicateResideInFolder,
  areExported as identityAreExported,
  areNotExported as identityAreNotExported,
} from '../predicates/identity.js'

// Class-specific predicates (this plan)
import {
  extend as predicateExtend,
  implement as predicateImplement,
  haveDecorator as predicateHaveDecorator,
  haveDecoratorMatching as predicateHaveDecoratorMatching,
  areAbstract as predicateAreAbstract,
  haveMethodNamed as predicateHaveMethodNamed,
  haveMethodMatching as predicateHaveMethodMatching,
  havePropertyNamed as predicateHavePropertyNamed,
} from '../predicates/class.js'

// Structural conditions (plan 0004)
import {
  resideInFile as conditionResideInFile,
  resideInFolder as conditionResideInFolder,
  haveNameMatching as conditionHaveNameMatching,
  beExported as conditionBeExported,
  notExist as conditionNotExist,
} from '../conditions/structural.js'
import { createElementCache, SOLE_POPULATION } from '../core/element-cache.js'

// Class-specific conditions (this plan)
import {
  shouldExtend as conditionExtend,
  shouldImplement as conditionImplement,
  shouldHaveMethodNamed as conditionHaveMethodNamed,
  shouldNotHaveMethodMatching as conditionNotHaveMethodMatching,
  acceptParameterOfType as conditionAcceptParameterOfType,
  notAcceptParameterOfType as conditionNotAcceptParameterOfType,
} from '../conditions/class.js'

import type { TypeMatcher } from '../helpers/type-matchers.js'

// Member property conditions (plan 0030)
import {
  havePropertyNamed as memberHavePropertyNamed,
  notHavePropertyNamed as memberNotHavePropertyNamed,
  havePropertyMatching as memberHavePropertyMatching,
  notHavePropertyMatching as memberNotHavePropertyMatching,
  haveOnlyReadonlyProperties as memberHaveOnlyReadonlyProperties,
  maxProperties as memberMaxProperties,
} from '../conditions/members.js'

/** One collection per project, shared by every rule built from it (plan 0075). */
const cache = createElementCache<ClassDeclaration>()

/**
 * Rule builder for ClassDeclaration elements.
 *
 * Created by the `classes(p)` entry point. Provides class-specific
 * predicates and conditions alongside the identity predicates and
 * structural conditions from the foundation plans.
 */
export class ClassRuleBuilder extends RuleBuilder<ClassDeclaration> {
  constructor(project: ArchProject) {
    super(project)
  }

  protected getElements(): ClassDeclaration[] {
    return cache.get(this.project, SOLE_POPULATION, () => {
      const classes: ClassDeclaration[] = []
      for (const sourceFile of this.project.getSourceFiles()) {
        classes.push(...sourceFile.getClasses())
      }
      return classes
    })
  }

  // --- Identity predicate methods (plan 0003) ---

  /**
   * After `.that()`: filter classes whose name matches the pattern.
   * After `.should()`: assert matched classes have names matching the pattern.
   */
  haveNameMatching(pattern: RegExp | string): this {
    if (this._phase === 'condition') {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
      return this.addCondition(conditionHaveNameMatching(regex))
    }
    return this.addPredicate(identityHaveNameMatching(pattern))
  }

  /**
   * Narrows the selection to classes that have a name starting with `prefix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(identityHaveNameStartingWith(prefix))
  }

  /**
   * Narrows the selection to classes that have a name ending with `suffix`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(identityHaveNameEndingWith(suffix))
  }

  /**
   * After `.that()`: filter classes that reside in a file matching the glob.
   * After `.should()`: assert matched classes reside in a file matching the glob.
   */
  resideInFile(glob: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(conditionResideInFile(glob))
    }
    return this.addPredicate(predicateResideInFile(glob))
  }

  /**
   * After `.that()`: filter classes that reside in a folder matching the glob.
   * After `.should()`: assert matched classes reside in a folder matching the glob.
   */
  resideInFolder(glob: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(conditionResideInFolder(glob))
    }
    return this.addPredicate(predicateResideInFolder(glob))
  }

  /**
   * Narrows the selection to classes that are exported.
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
   * Narrows the selection to classes that are not exported.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areNotExported(): this {
    return this.addPredicate(identityAreNotExported())
  }

  // --- Class-specific predicate methods ---

  /**
   * After `.that()`: filter classes that extend the given class.
   * After `.should()`: assert matched classes extend the given class.
   */
  extend(className: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(conditionExtend(className))
    }
    return this.addPredicate(predicateExtend(className))
  }

  /**
   * After `.that()`: filter classes that implement the given interface.
   * After `.should()`: assert matched classes implement the given interface.
   */
  implement(interfaceName: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(conditionImplement(interfaceName))
    }
    return this.addPredicate(predicateImplement(interfaceName))
  }

  /**
   * Narrows the selection to classes that have a decorator `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveDecorator(name: string): this {
    return this.addPredicate(predicateHaveDecorator(name))
  }

  /**
   * Narrows the selection to classes that have a decorator matching `regex`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveDecoratorMatching(regex: RegExp): this {
    return this.addPredicate(predicateHaveDecoratorMatching(regex))
  }

  /**
   * Narrows the selection to classes that are abstract.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  areAbstract(): this {
    return this.addPredicate(predicateAreAbstract())
  }

  /**
   * After `.that()`: filter classes that have a method with the given name.
   * After `.should()`: assert matched classes have a method with the given name.
   */
  haveMethodNamed(name: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(conditionHaveMethodNamed(name))
    }
    return this.addPredicate(predicateHaveMethodNamed(name))
  }

  /**
   * Narrows the selection to classes that have a method matching `regex`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  haveMethodMatching(regex: RegExp): this {
    return this.addPredicate(predicateHaveMethodMatching(regex))
  }

  /**
   * Narrows the selection to classes that have a property named `name`.
   *
   * **Predicate only**, unlike the dual-use methods on this builder: it never
   * becomes an assertion. Written after `.should()` it still filters, and the
   * assertion gate reports it as a misplaced predicate rather than letting the
   * rule pass having asserted nothing.
   */
  havePropertyNamed(name: string): this {
    return this.addPredicate(predicateHavePropertyNamed(name))
  }

  // --- Structural condition methods (plan 0004) ---

  /** @deprecated Use `resideInFile()` after `.should()` instead. */
  shouldResideInFile(glob: string): this {
    return this.addCondition(conditionResideInFile(glob))
  }

  /** @deprecated Use `resideInFolder()` after `.should()` instead. */
  shouldResideInFolder(glob: string): this {
    return this.addCondition(conditionResideInFolder(glob))
  }

  /**
   * Asserts that the selected classes are exported.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  beExported(): this {
    return this.addCondition(conditionBeExported())
  }

  /**
   * Asserts that the selected classes do not exist.
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

  // --- Class-specific condition methods ---

  /** @deprecated Use `extend()` after `.should()` instead. */
  shouldExtend(className: string): this {
    return this.addCondition(conditionExtend(className))
  }

  /** @deprecated Use `implement()` after `.should()` instead. */
  shouldImplement(interfaceName: string): this {
    return this.addCondition(conditionImplement(interfaceName))
  }

  /** @deprecated Use `haveMethodNamed()` after `.should()` instead. */
  shouldHaveMethodNamed(name: string): this {
    return this.addCondition(conditionHaveMethodNamed(name))
  }

  /**
   * Asserts that the selected classes do not have a method matching `regex`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  shouldNotHaveMethodMatching(regex: RegExp): this {
    return this.addCondition(conditionNotHaveMethodMatching(regex))
  }

  // --- Member property condition methods (plan 0030) ---

  // "should" prefix: predicate havePropertyNamed(name) exists on this builder
  /**
   * Asserts that the selected classes have a property named by each of `names`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  shouldHavePropertyNamed(...names: string[]): this {
    return this.addCondition(memberHavePropertyNamed(...names))
  }

  /**
   * Asserts that the selected classes do not have a property named by any of `names`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  shouldNotHavePropertyNamed(...names: string[]): this {
    return this.addCondition(memberNotHavePropertyNamed(...names))
  }

  // No "should" prefix: no predicate collision (matches beExported, notExist, contain pattern)
  /**
   * Asserts that the selected classes have a property matching `pattern`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  havePropertyMatching(pattern: RegExp): this {
    return this.addCondition(memberHavePropertyMatching(pattern))
  }

  /**
   * Asserts that the selected classes do not have a property matching `pattern`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  notHavePropertyMatching(pattern: RegExp): this {
    return this.addCondition(memberNotHavePropertyMatching(pattern))
  }

  /**
   * Asserts that the selected classes have only readonly properties.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  haveOnlyReadonlyProperties(): this {
    return this.addCondition(memberHaveOnlyReadonlyProperties())
  }

  /**
   * Asserts that the selected classes have at most `max` properties.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  maxProperties(max: number): this {
    return this.addCondition(memberMaxProperties(max))
  }

  // --- Parameter type condition methods (plan 0031) ---

  /**
   * Asserts that the selected classes accept a parameter of a type matching `matcher`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  acceptParameterOfType(matcher: TypeMatcher): this {
    return this.addCondition(conditionAcceptParameterOfType(matcher))
  }

  /**
   * Asserts that the selected classes do not accept a parameter of a type matching `matcher`.
   *
   * **Condition only** — this is the assertion, so it belongs after `.should()`.
   */
  notAcceptParameterOfType(matcher: TypeMatcher): this {
    return this.addCondition(conditionNotAcceptParameterOfType(matcher))
  }

  // --- Body analysis condition methods (plan 0011) ---

  /**
   * Assert that the class body contains at least one match.
   * "Body" = all method bodies, constructor, getters, setters combined.
   */
  contain(matcher: ExpressionMatcher): this {
    return this.addCondition(classContain(matcher))
  }

  /**
   * Assert that the class body does NOT contain any match.
   * Produces one violation per matching node found.
   */
  notContain(matcher: ExpressionMatcher): this {
    return this.addCondition(classNotContain(matcher))
  }

  /**
   * Assert: must NOT contain 'bad' AND must contain 'good'.
   * Better violation messages than combining notContain + contain separately.
   */
  useInsteadOf(bad: ExpressionMatcher, good: ExpressionMatcher): this {
    return this.addCondition(classUseInsteadOf(bad, good))
  }

  /**
   * Assert that matched classes do not have empty bodies (zero members).
   */
  notHaveEmptyBody(): this {
    return this.addCondition(classNotHaveEmptyBody())
  }
}

/**
 * Entry point for class architecture rules.
 *
 * Returns a `ClassRuleBuilder` that operates on all `ClassDeclaration`
 * nodes across the project's source files.
 *
 * @example
 * classes(p).that().extend('BaseService').should().beExported().check()
 */
export function classes(project: ArchProject): ClassRuleBuilder {
  return new ClassRuleBuilder(project)
}
