import type { Nodes, Root } from 'mdast'
import { headingName } from './document.js'

/**
 * Phrasing runs (plan 0539): the inline text of each paragraph, heading and table cell, as segments
 * that keep where each piece of text sits. A run's segments joined are its text, so a pattern can be
 * matched across emphasis and soft breaks; each segment says whether it is inline code and which link
 * holds it. `links()` keeps its own block walk (`links.ts`), which needs block ancestry and URL spans,
 * not runs.
 *
 * Not walked: fenced and indented code, front matter, and a block that is one HTML comment and
 * nothing else, which a reader never sees. What a reader sees but this walk cannot place in a run is
 * returned as unread text with its cause, never skipped: a raw HTML block, the text of a link written
 * in inline HTML, a reference-style link's text, a link definition's title, and an image's alt text
 * and title. A link's own title is read, as linked.
 */

/** A link a segment sits in: its URL, and its text joined as a heading's is (plan 0549). */
export interface PhrasingLink {
  readonly url: string
  readonly text: string
}

/** One piece of a run's text and where it sits. */
export interface PhrasingSegment {
  readonly text: string
  /** 1-based line of the segment's first character. */
  readonly line: number
  readonly inCode: boolean
  /** The link holding this segment, if any; one object per link, shared by its segments. */
  readonly link?: PhrasingLink
  /** The segment is the link's title, not its text. */
  readonly title?: true
}

/** The inline text of one paragraph, heading or table cell, or of one link's title. */
interface PhrasingRun {
  readonly segments: readonly PhrasingSegment[]
}

/** Why a piece of text a reader sees is not in any run. */
export type UnreadCause =
  | 'html-block'
  | 'html-link'
  | 'reference-link'
  | 'definition-title'
  | 'image-alt'
  | 'image-title'

/** Text a reader sees that no run holds. */
interface UnreadText {
  readonly text: string
  readonly line: number
  readonly cause: UnreadCause
}

/** Exactly one HTML comment, alone: `<!-- a --> text <!-- b -->` is not one, and its text is seen. */
const ONE_COMMENT = /^\s*<!--(?:(?!-->)[\s\S])*-->\s*$/
const OPENS_A = /^<a\s[^>]*\bhref\s*=/i
const CLOSES_A = /^<\/a\s*>/i

/** A link with no target is not a link to anything: `[x]()` and `[x](#)`. */
const pointsNowhere = (url: string): boolean => url.trim() === '' || url.trim() === '#'

/** Every run and every piece of unread text in `root`, in document order. */
export function phrasingOf(root: Root): {
  readonly runs: PhrasingRun[]
  readonly unread: UnreadText[]
} {
  const runs: PhrasingRun[] = []
  const unread: UnreadText[] = []
  const lineOf = (node: Nodes): number => node.position?.start.line ?? 0

  /** One block's inline walk. Text inside an HTML `<a>…</a>` goes to `htmlLink`, not the run. */
  const run = (children: readonly Nodes[]): PhrasingRun[] => {
    const out: PhrasingSegment[] = []
    /** Link titles, each its own run, after the block's (document order). */
    const titles: PhrasingRun[] = []
    let htmlLink: { text: string; line: number } | undefined

    const push = (seg: PhrasingSegment): void => {
      if (htmlLink === undefined) out.push(seg)
      else htmlLink.text += seg.text
    }

    const inline = (node: Nodes, link: PhrasingLink | undefined): void => {
      switch (node.type) {
        case 'text':
          push({ text: node.value, line: lineOf(node), inCode: false, ...(link ? { link } : {}) })
          return
        case 'inlineCode':
          push({ text: node.value, line: lineOf(node), inCode: true, ...(link ? { link } : {}) })
          return
        case 'break':
          push({ text: '\n', line: lineOf(node), inCode: false, ...(link ? { link } : {}) })
          return
        case 'link': {
          const target = pointsNowhere(node.url)
            ? undefined
            : { url: node.url, text: headingName(node) }
          for (const child of node.children) inline(child, target)
          // A link's title belongs to its link: a mention there is as linked as its text.
          if (node.title) {
            titles.push({
              segments: [
                {
                  text: node.title,
                  line: lineOf(node),
                  inCode: false,
                  title: true,
                  ...(target ? { link: target } : {}),
                },
              ],
            })
          }
          return
        }
        case 'linkReference':
          // Its target is a definition elsewhere; the text is reported, not read as linked or not.
          unread.push({
            text: node.children.map(visibleTextOf).join(''),
            line: lineOf(node),
            cause: 'reference-link',
          })
          return
        case 'image':
          if (node.alt) unread.push({ text: node.alt, line: lineOf(node), cause: 'image-alt' })
          if (node.title)
            unread.push({ text: node.title, line: lineOf(node), cause: 'image-title' })
          return
        case 'imageReference':
          if (node.alt) unread.push({ text: node.alt, line: lineOf(node), cause: 'image-alt' })
          return
        case 'html':
          // Inline HTML is a tag, never text, except that the text of an `<a>` is a link this walk
          // cannot read: it is reported, so the author is not told to add a link that is there.
          // An `<a>` inside a Markdown link is inside that link already.
          if (OPENS_A.test(node.value) && link === undefined)
            htmlLink ??= { text: '', line: lineOf(node) }
          else if (CLOSES_A.test(node.value) && htmlLink !== undefined) {
            unread.push({ text: htmlLink.text, line: htmlLink.line, cause: 'html-link' })
            htmlLink = undefined
          }
          return
        default:
          if ('children' in node) for (const child of node.children) inline(child, link)
      }
    }

    for (const child of children) inline(child, undefined)
    if (htmlLink !== undefined) {
      unread.push({ text: htmlLink.text, line: htmlLink.line, cause: 'html-link' })
    }
    return [{ segments: out }, ...titles]
  }

  const block = (node: Nodes): void => {
    if (node.type === 'code' || node.type === 'yaml') return
    if (node.type === 'html') {
      if (!ONE_COMMENT.test(node.value))
        unread.push({ text: node.value, line: lineOf(node), cause: 'html-block' })
      return
    }
    if (node.type === 'definition') {
      if (node.title)
        unread.push({ text: node.title, line: lineOf(node), cause: 'definition-title' })
      return
    }
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      runs.push(...run(node.children))
      return
    }
    if ('children' in node) for (const child of node.children) block(child)
  }

  block(root)
  return { runs, unread }
}

/**
 * The text a reader sees in an inline node: text and inline code, never raw HTML. Not
 * `model/text-of.ts`'s `textOf`, which keeps every string value, an HTML tag's included.
 */
function visibleTextOf(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(visibleTextOf).join('')
  return ''
}
