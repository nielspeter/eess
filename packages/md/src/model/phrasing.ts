import type { Nodes, Root } from 'mdast'
import { headingName } from './document.js'
import { isLinkStart, isOnlyComment, readHtmlNode } from './html-attributes.js'

/**
 * Phrasing runs (plan 0539): the inline text of each paragraph, heading and table cell, as segments
 * that keep where each piece of text sits. A run's segments joined are its text, so a pattern can be
 * matched across emphasis and soft breaks; each segment says whether it is inline code and which link
 * holds it. `links()` keeps its own block walk (`links.ts`), which needs block ancestry and URL spans,
 * not runs.
 *
 * Not walked: fenced and indented code, front matter, and a block that is only HTML comments (bogus
 * ones included, `isOnlyComment`), which a reader never sees. What a reader sees but this walk cannot place in a run is
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
  /**
   * Each character's source offset, or -1 where none is known (plan 0550): an entity's character, or
   * everything after the walk lost its place. Absent when no source was given.
   */
  readonly offsets?: readonly number[]
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

/** A link with no target is not a link to anything: `[x]()` and `[x](#)`. */
const pointsNowhere = (url: string): boolean => url.trim() === '' || url.trim() === '#'

const ENTITY = /^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/

/**
 * Each character of a text node's `value` mapped to its offset in `source`, walking both from the
 * node's start (plan 0550). mdast drops what a reader does not see, and each is stepped over: a line's
 * container prefix (indentation, `>`) after a line break, a `\r` before one, and the backslash of an
 * escape. An entity's character has no single offset (-1). Anything else loses the place, and every
 * character after it is -1. A place found is the one this walk reached in order, never a search.
 */
function sourceOffsets(value: string, source: string, from: number): number[] {
  const out: number[] = []
  let s = from
  let afterBreak = false
  for (const ch of value) {
    for (let k = 0; k < ch.length - 1; k++) out.push(-1)
    if (afterBreak) {
      while (s < source.length && source[s] !== ch && /[ \t>]/.test(source[s] ?? '')) s++
      afterBreak = false
    }
    if (ch === '\n' && source[s] === '\r') s++
    if (source[s] === '&' && ENTITY.test(source.slice(s, s + 40))) {
      // An entity's `&` decodes to another character, so a different one here means it did, and
      // its whole reference is that one character. A literal `&` here is ambiguous: an entity that
      // decoded to `&`, or one micromark left as it was. The place is lost rather than guessed.
      if (ch === '&') break
      const entity = ENTITY.exec(source.slice(s, s + 40))
      out.push(-1)
      s += entity?.[0].length ?? 1
      continue
    }
    if (source.startsWith(ch, s)) {
      out.push(s)
      s += ch.length
      if (ch === '\n') afterBreak = true
      continue
    }
    if (source[s] === '\\' && source.startsWith(ch, s + 1)) {
      out.push(s + 1)
      s += 1 + ch.length
      continue
    }
    break
  }
  while (out.length < value.length) out.push(-1)
  return out
}

/** Every run and every piece of unread text in `root`, in document order. `source` gives segments their offsets. */
export function phrasingOf(
  root: Root,
  source: string | undefined,
): {
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
        case 'text': {
          const at = node.position?.start.offset
          push({
            text: node.value,
            line: lineOf(node),
            inCode: false,
            ...(link ? { link } : {}),
            ...(source !== undefined && at !== undefined
              ? { offsets: sourceOffsets(node.value, source, at) }
              : {}),
          })
          return
        }
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
          // The tag is read by the one HTML reader (plan 0580): `data-href` is not an `href`, and a
          // quoted `>` does not end the tag (bug 0593). Only an `<a>` holds text: an `<area>` is void.
          if (
            link === undefined &&
            readHtmlNode(node).starts.some((t) => t.name === 'a' && isLinkStart(t))
          )
            htmlLink ??= { text: '', line: lineOf(node) }
          else if (htmlLink !== undefined && readHtmlNode(node).ends.some((e) => e.name === 'a')) {
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
      if (!isOnlyComment(node.value))
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
