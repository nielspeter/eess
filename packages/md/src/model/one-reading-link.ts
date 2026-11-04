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

/** Why the link cannot be judged, as a finding and a refusal say it; a reference names its definition. */
export function oneReadingReason(l: MdOneReadingLink): string {
  const where = l.onlyWhere === 'markdown' ? 'read as Markdown' : 'front matter'
  const def =
    l.definition === undefined
      ? ''
      : ` (the definition of [${l.definition.label}] at line ${String(l.definition.line)})`
  return (
    `the link to "${l.url}"${def} is a link only where the line-1 \`---\` block is ${where}: a ` +
    `renderer that drops front matter (GitHub, VitePress) and a reader of the whole document ` +
    `disagree whether it is there, so this rule cannot judge it`
  )
}

/**
 * What makes the two readers agree, each measured to clear the finding: a link the Markdown reading
 * alone holds leaves the block; a body definition the block's shadows has one of the two removed; a
 * body link a construct the block opens swallows has that construct closed in the block.
 */
function remedyOf(l: MdOneReadingLink): string {
  if (l.onlyWhere === 'markdown')
    return l.definition === undefined
      ? 'Move the link out of the line-1 `---` block, so both readers agree.'
      : `Move the definition of [${l.definition.label}] (line ${String(l.definition.line)}) out of the line-1 \`---\` block, so both readers agree.`
  // The shadowing remedy only where the block defines the label itself; otherwise what the block
  // opens swallowed the reference and its definition, and closing it is the fix (the review).
  return l.definition !== undefined && l.shadowedAt !== undefined
    ? `Remove one of the two definitions of [${l.definition.label}], the one in the line-1 \`---\` block (line ${String(l.shadowedAt)}) or the one at line ${String(l.definition.line)}, so both readers agree.`
    : 'Close in the line-1 `---` block what it opens (a fence, a comment, an HTML element), so both readers agree.'
}

/**
 * One finding per one-reading link the rule reaches, once per line and URL: `.excluding()` cannot
 * hide it.
 */
export function oneReadingFindings(links: readonly MdOneReadingLink[]): ArchViolation[] {
  const seen = new Set<string>()
  return links.flatMap((l) => {
    const key = `${l.doc.relPath}\u0000${String(l.line)}\u0000${l.url}`
    if (seen.has(key)) return []
    seen.add(key)
    return [
      unreadFinding({
        ruleId: ONE_READING_LINK,
        element: `${l.doc.relPath}:${String(l.line)}`,
        file: l.doc.file,
        line: l.line,
        message: oneReadingReason(l),
        suggestion: remedyOf(l),
      }),
    ]
  })
}
