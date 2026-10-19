import type { MdDocument, MdTable } from './document.js'
import { sectionsMatching } from './sections.js'
import { matchName } from './name-match.js'

/** Does the document have a heading matching `name` — at `depth`, when one is given? */
export function hasSection(doc: MdDocument, name: string | RegExp, depth?: number): boolean {
  return sectionsMatching(doc, name, depth).length > 0
}

/**
 * Is the element — a table, a link (plan 0405) or a section (plan 0496) — under a heading matching
 * `section` (or is no section required)?
 */
export function inSection(
  element: { readonly sectionPath?: readonly string[] },
  section?: string | RegExp,
): boolean {
  if (section === undefined) return true
  return (element.sectionPath ?? []).some((h) => matchName(h, section))
}

/** Is the table under a heading matching `section` (or is no section required)? */
export function tableInSection(table: MdTable, section?: string | RegExp): boolean {
  return inSection(table, section)
}
