import type { ClassDef as AstClassDef } from '../parser/generated/ast.js'
import type { ArchProject } from '../core/project.js'

export interface ArchClass {
  readonly node: AstClassDef
  readonly name: string
  readonly stereotypes: readonly string[]
  readonly memberNames: readonly string[]
  readonly methodNames: readonly string[]
  readonly project: ArchProject
}

export interface ArchRelationship {
  readonly source: string
  readonly target: string
  readonly arrow: string
  readonly label?: string
}

export function collectClasses(project: ArchProject): ArchClass[] {
  const assignmentsByClass = new Map<string, string[]>()
  for (const a of project.ast.stereotypeAssignments) {
    const target = a.classRef.$refText
    const list = assignmentsByClass.get(target) ?? []
    list.push(a.stereotype.name)
    assignmentsByClass.set(target, list)
  }

  return project.ast.classes.map((c) => {
    const inline = c.stereotypes.map((s) => s.name)
    const external = assignmentsByClass.get(c.name) ?? []
    return {
      node: c,
      name: c.name,
      stereotypes: [...inline, ...external],
      memberNames: c.members.map((m) => m.name),
      methodNames: c.members.filter((m) => m.method).map((m) => m.name),
      project,
    }
  })
}

export function collectRelationships(project: ArchProject): ArchRelationship[] {
  return project.ast.relationships.map((r) => ({
    source: r.lhs.$refText,
    target: r.rhs.$refText,
    arrow: r.arrow,
    label: r.label,
  }))
}

export function getClassLine(c: ArchClass): number {
  return c.node.$cstNode?.range.start.line ?? 0
}
