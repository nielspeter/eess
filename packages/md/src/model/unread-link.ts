import type { MdDocument } from './document.js'
import { unreadLinksOf, type MdUnreadLinkRef, type UnreadLinkCause } from './links.js'
import type { ArchViolation } from './violation.js'

/**
 * An HTML link eess-md cannot read (plan 0580), as every reader reports it: `links()` on the subject
 * side (R4), and `sections().haveLink()` and `beLinkedBack()` where one stands in their evidence (R6).
 * One rule id, one text per cause, one remedy per cause, so a site reads the same wherever it is
 * reported. In `model/`, below the conditions and the builders that use it.
 */
export const UNREAD_LINK = 'md/unread-link'

/** An unread HTML link with its document. */
export interface MdUnreadLink extends MdUnreadLinkRef {
  readonly doc: MdDocument
}

/** A document's unread HTML links, each with its document. */
export function unreadLinksIn(doc: MdDocument): MdUnreadLink[] {
  return unreadLinksOf(doc).map((u) => ({ ...u, doc }))
}

const plural = (u: MdUnreadLink): boolean => (u.attributes?.length ?? 1) > 1
const values = (u: MdUnreadLink): string => (plural(u) ? 'values hold' : 'value holds')

/** "`href`'s", or "`href`'s and `title`'s". */
const names = (u: MdUnreadLink): string =>
  (u.attributes ?? ['href']).map((a) => `\`${a}\`'s`).join(' and ')

const WHERE: Record<UnreadLinkCause, (u: MdUnreadLink) => string> = {
  'split-tag': () => 'its HTML tag is cut by a blank line, which ends the HTML block',
  unterminated: () => 'its HTML tag never closes inside its HTML block',
  'unquoted-slash': (u) =>
    `the Markdown parser reads its tag as text, because ${names(u)} unquoted ${values(u)} a "/"`,
  'refused-tag': () => 'the Markdown parser reads its tag as text',
}

// Each remedy clears its finding (plan 0580, R3): measured by a row per cause.
const REMEDY: Record<UnreadLinkCause, (u: MdUnreadLink) => string> = {
  'split-tag': () => 'Keep the tag inside one HTML block: remove the blank lines inside it.',
  unterminated: () => 'Close the tag inside the same HTML block: its quote, or its ">".',
  'unquoted-slash': (u) =>
    `Quote ${names(u)} ${plural(u) ? 'values' : 'value'}: write each in double quotes.`,
  'refused-tag': () => 'Write the link in Markdown, `[text](url)`.',
}

/** Why the site cannot be read: "an HTML link here cannot be read: …". */
export function unreadLinkReason(u: MdUnreadLink): string {
  return `an HTML link here cannot be read: ${WHERE[u.cause](u)}`
}

/**
 * One unread finding (ADR-021 rule 5): it carries `bypassFilters`, so `.excluding()`, `.warn()`, an
 * exclusion comment and a baseline cannot hide it. The one constructor, so no reader writes the field
 * by hand and forgets it.
 */
export function unreadFinding(f: {
  readonly ruleId: string
  readonly element: string
  readonly file: string
  readonly line: number
  readonly message: string
  readonly suggestion: string
}): ArchViolation {
  return { rule: f.ruleId, bypassFilters: true, ...f }
}

/** An unread link's finding, with what it leaves unjudged: `so its target is not checked.` */
export function unreadLinkFinding(u: MdUnreadLink, consequence: string): ArchViolation {
  return unreadFinding({
    ruleId: UNREAD_LINK,
    element: `${u.doc.relPath}:${String(u.line)}`,
    file: u.doc.file,
    line: u.line,
    message: `${unreadLinkReason(u)}, ${consequence}`,
    suggestion: REMEDY[u.cause](u),
  })
}
