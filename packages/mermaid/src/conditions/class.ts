import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '../core/violation.js'
import { createViolation } from '../core/violation.js'
import type { ArchClass } from '../models/arch-class.js'
import { collectRelationships, getClassLine } from '../models/arch-class.js'

const INHERITANCE_ARROWS = new Set(['<|--', '<|..', '--|>', '..|>'])

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

function isExtensionEdge(arrow: string): boolean {
  return INHERITANCE_ARROWS.has(arrow)
}

function inheritsBetween(
  arrow: string,
  source: string,
  target: string,
): { sub: string; sup: string } | undefined {
  if (!isExtensionEdge(arrow)) return undefined
  if (arrow === '<|--' || arrow === '<|..') {
    return { sub: target, sup: source }
  }
  return { sub: source, sup: target }
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
        for (const r of collectRelationships(project)) {
          const inh = inheritsBetween(r.arrow, r.source, r.target)
          if (!inh) continue
          if (inh.sub !== c.name) continue
          const supStereotypes = allClasses.get(inh.sup) ?? []
          if (supStereotypes.includes(name)) {
            violations.push(
              classViolation(
                c,
                `${c.name} extends ${inh.sup} which has stereotype <<${name}>>`,
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
        const extends_ = collectRelationships(project)
          .map((r) => inheritsBetween(r.arrow, r.source, r.target))
          .filter((inh): inh is { sub: string; sup: string } => inh !== undefined)
          .filter((inh) => inh.sub === c.name)
          .map((inh) => inh.sup)
        if (!extends_.includes(superName)) {
          violations.push(classViolation(c, `${c.name} does not extend ${superName}`, context))
        }
      }
      return violations
    },
  }
}

export function notExist(): Condition<ArchClass> {
  return {
    description: 'not exist',
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements.map((c) => classViolation(c, `class ${c.name} should not exist`, context))
    },
  }
}

export function haveStereotype(name: string): Condition<ArchClass> {
  return {
    description: `have stereotype <<${name}>>`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements
        .filter((c) => !c.stereotypes.includes(name))
        .map((c) =>
          classViolation(c, `${c.name} is missing required stereotype <<${name}>>`, context),
        )
    },
  }
}

export function notHaveStereotype(name: string): Condition<ArchClass> {
  return {
    description: `not have stereotype <<${name}>>`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements
        .filter((c) => c.stereotypes.includes(name))
        .map((c) => classViolation(c, `${c.name} has forbidden stereotype <<${name}>>`, context))
    },
  }
}

function dependenciesOf(c: ArchClass): string[] {
  return collectRelationships(c.project)
    .filter((r) => r.source === c.name && !INHERITANCE_ARROWS.has(r.arrow))
    .map((r) => r.target)
}

export function dependOn(targetName: string): Condition<ArchClass> {
  return {
    description: `depend on ${targetName}`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements
        .filter((c) => !dependenciesOf(c).includes(targetName))
        .map((c) => classViolation(c, `${c.name} does not depend on ${targetName}`, context))
    },
  }
}

export function notDependOn(targetName: string): Condition<ArchClass> {
  return {
    description: `not depend on ${targetName}`,
    evaluate(elements: ArchClass[], context: ConditionContext): ArchViolation[] {
      return elements
        .filter((c) => dependenciesOf(c).includes(targetName))
        .map((c) => classViolation(c, `${c.name} depends on ${targetName}`, context))
    },
  }
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
