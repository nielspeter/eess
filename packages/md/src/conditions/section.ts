import { ArchConfigError, type Condition } from '@nielspeter/eess'
import { mdViolation } from '../model/violation.js'
import { checkDepth } from '../model/name-match.js'
import { contains, headingNotes, type MdSectionElement } from '../model/sections.js'
import { citesHeadings, declaresSections } from '../model/section-declarations.js'
import { subsectionsOf, subsectionText, type SubsectionOptions } from '../predicates/section.js'
import { columnsText, hasColumns } from './structure.js'

/**
 * Plan 0496: the conditions over sections. Each finding is at the section's heading, named
 * `relPath:line` as every element on one line is.
 */

const where = (s: MdSectionElement): string => `${s.doc.relPath}:${String(s.line)}`

/**
 * Condition: every selected section contains a section of `name` (at `depth`, when given). A
 * heading of the name inside the section that does not count, at another depth or in a container,
 * is named in the finding.
 */
export function haveSubsection(
  name: string | RegExp,
  options: SubsectionOptions = {},
): Condition<MdSectionElement> {
  checkDepth(options.depth, 'haveSubsection')
  const wanted = subsectionText(name, options.depth)
  return declaresSections(
    {
      description: `have subsection ${wanted}`,
      evaluate: (sections, ctx) =>
        sections
          .filter((s) => subsectionsOf(s, name, options.depth).length === 0)
          .map((s) => {
            const notes = headingNotes(s.doc, name, {
              depth: options.depth,
              from: s.line + 1,
              to: s.endLine,
            })
            return citesHeadings(
              mdViolation({
                element: where(s),
                file: s.doc.file,
                line: s.line,
                message: `section "${s.name}" has no subsection ${wanted}${notes.map((n) => `; ${n.note}`).join('')}`,
                sourceText: s.doc.text,
                context: ctx,
              }),
              notes.map((n) => n.line),
            )
          }),
    },
    [{ name, ...(options.depth === undefined ? {} : { depth: options.depth }) }],
  )
}

/** What the section `haveTable` takes: the columns only. The section is the selection. */
export interface SectionTableOptions {
  /** Each regex must match at least one header cell. */
  readonly columns: readonly RegExp[]
}

/**
 * Condition: every selected section contains a table with the columns. The document form passes
 * when any table under a heading of the name has them; this one asserts it of each section. A
 * `section` option has no meaning here beyond the selection, so passing one is refused.
 */
export function sectionHaveTable(options: SectionTableOptions): Condition<MdSectionElement> {
  if ('section' in options) {
    throw new ArchConfigError(
      'haveTable',
      'sections().haveTable() takes { columns } only: the sections are the selection, so select ' +
        'them with .that().areNamed(…) instead of passing `section`',
    )
  }
  const cols = columnsText(options.columns)
  return {
    description: `have a table with columns ${cols}`,
    evaluate: (sections, ctx) =>
      sections
        .filter(
          (s) => !s.doc.tables.some((t) => contains(s, t.line) && hasColumns(t, options.columns)),
        )
        .map((s) =>
          mdViolation({
            element: where(s),
            file: s.doc.file,
            line: s.line,
            message: `section "${s.name}" has no table with the required columns (${cols})`,
            sourceText: s.doc.text,
            context: ctx,
          }),
        ),
  }
}
