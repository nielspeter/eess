import type { Condition } from '@nielspeter/eess'
import type { MdDocument, MdTable } from '../model/document.js'
import { mdViolation } from '../model/violation.js'
import { hasSection, tableInSection } from '../model/query.js'
import { checkDepth } from '../model/name-match.js'
import { headingNotes, type HaveSectionOptions } from '../model/sections.js'
import { citesHeadings, declaresSections } from '../model/section-declarations.js'

export type { HaveSectionOptions } from '../model/sections.js'

/**
 * Condition: every matched document must have a heading matching `name` (at `depth`, when given).
 * A heading of the name that does not count, at another depth or inside a list item or blockquote,
 * is named in the finding. With `depth`, the name is recorded for the section-name scan (plan 0496).
 */
export function haveSection(
  name: string | RegExp,
  options: HaveSectionOptions = {},
): Condition<MdDocument> {
  checkDepth(options.depth, 'haveSection')
  const at = options.depth === undefined ? '' : ` at depth ${String(options.depth)}`
  const condition: Condition<MdDocument> = {
    description: `have section "${String(name)}"${at}`,
    evaluate: (docs, ctx) =>
      docs
        .filter((d) => !hasSection(d, name, options.depth))
        .map((d) => {
          const notes = headingNotes(d, name, { depth: options.depth })
          return citesHeadings(
            mdViolation({
              element: d.relPath,
              file: d.file,
              line: 1,
              message: `missing section "${String(name)}"${at}${notes.map((n) => `; ${n.note}`).join('')}`,
              sourceText: d.text,
              context: ctx,
            }),
            notes.map((n) => n.line),
          )
        }),
  }
  return options.depth === undefined
    ? condition
    : declaresSections(condition, [{ name, depth: options.depth }])
}

export interface HaveTableOptions {
  /** Restrict to a table under this heading. */
  readonly section?: string | RegExp
  /** Each regex must match at least one header cell. */
  readonly columns: readonly RegExp[]
}

/** Does the table have every required column? One helper, for the document and section forms. */
export function hasColumns(table: MdTable, columns: readonly RegExp[]): boolean {
  return columns.every((col) => table.header.some((h) => col.test(h)))
}

/** How a finding names the required columns: `/Clause/, /Tier/`. */
export const columnsText = (columns: readonly RegExp[]): string => columns.map(String).join(', ')

/** Condition: the document must contain a GFM table with the required columns. */
export function haveTable(opts: HaveTableOptions): Condition<MdDocument> {
  const colDesc = columnsText(opts.columns)
  return {
    description: `have a table with columns ${colDesc}${opts.section ? ` in section "${String(opts.section)}"` : ''}`,
    evaluate: (docs, ctx) =>
      docs.flatMap((d) => {
        const candidates = d.tables.filter((t) => tableInSection(t, opts.section))
        const satisfied = candidates.some((t) => hasColumns(t, opts.columns))
        if (satisfied) return []
        return [
          mdViolation({
            element: d.relPath,
            file: d.file,
            line: candidates[0]?.line ?? 1,
            message: `no table with the required columns (${colDesc})${
              opts.section ? ` in section "${String(opts.section)}"` : ''
            }`,
            sourceText: d.text,
            context: ctx,
          }),
        ]
      }),
  }
}
