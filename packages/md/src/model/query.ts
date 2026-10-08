import type { MdDocument, MdTable } from './document.js'

/** Match a string against a name matcher (exact string or regex). */
function matchName(value: string, name: string | RegExp): boolean {
  return typeof name === 'string' ? value === name : name.test(value)
}

/** Does the document have a heading matching `name`? */
export function hasSection(doc: MdDocument, name: string | RegExp): boolean {
  return doc.sections.some((s) => matchName(s.name, name))
}

/**
 * Is the element — a table, or a link (plan 0405) — under a heading matching
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
