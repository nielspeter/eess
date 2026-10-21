import type { Nodes, Root } from 'mdast'

/**
 * Phrasing runs (plan 0539): the inline text of each paragraph, heading and table cell, as segments
 * that keep where each piece of text sits. A run's segments joined are its text, so a pattern can be
 * matched across emphasis and soft breaks; each segment says whether it is inline code and which link
 * holds it. `links()` keeps its own block walk (`links.ts`), which needs block ancestry and URL spans,
 * not runs.
 *
 * Not walked: fenced and indented code, front matter, and HTML comments, which a reader never sees.
 * What a reader sees but this walk cannot place in a run is returned as unread text with its cause:
 * a raw HTML block, a reference-style link's text, an image's alt text and a link's or image's title.
 */

/** One piece of a run's text and where it sits. */
interface PhrasingSegment {
  readonly text: string
  /** 1-based line of the segment's first character. */
  readonly line: number
  readonly inCode: boolean
  /** The link holding this segment, if any. */
  readonly link?: { readonly url: string }
}

/** The inline text of one paragraph, heading or table cell. */
export interface PhrasingRun {
  readonly segments: readonly PhrasingSegment[]
  /** The block's source span, when the parser gave one. */
  readonly start?: number
  readonly end?: number
}

/** Why a piece of text a reader sees is not in any run. */
export type UnreadCause = 'html-block' | 'reference-link' | 'image-alt' | 'link-title'

/** Text a reader sees that no run holds. */
interface UnreadText {
  readonly text: string
  readonly line: number
  readonly cause: UnreadCause
}

const isComment = (html: string): boolean => /^\s*<!--[\s\S]*-->\s*$/.test(html)

/** Every run and every piece of unread text in `root`, in document order. */
export function phrasingOf(root: Root): {
  readonly runs: PhrasingRun[]
  readonly unread: UnreadText[]
} {
  const runs: PhrasingRun[] = []
  const unread: UnreadText[] = []
  const lineOf = (node: Nodes): number => node.position?.start.line ?? 0

  const inline = (
    node: Nodes,
    out: PhrasingSegment[],
    link: { readonly url: string } | undefined,
  ): void => {
    switch (node.type) {
      case 'text':
        out.push({ text: node.value, line: lineOf(node), inCode: false, ...(link ? { link } : {}) })
        return
      case 'inlineCode':
        out.push({ text: node.value, line: lineOf(node), inCode: true, ...(link ? { link } : {}) })
        return
      case 'break':
        out.push({ text: '\n', line: lineOf(node), inCode: false, ...(link ? { link } : {}) })
        return
      case 'link':
        if (node.title) unread.push({ text: node.title, line: lineOf(node), cause: 'link-title' })
        for (const child of node.children) inline(child, out, { url: node.url })
        return
      case 'linkReference': {
        // Its target is a definition elsewhere; the text is reported, not read as linked or not.
        const text = node.children.map(textOf).join('')
        unread.push({ text, line: lineOf(node), cause: 'reference-link' })
        return
      }
      case 'image':
        if (node.alt) unread.push({ text: node.alt, line: lineOf(node), cause: 'image-alt' })
        if (node.title) unread.push({ text: node.title, line: lineOf(node), cause: 'link-title' })
        return
      case 'imageReference':
        if (node.alt) unread.push({ text: node.alt, line: lineOf(node), cause: 'image-alt' })
        return
      case 'html':
        // Inline HTML: a tag, never text; the text around it is read as plain text.
        return
      default:
        if ('children' in node) for (const child of node.children) inline(child, out, link)
    }
  }

  const block = (node: Nodes): void => {
    if (node.type === 'code' || node.type === 'yaml') return
    if (node.type === 'html') {
      if (!isComment(node.value))
        unread.push({ text: node.value, line: lineOf(node), cause: 'html-block' })
      return
    }
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      const segments: PhrasingSegment[] = []
      for (const child of node.children) inline(child, segments, undefined)
      runs.push({
        segments,
        ...(node.position?.start.offset !== undefined ? { start: node.position.start.offset } : {}),
        ...(node.position?.end.offset !== undefined ? { end: node.position.end.offset } : {}),
      })
      return
    }
    if ('children' in node) for (const child of node.children) block(child)
  }

  block(root)
  return { runs, unread }
}

/** The plain text of an inline node, for unread reference-link text. */
function textOf(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(textOf).join('')
  return ''
}
