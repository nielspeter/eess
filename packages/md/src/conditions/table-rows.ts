import type { Condition } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import { mdViolation } from '../model/violation.js'
import { matchTableRows, type MdRow, type ColumnSpec } from '../model/rows.js'

/**
 * Context passed to a row validator — the `rows()` element type ([[MdRow]]).
 * Kept as a named export for back-compat; new code can use `MdRow` directly.
 */
export type TableRowContext = MdRow

export interface HaveTableRowsOptions {
  /** Restrict to a table under this heading. */
  readonly section?: string | RegExp
  /** role → header pattern. The table must have all of these columns; the row
   * validator reads cells via `ctx.get(role)`. */
  readonly columns: ColumnSpec
  /** Return violation messages for a data row (empty = row is fine). */
  readonly row: (ctx: TableRowContext) => string[]
}

/**
 * Generic table-row validator — the primitive `adrEnforcement` composes. For
 * each document, finds the first table (optionally within a section) whose
 * header matches every column pattern, and runs the `row` callback per data
 * row. Table presence itself is `haveTable`'s job; this validates the rows of a
 * matching table. Row extraction is shared with the `rows()` entry point via
 * `matchTableRows` (here in `first` mode, preserving the historical
 * single-table behavior); the reported line stays the table's start line.
 */
export function haveTableRowsSatisfying(opts: HaveTableRowsOptions): Condition<MdDocument> {
  return {
    description: `have table rows satisfying the row validator`,
    evaluate: (documents, ctx) =>
      documents.flatMap((doc) =>
        matchTableRows(doc, { section: opts.section, columns: opts.columns }, 'first').flatMap(
          (row) =>
            opts.row(row).map((message) =>
              mdViolation({
                element: `${doc.relPath} (${opts.section ? `${String(opts.section)} ` : ''}row ${row.rowIndex + 1})`,
                file: doc.file,
                line: row.table.line,
                message,
                sourceText: doc.text,
                context: ctx,
              }),
            ),
        ),
      ),
  }
}
