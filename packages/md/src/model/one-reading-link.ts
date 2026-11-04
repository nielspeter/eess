import type { MdDocument } from './document.js'
import { oneReadingLinksOf, type MdOneReadingLinkRef } from './links.js'
import type { ArchViolation } from './violation.js'
import { unreadFinding } from './unread-finding.js'

/**
 * A link only one reading of a line-1 `---` block holds (spike 0613): GitHub and VitePress drop the
 * block as front matter, a reader of the whole document reads it as Markdown, and the two disagree
 * whether the link is there. `links()` reports each one its predicates reach, unsuppressable
 * (ADR-021), and never hands it to a condition, which could pass on it. In `model/`, below the builders.
 */
export const ONE_READING_LINK = 'md/link-one-reading-holds'

/** A one-reading link with its document. */
export interface MdOneReadingLink extends MdOneReadingLinkRef {
  readonly doc: MdDocument
}

/** A document's one-reading links, each with its document. */
export function oneReadingLinksIn(doc: MdDocument): MdOneReadingLink[] {
  return oneReadingLinksOf(doc).map((l) => ({ ...l, doc }))
}

/** Why the link cannot be judged, as a finding and a refusal say it. */
export function oneReadingReason(l: MdOneReadingLink): string {
  const where = l.onlyWhere === 'markdown' ? 'read as Markdown' : 'front matter'
  return (
    `the link to "${l.url}" is a link only where the line-1 \`---\` block is ${where}: a renderer ` +
    `that drops front matter (GitHub, VitePress) and a reader of the whole document disagree ` +
    `whether it is there, so this rule cannot judge it`
  )
}

const REMEDY: Readonly<Record<MdOneReadingLinkRef['onlyWhere'], string>> = {
  markdown:
    'Move the link or its definition out of the line-1 `---` block, or quote the YAML value that holds it, so both readers agree.',
  'front-matter':
    'Close in the line-1 `---` block what it opens (a fence, a comment, an HTML element), or move the definition the block shadows, so both readers agree.',
}

/** One finding per one-reading link the rule reaches: `.excluding()` cannot hide it. */
export function oneReadingFindings(links: readonly MdOneReadingLink[]): ArchViolation[] {
  return links.map((l) =>
    unreadFinding({
      ruleId: ONE_READING_LINK,
      element: `${l.doc.relPath}:${String(l.line)}`,
      file: l.doc.file,
      line: l.line,
      message: oneReadingReason(l),
      suggestion: REMEDY[l.onlyWhere],
    }),
  )
}
