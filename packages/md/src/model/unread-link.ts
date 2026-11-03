import type { MdDocument } from './document.js'
import { unreadLinksOf, type MdUnreadLinkRef, type UnreadLinkCause } from './links.js'
import type { ArchViolation } from './violation.js'
import { unreadFinding } from './unread-finding.js'

/**
 * An HTML link eess-md cannot read (plan 0580), as its readers report it: `links()` on the subject
 * side (R4), and `sections().should().haveLink()` and `beLinkedBack()` where one stands in their
 * evidence (R6), each as `md/unread-link` with one text and one remedy per cause. After
 * `.that().haveLink()` the site is the kernel's undecided finding, under the rule's own id (ADR-021):
 * its message carries the same reason and remedy. In `model/`, below the conditions and the builders.
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

/** The remedy that clears the site's finding, by its cause. */
export function unreadLinkRemedy(u: MdUnreadLink): string {
  return REMEDY[u.cause](u)
}

/**
 * The site as one finding is keyed: its document, line, cause and attributes, so two sites on one
 * line with different causes are two findings (ADR-021 rule 5), and one site is one however many
 * readers reach it in a rule.
 */
export function unreadSiteKey(u: MdUnreadLink): string {
  return `${u.doc.file}:${String(u.line)}:${unreadLinkRemedy(u)}`
}

/** Why the site cannot be read: "an HTML link here cannot be read: …". */
export function unreadLinkReason(u: MdUnreadLink): string {
  return `an HTML link here cannot be read: ${WHERE[u.cause](u)}`
}

/** An unread link's finding, with what it leaves unjudged: `so its target is not checked.` */
export function unreadLinkFinding(u: MdUnreadLink, consequence: string): ArchViolation {
  return unreadFinding({
    ruleId: UNREAD_LINK,
    element: `${u.doc.relPath}:${String(u.line)}`,
    file: u.doc.file,
    line: u.line,
    message: `${unreadLinkReason(u)}, ${consequence}`,
    suggestion: unreadLinkRemedy(u),
  })
}
