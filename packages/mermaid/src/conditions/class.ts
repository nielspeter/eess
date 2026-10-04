import type { Condition, ConditionContext } from '@nielspeter/eess'
import { marksAssertsCardinality } from '@nielspeter/eess/internal'
import type { ArchViolation } from '../core/violation.js'
import { createViolation } from '../core/violation.js'
import type { ArchClass } from '../models/arch-class.js'
import {
  ancestorPaths,
  ancestorsOf,
  collectRelationships,
  getClassLine,
  inheritsBetween,
} from '../models/arch-class.js'

function classViolation(c: ArchClass, message: string, ctx: ConditionContext): ArchViolation {
  return createViolation(
    {
      element: c.name,
      file: c.project.filePath ?? '<inline>',
      line: getClassLine(c) + 1,
      sourceText: c.project.source,
    },
    message,
    ctx,
  )
}

export function notExtendStereotype(name: string): Condition<ArchClass> {
  return {
    description: `not extend a class with stereotype <<${name}>>`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      const first = elements[0]
      if (first === undefined) return []
      const project = first.project
      const allClasses = new Map(
        project.ast.classes.map((c) => {
          const stereotypes: string[] = c.stereotypes.map((s) => s.name)
          for (const a of project.ast.stereotypeAssignments) {
            if (a.classRef.$refText === c.name) stereotypes.push(a.stereotype.name)
          }
          return [c.name, stereotypes] as const
        }),
      )

      const violations: ArchViolation[] = []
      for (const c of elements) {
        for (const [sup, via] of ancestorPaths(project, c.name)) {
          const supStereotypes = allClasses.get(sup) ?? []
          if (supStereotypes.includes(name)) {
            const path = via.length > 0 ? ` (via ${via.join(', ')})` : ''
            violations.push(
              classViolation(
                c,
                `${c.name} extends ${sup}${path} which has stereotype <<${name}>>`,
                context,
              ),
            )
          }
        }
      }
      return violations
    },
  }
}

export function extendClass(superName: string): Condition<ArchClass> {
  return {
    description: `extend ${superName}`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      const first = elements[0]
      if (first === undefined) return []
      const project = first.project
      const violations: ArchViolation[] = []
      for (const c of elements) {
        if (!ancestorsOf(project, c.name).has(superName)) {
          violations.push(classViolation(c, `${c.name} does not extend ${superName}`, context))
        }
      }
      return violations
    },
  }
}

/**
 * A class-level condition: one violation per class that fails the test.
 *
 * `haveStereotype`, `notHaveStereotype`, `dependOn` and `notDependOn` were
 * four literal copies of `filter().map(classViolation)` — `no-copy-paste`
 * reported them as identical text.
 *
 * Each pair stays TWO exported conditions rather than one plus `not()`.
 * `not()` composes predicates, which answer a boolean; a condition owns its
 * violation MESSAGE, and "is missing required stereotype" does not invert into
 * "has forbidden stereotype" mechanically — only the author can write the
 * other sentence. A generic negation would emit a remedy pointing the reader
 * at the wrong change, which is what ADR-009 rule 2 forbids. So the loop is
 * shared and the sentence is not.
 */
function classCondition(
  description: string,
  violatesWhen: (c: ArchClass) => boolean,
  message: (c: ArchClass) => string,
): Condition<ArchClass> {
  return {
    description,
    evaluate: (elements, context) =>
      elements.filter(violatesWhen).map((c) => classViolation(c, message(c), context)),
  }
}

export function notExist(): Condition<ArchClass> {
  return marksAssertsCardinality({
    description: 'not exist',
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements.map((c) => classViolation(c, `class ${c.name} should not exist`, context))
    },
  })
}

export function haveStereotype(name: string): Condition<ArchClass> {
  return classCondition(
    `have stereotype <<${name}>>`,
    (c) => !c.stereotypes.includes(name),
    (c) => `${c.name} is missing required stereotype <<${name}>>`,
  )
}

export function notHaveStereotype(name: string): Condition<ArchClass> {
  return classCondition(
    `not have stereotype <<${name}>>`,
    (c) => c.stereotypes.includes(name),
    (c) => `${c.name} has forbidden stereotype <<${name}>>`,
  )
}

function dependenciesOf(c: ArchClass): string[] {
  return collectRelationships(c.project)
    .filter(
      (r) => r.source === c.name && inheritsBetween(r.arrow, r.source, r.target) === undefined,
    )
    .map((r) => r.target)
}

export function dependOn(targetName: string): Condition<ArchClass> {
  return classCondition(
    `depend on ${targetName}`,
    (c) => !dependenciesOf(c).includes(targetName),
    (c) => `${c.name} does not depend on ${targetName}`,
  )
}

export function notDependOn(targetName: string): Condition<ArchClass> {
  return classCondition(
    `not depend on ${targetName}`,
    (c) => dependenciesOf(c).includes(targetName),
    (c) => `${c.name} depends on ${targetName}`,
  )
}

export function notDependOnStereotype(stereotype: string): Condition<ArchClass> {
  return {
    description: `not depend on a class with stereotype <<${stereotype}>>`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      const first = elements[0]
      if (first === undefined) return []
      const project = first.project
      const stereotypesByClass = new Map<string, string[]>()
      for (const c of project.ast.classes) {
        const list = c.stereotypes.map((s) => s.name)
        for (const a of project.ast.stereotypeAssignments) {
          if (a.classRef.$refText === c.name) list.push(a.stereotype.name)
        }
        stereotypesByClass.set(c.name, list)
      }
      const violations: ArchViolation[] = []
      for (const c of elements) {
        for (const target of dependenciesOf(c)) {
          const ts = stereotypesByClass.get(target) ?? []
          if (ts.includes(stereotype)) {
            violations.push(
              classViolation(
                c,
                `${c.name} depends on ${target} which has stereotype <<${stereotype}>>`,
                context,
              ),
            )
          }
        }
      }
      return violations
    },
  }
}
