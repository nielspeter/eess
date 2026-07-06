import { RuleBuilder } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import { collectClasses, type ArchClass } from '../models/arch-class.js'
import {
  haveStereotype as predHaveStereotype,
  haveNameMatching as predHaveNameMatching,
  haveNameStartingWith as predHaveNameStartingWith,
  haveNameEndingWith as predHaveNameEndingWith,
  haveMemberNamed as predHaveMemberNamed,
  haveMethodNamed as predHaveMethodNamed,
  areAbstract as predAreAbstract,
  haveAtLeastOneMethod as predHaveAtLeastOneMethod,
  haveNoMembers as predHaveNoMembers,
  extendName as predExtendName,
} from '../predicates/class.js'
import {
  notExtendStereotype as condNotExtendStereotype,
  extendClass as condExtendClass,
  notExist as condNotExist,
  haveStereotype as condHaveStereotype,
  notHaveStereotype as condNotHaveStereotype,
  dependOn as condDependOn,
  notDependOn as condNotDependOn,
  notDependOnStereotype as condNotDependOnStereotype,
} from '../conditions/class.js'

export class ClassRuleBuilder extends RuleBuilder<ArchClass, ArchProject> {
  protected getElements(): ArchClass[] {
    return collectClasses(this.project)
  }

  // --- Predicate methods (after .that()) ---

  /**
   * After `.that()`: filter classes carrying the `<<name>>` stereotype.
   * After `.should()`: assert matched classes carry the `<<name>>` stereotype.
   */
  haveStereotype(name: string): this {
    if (this._phase === 'condition') {
      return this.addCondition(condHaveStereotype(name))
    }
    return this.addPredicate(predHaveStereotype(name))
  }

  /** Filter to classes whose name matches the pattern. */
  haveNameMatching(pattern: RegExp): this {
    return this.addPredicate(predHaveNameMatching(pattern))
  }

  /** Filter to classes whose name starts with the given prefix. */
  haveNameStartingWith(prefix: string): this {
    return this.addPredicate(predHaveNameStartingWith(prefix))
  }

  /** Filter to classes whose name ends with the given suffix. */
  haveNameEndingWith(suffix: string): this {
    return this.addPredicate(predHaveNameEndingWith(suffix))
  }

  /** Filter to classes declaring a member (field or method) with the given name. */
  haveMemberNamed(name: string): this {
    return this.addPredicate(predHaveMemberNamed(name))
  }

  /** Filter to classes declaring a method with the given name. */
  haveMethodNamed(name: string): this {
    return this.addPredicate(predHaveMethodNamed(name))
  }

  /** Filter to classes marked `<<abstract>>`. */
  areAbstract(): this {
    return this.addPredicate(predAreAbstract())
  }

  /** Filter to classes declaring at least one method. */
  haveAtLeastOneMethod(): this {
    return this.addPredicate(predHaveAtLeastOneMethod())
  }

  /** Filter to classes with no members (empty body). */
  haveNoMembers(): this {
    return this.addPredicate(predHaveNoMembers())
  }

  /** Filter to classes that extend the named superclass. */
  extendName(superName: string): this {
    return this.addPredicate(predExtendName(superName))
  }

  // --- Condition methods (after .should()) ---

  /** Assert matched classes do not extend a class carrying the `<<name>>` stereotype. */
  notExtendStereotype(name: string): this {
    return this.addCondition(condNotExtendStereotype(name))
  }

  /** Assert matched classes extend the named superclass. */
  extend(superName: string): this {
    return this.addCondition(condExtendClass(superName))
  }

  /** Assert no class matched the preceding filters (the selection must be empty). */
  notExist(): this {
    return this.addCondition(condNotExist())
  }

  /** Assert matched classes do not carry the `<<name>>` stereotype. */
  notHaveStereotype(name: string): this {
    return this.addCondition(condNotHaveStereotype(name))
  }

  /** Assert matched classes depend on the named target class. */
  dependOn(targetName: string): this {
    return this.addCondition(condDependOn(targetName))
  }

  /** Assert matched classes do not depend on the named target class. */
  notDependOn(targetName: string): this {
    return this.addCondition(condNotDependOn(targetName))
  }

  /** Assert matched classes do not depend on any class carrying the `<<stereotype>>`. */
  notDependOnStereotype(stereotype: string): this {
    return this.addCondition(condNotDependOnStereotype(stereotype))
  }
}

export function classes(project: ArchProject): ClassRuleBuilder {
  return new ClassRuleBuilder(project)
}
