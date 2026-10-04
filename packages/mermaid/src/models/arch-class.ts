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

const INHERITANCE_ARROWS = new Set(['<|--', '<|..', '--|>', '..|>'])

/** The `{ sub, sup }` pair an inheritance or realization edge declares; none for any other edge. */
export function inheritsBetween(
  arrow: string,
  source: string,
  target: string,
): { sub: string; sup: string } | undefined {
  if (!INHERITANCE_ARROWS.has(arrow)) return undefined
  if (arrow === '<|--' || arrow === '<|..') {
    return { sub: target, sup: source }
  }
  return { sub: source, sup: target }
}

/**
 * Every class `className` reaches through inheritance and realization edges, at any depth
 * (bug 0374, ADR-017 rule 6), mapped to the classes passed on the way, nearest first — the
 * shortest such path. Each class is visited once, so a cycle in the diagram ends the walk; a
 * class on a cycle reaches itself.
 */
export function ancestorPaths(
  project: ArchProject,
  className: string,
): Map<string, readonly string[]> {
  const parents = new Map<string, string[]>()
  for (const r of collectRelationships(project)) {
    const inh = inheritsBetween(r.arrow, r.source, r.target)
    if (inh === undefined) continue
    parents.set(inh.sub, [...(parents.get(inh.sub) ?? []), inh.sup])
  }
  const reached = new Map<string, readonly string[]>()
  const queue: { name: string; via: readonly string[] }[] = (parents.get(className) ?? []).map(
    (name) => ({ name, via: [] }),
  )
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (reached.has(next.name)) continue
    reached.set(next.name, next.via)
    const via = [...next.via, next.name]
    for (const name of parents.get(next.name) ?? []) queue.push({ name, via })
  }
  return reached
}

/** The classes `className` reaches through inheritance and realization edges, at any depth. */
export function ancestorsOf(project: ArchProject, className: string): Set<string> {
  return new Set(ancestorPaths(project, className).keys())
}

export function getClassLine(c: ArchClass): number {
  return c.node.$cstNode?.range.start.line ?? 0
}
