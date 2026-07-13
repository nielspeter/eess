import picomatch from 'picomatch'
import { throwIfViolations, type ArchViolation } from '@nielspeter/eess'
import type { Corpus, MdDocument } from '@nielspeter/eess-md'
import { parseErDiagram, collectEntities, type ErEntityInfo } from '@nielspeter/eess-mermaid'

export interface TableErAgreeOptions {
  /** Glob selecting the documents to check. Default `**`. */
  readonly docs?: string
  /**
   * The consumer's table shape (never baked in): which section holds the
   * property table, and which headers carry the property name and —
   * optionally — its type.
   */
  readonly table: {
    readonly section: RegExp
    readonly name: RegExp
    readonly type?: RegExp
  }
  /**
   * Which diagram entity a document describes — e.g. derive `JobSchedule`
   * from an `# Entity: Job Schedule` heading. Return `undefined` to skip
   * the document.
   */
  readonly entity: (doc: MdDocument) => string | undefined
}

const RULE = 'entity property tables and their erDiagram should agree'
const ER_HEADER = /^\s*erDiagram\b/

const v = (doc: MdDocument, line: number, message: string, because: string): ArchViolation => ({
  rule: RULE,
  ruleId: 'crossval/table-er-agree',
  element: doc.relPath,
  file: doc.file,
  line,
  message,
  because,
})

function erEntitiesOf(doc: MdDocument): { entities: ErEntityInfo[]; line: number }[] {
  return doc.codeBlocks
    .filter((b) => (b.lang === 'mermaid' || b.lang === null) && ER_HEADER.test(b.value))
    .map((b) => ({ entities: collectEntities(parseErDiagram(b.value)), line: b.line }))
}

/**
 * Cross-validate that a document's property table and its own `erDiagram`
 * describe the same entity (plan 0069 Phase 3): the entity the document is
 * about must appear in the diagram, and every diagram attribute of that
 * entity must be a row of the table (attributes ⊆ properties). Where the
 * consumer maps a type column, attribute types must match it too
 * (case-insensitive).
 *
 * Documents with no erDiagram block, or for which `entity()` returns
 * `undefined`, are skipped — gate diagram *presence* separately with
 * `docs()` conformance if the corpus requires one.
 */
export function tableErAgree(corpus: Corpus, options: TableErAgreeOptions): void {
  const inDocs = picomatch(options.docs ?? '**')
  const violations: ArchViolation[] = []

  for (const doc of corpus.documents()) {
    if (!inDocs(doc.relPath)) continue
    const entityName = options.entity(doc)
    if (entityName === undefined) continue
    const blocks = erEntitiesOf(doc)
    if (blocks.length === 0) continue

    const entity = blocks.flatMap((b) => b.entities).find((e) => e.name === entityName)
    const diagramLine = blocks[0]?.line ?? 1
    if (entity === undefined) {
      violations.push(
        v(
          doc,
          diagramLine,
          `erDiagram does not declare entity '${entityName}'`,
          'the diagram and the document must describe the same entity',
        ),
      )
      continue
    }

    const table = doc.tables.find(
      (t) =>
        t.sectionPath.some((h) => options.table.section.test(h)) &&
        t.header.some((h) => options.table.name.test(h)),
    )
    if (table === undefined) {
      violations.push(
        v(
          doc,
          diagramLine,
          `no property table matching section ${String(options.table.section)} to compare the erDiagram against`,
          'attributes ⊆ properties is only checkable when the table exists',
        ),
      )
      continue
    }

    const nameIdx = table.header.findIndex((h) => options.table.name.test(h))
    const typeIdx =
      options.table.type !== undefined
        ? table.header.findIndex((h) => {
            const re = options.table.type
            return re !== undefined && re.test(h)
          })
        : -1
    const typeByName = new Map<string, string>()
    for (const row of table.rows) {
      const name = row[nameIdx]
      if (name === undefined) continue
      typeByName.set(name.trim(), typeIdx >= 0 ? (row[typeIdx] ?? '').trim() : '')
    }

    for (const attr of entity.attributes) {
      const tableType = typeByName.get(attr.name)
      if (tableType === undefined) {
        violations.push(
          v(
            doc,
            diagramLine,
            `erDiagram attribute '${attr.name}' of '${entityName}' is not a row of the property table`,
            'a diagram attribute the table does not carry is drift between two views of one entity',
          ),
        )
        continue
      }
      if (typeIdx >= 0 && tableType.toLowerCase() !== attr.type.toLowerCase()) {
        violations.push(
          v(
            doc,
            diagramLine,
            `type of '${attr.name}' disagrees: table says '${tableType}', erDiagram says '${attr.type}'`,
            'the two representations must state the same type',
          ),
        )
      }
    }
  }

  throwIfViolations(violations)
}

/** Count compared docs/entities/attributes for a caller's non-vacuity summary. */
export function tableErStats(
  corpus: Corpus,
  options: TableErAgreeOptions,
): { docs: number; entities: number; attributes: number } {
  const inDocs = picomatch(options.docs ?? '**')
  let docs = 0
  let entities = 0
  let attributes = 0
  for (const doc of corpus.documents()) {
    if (!inDocs(doc.relPath)) continue
    if (options.entity(doc) === undefined) continue
    const blocks = erEntitiesOf(doc)
    if (blocks.length === 0) continue
    docs++
    for (const b of blocks) {
      entities += b.entities.length
      attributes += b.entities.reduce((n, e) => n + e.attributes.length, 0)
    }
  }
  return { docs, entities, attributes }
}
