import type { ArchViolation, Condition, ConditionContext, Undecided } from '@nielspeter/eess'
import { undecidedViolations } from '@nielspeter/eess/internal'
import type { MdDocument, MdTable } from '../model/document.js'
import { mdViolation } from '../model/violation.js'
import { hasSection, tableInSection } from '../model/query.js'
import { checkDepth } from '../model/name-match.js'
import { headingNotes, sectionsOf, titleFault, type HaveSectionOptions } from '../model/sections.js'
import { satisfyingReader, satisfyingText } from '../model/section-any.js'
import {
  citesHeadings,
  declaresSections,
  sectionDeclarationsOf,
} from '../model/section-declarations.js'

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
  const missing = (d: MdDocument, ctx: ConditionContext): ArchViolation => {
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
  }
  const declared = options.depth === undefined ? [] : [{ name, depth: options.depth }]
  const p = options.satisfying
  if (p === undefined) {
    const condition: Condition<MdDocument> = {
      description: `have section "${String(name)}"${at}`,
      evaluate: (docs, ctx) =>
        docs.filter((d) => !hasSection(d, name, options.depth)).map((d) => missing(d, ctx)),
    }
    return declared.length === 0 ? condition : declaresSections(condition, declared)
  }
  // Plan 0582: at least one section of the name satisfies `p`. Each document's cause is its own
  // finding: no such section (line 1, as without the option); sections that none satisfies (one
  // finding per section, at its heading); or, when none satisfies and one cannot be judged, only
  // the causes, since the verdict depends on them (ADR-021).
  const read = satisfyingReader(name, options.depth, p)
  const satisfying = satisfyingText(p)
  const condition: Condition<MdDocument> = {
    description: `have a section "${String(name)}"${at}${satisfying}`,
    evaluate: (docs, ctx) => {
      const found: ArchViolation[] = []
      const causes: Undecided[] = []
      for (const d of docs) {
        const { matching, membership } = read(d)
        if (membership === true) continue
        if (matching.length === 0) {
          found.push(missing(d, ctx))
          continue
        }
        if (membership !== false) {
          causes.push(...membership)
          continue
        }
        for (const s of matching) {
          found.push(
            citesHeadings(
              mdViolation({
                element: `${d.relPath}:${String(s.line)}`,
                file: d.file,
                line: s.line,
                message: `section "${s.name}" does not satisfy "${p.description}", and no section "${String(name)}"${at} in this document does`,
                sourceText: d.text,
                context: ctx,
              }),
              [s.line],
            ),
          )
        }
      }
      return [...found, ...undecidedViolations(causes, ctx, found)]
    },
  }
  return declaresSections(condition, sectionDeclarationsOf([p], declared))
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

/** Condition: every matched document has a title (a first heading at depth 1), matching `name` if given. */
export function haveTitle(name?: string | RegExp): Condition<MdDocument> {
  return {
    description: name === undefined ? 'have a title' : `have the title "${String(name)}"`,
    evaluate: (docs, ctx) =>
      docs.flatMap((d) => {
        const fault = titleFault(d, name)
        if (fault === undefined) return []
        return [
          mdViolation({
            element: d.relPath,
            file: d.file,
            line: sectionsOf(d)[0]?.line ?? 1,
            message: fault,
            sourceText: d.text,
            context: ctx,
          }),
        ]
      }),
  }
}
