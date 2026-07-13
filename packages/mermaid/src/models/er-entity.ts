import type { ErDiagram } from '../parser/generated/ast.js'

/** An attribute of an ER entity, as the model layer exposes it. */
export interface ErAttributeInfo {
  readonly type: string
  readonly name: string
  /** Key constraints (`PK` / `FK` / `UK`), in declaration order. */
  readonly keys: readonly string[]
  /** The trailing quoted comment, unquoted — `undefined` when absent. */
  readonly comment?: string
}

/** An ER entity: a declared block, an implicit relationship endpoint, or both. */
export interface ErEntityInfo {
  readonly name: string
  readonly attributes: readonly ErAttributeInfo[]
  /** `true` when the entity has a declared block (`Name { … }`). */
  readonly declared: boolean
}

/** A relationship between two entities. */
export interface ErRelationshipInfo {
  readonly lhs: string
  readonly rhs: string
  readonly cardinality: string
  readonly label?: string
}

const unquote = (s: string): string => s.replace(/^"|"$/g, '')

/**
 * Collect the diagram's entities — declared blocks unioned with implicit
 * relationship endpoints (Mermaid allows both), keyed by name.
 */
export function collectEntities(ast: ErDiagram): ErEntityInfo[] {
  const byName = new Map<string, ErEntityInfo>()
  for (const e of ast.entities) {
    byName.set(e.name, {
      name: e.name,
      declared: true,
      attributes: e.attributes.map((a) => ({
        type: a.type,
        name: a.name,
        keys: [...a.keys],
        ...(a.comment !== undefined && { comment: unquote(a.comment) }),
      })),
    })
  }
  for (const r of ast.relationships) {
    for (const name of [r.lhs, r.rhs]) {
      if (!byName.has(name)) byName.set(name, { name, declared: false, attributes: [] })
    }
  }
  return [...byName.values()]
}

/** Collect the diagram's relationships. */
export function collectErRelationships(ast: ErDiagram): ErRelationshipInfo[] {
  return ast.relationships.map((r) => ({
    lhs: r.lhs,
    rhs: r.rhs,
    cardinality: r.cardinality,
    ...(r.label !== undefined && { label: unquote(r.label) }),
  }))
}
