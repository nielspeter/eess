import type { Condition } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import { mdViolation } from '../model/violation.js'
import { hasSection, tableInSection } from '../model/query.js'

/** Condition: every matched document must have a heading matching `name`. */
export function haveSection(name: string | RegExp): Condition<MdDocument> {
  return {
    description: `have section "${String(name)}"`,
    evaluate: (docs, ctx) =>
      docs
        .filter((d) => !hasSection(d, name))
        .map((d) =>
          mdViolation({
            element: d.relPath,
            file: d.file,
            line: 1,
            message: `missing section "${String(name)}"`,
            sourceText: d.text,
            context: ctx,
          }),
        ),
  }
}

export interface HaveTableOptions {
  /** Restrict to a table under this heading. */
  readonly section?: string | RegExp
  /** Each regex must match at least one header cell. */
  readonly columns: readonly RegExp[]
}

/** Condition: the document must contain a GFM table with the required columns. */
export function haveTable(opts: HaveTableOptions): Condition<MdDocument> {
  const colDesc = opts.columns.map(String).join(', ')
  return {
    description: `have a table with columns ${colDesc}${opts.section ? ` in section "${String(opts.section)}"` : ''}`,
    evaluate: (docs, ctx) =>
      docs.flatMap((d) => {
        const candidates = d.tables.filter((t) => tableInSection(t, opts.section))
        const satisfied = candidates.some((t) =>
          opts.columns.every((col) => t.header.some((h) => col.test(h))),
        )
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
