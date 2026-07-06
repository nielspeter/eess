import type { MdDocument, MdTable } from './document.js'
import { tableInSection } from './query.js'

/**
 * A single body row of a GFM table, as a first-class element.
 *
 * This is the element type of the `rows()` entry point and the context passed
 * to `haveTableRowsSatisfying`'s row validator — one type, two consumers. A row
 * carries its located-column accessor (`get`), its real source line, and back
 * references to the document and table it came from.
 */
export interface MdRow {
  /** The row's cells, trimmed. */
  readonly cells: readonly string[]
  /** Cell text for a located column role (`''` if the role's column wasn't found). */
  readonly get: (role: string) => string
  /** 0-based data-row index within its table (header excluded). */
  readonly rowIndex: number
  /** 1-based source line of this row — the exact file:line for diagnostics. */
  readonly line: number
  /** The document this row belongs to. */
  readonly doc: MdDocument
  /** The table this row belongs to. */
  readonly table: MdTable
}

/** How role names map to header-column patterns. Every role must be present. */
export type ColumnSpec = Readonly<Record<string, RegExp>>

/** Options shared by `rows()` and `haveTableRowsSatisfying`. */
export interface RowMatchOptions {
  /** Restrict to tables under a heading matching this. */
  readonly section?: string | RegExp
  /**
   * role → header pattern. A table participates only if its header matches
   * every pattern; the row's `get(role)` then reads the located cell.
   */
  readonly columns: ColumnSpec
}

/** Does a table's header contain a column for every required role? */
function tableHasColumns(table: MdTable, columns: ColumnSpec): boolean {
  return Object.values(columns).every((re) => table.header.some((h) => re.test(h)))
}

/** Locate the header index for each role (−1 if absent). */
function columnIndices(table: MdTable, columns: ColumnSpec): Map<string, number> {
  const colIndex = new Map<string, number>()
  for (const [role, re] of Object.entries(columns)) {
    colIndex.set(
      role,
      table.header.findIndex((h) => re.test(h)),
    )
  }
  return colIndex
}

/**
 * How many matching tables to draw rows from:
 * - `all` (default) — every matching table contributes rows. A correspondence
 *   source (`rows()`) must not silently ignore a second matching table.
 * - `first` — only the first matching table, preserving the historical
 *   `haveTableRowsSatisfying` semantics.
 */
export type RowMatchMode = 'all' | 'first'

/**
 * Extract table rows as first-class `MdRow` elements.
 *
 * Finds the tables in the document that sit under the requested section (if
 * any) and have all the requested columns (`mode` decides all vs. first), then
 * yields one `MdRow` per body row with its real source line.
 */
export function matchTableRows(
  doc: MdDocument,
  opts: RowMatchOptions,
  mode: RowMatchMode = 'all',
): MdRow[] {
  const matching = doc.tables.filter(
    (t) => tableInSection(t, opts.section) && tableHasColumns(t, opts.columns),
  )
  const tables = mode === 'first' ? matching.slice(0, 1) : matching

  return tables.flatMap((table) => {
    const colIndex = columnIndices(table, opts.columns)
    return table.rows.map((cells, rowIndex) => {
      const get = (role: string): string => {
        const idx = colIndex.get(role)
        return idx !== undefined && idx >= 0 ? (cells[idx] ?? '') : ''
      }
      return {
        cells,
        get,
        rowIndex,
        line: table.rowLines[rowIndex] ?? table.line,
        doc,
        table,
      }
    })
  })
}
