import type { Root, Nodes } from 'mdast'
import { textOf } from './text-of.js'
import { enterHeading, headingName } from './document.js'
import { isLabelAlone, opensWithLabel, wrappedLabelOf } from './label.js'
import type { MdDocument } from './document.js'

/** A markdown link occurrence within a document (before doc back-reference). */
export interface MdLinkRef {
  /** Raw URL as written, e.g. `./other.md#section` or `https://example.com`. */
  readonly url: string
  /** Link text. */
  readonly text: string
  /** 1-based line in the source document. */
  readonly line: number
  /** True for `scheme:` / protocol-relative URLs (http, https, mailto, //…). */
  readonly external: boolean
  /**
   * Char offset span of the URL within the document source, for autofix
   * (plan 0066). Present only when the URL is locatable in the raw source
   * (plain paths; percent-encoded/entity URLs may be absent) — a fix is emitted
   * only when the exact span is known.
   */
  readonly urlStart?: number
  readonly urlEnd?: number
  /** The block that owns this link (plan 0405); absent in a heading or a table cell. */
  readonly block?: MdLinkBlock
  /** The headings above this link, outermost first, as `MdTable.sectionPath` records them. */
  readonly sectionPath?: readonly string[]
}

// A URL is external if it has a scheme (`https:`, `mailto:`) or is protocol-relative.
const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * The block that owns a link (plan 0405): its enclosing list item if it has
 * one, otherwise its enclosing paragraph. A paragraph that is a label alone
 * (`**Related to:**`) owns the list that follows it, and a labelled list item
 * owns its nested sub-list; in both cases the owner is recorded, since its first
 * line holds the label. A block that opens with a label of its own is always its
 * own owner — a parent never absorbs a label.
 *
 * `line` is the block's first source line; `text` is that line from the block's
 * content column, so a list marker (`-`, `1.`), a task box (`[ ]`) and a
 * blockquote `>` are not part of it.
 */
export interface MdLinkBlock {
  readonly line: number
  readonly text: string
}

/** One owning block and what it held — read by `areLabelled()`'s declaration scan. */
interface MdDeclarationBlock extends MdLinkBlock {
  /** Inline links (`[t](url)`) the block owns. */
  readonly links: number
  /** Reference-style links (`[t][ref]`, `[ref]`) the block owns; eess-md does not resolve these. */
  readonly references: number
}

interface Owner {
  readonly block: MdLinkBlock
  /** Whether this block's text opens with a label, so what nests under it is its declaration. */
  readonly labelled: boolean
}

const TASK_BOX = /^\[[ xX]\]\s+/
// What may precede a paragraph's later line: indentation and blockquote markers.
const LINE_PREFIX = /^\s*(?:>\s*)*/

/**
 * Collect inline markdown links (`[text](url)`) from a document tree, each with
 * its owning block and the headings above it, plus every owning block with what
 * it held, and every wrapped label that sits on a paragraph's second or later
 * line, where it owns nothing. Links inside fenced code are not parsed as `link`
 * nodes by mdast, so they are naturally excluded.
 */
export function collectLinkBlocks(
  root: Root,
  source?: string,
): { links: MdLinkRef[]; blocks: MdDeclarationBlock[]; midBlockLabels: MdLinkBlock[] } {
  const out: MdLinkRef[] = []
  const lines = source?.split('\n') ?? []
  const counts = new Map<number, { block: MdLinkBlock; links: number; references: number }>()
  const midBlockLabels: MdLinkBlock[] = []
  const headingStack: string[] = []

  // The block a node would own: its first line, read from its content column.
  const blockOf = (node: Nodes): Owner => {
    const first = node.type === 'listItem' ? (node.children[0] ?? node) : node
    const line = first.position?.start.line ?? 0
    const column = first.position?.start.column ?? 1
    const text = (lines[line - 1] ?? '').slice(column - 1).replace(TASK_BOX, '')
    return { block: { line, text }, labelled: opensWithLabel(text) }
  }
  const own = (o: Owner): Owner => {
    if (!counts.has(o.block.line))
      counts.set(o.block.line, { block: o.block, links: 0, references: 0 })
    return o
  }
  // A block opening with a label owns itself; otherwise it joins a labelled owner, or owns itself.
  const ownerFor = (node: Nodes, owner: Owner | undefined): Owner => {
    const mine = blockOf(node)
    if (mine.labelled || owner?.labelled !== true) return own(mine)
    return owner
  }

  const visitChildren = (children: readonly Nodes[], owner: Owner | undefined): void => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child === undefined) continue
      const next = children[i + 1]
      // A label alone on its paragraph owns the list right after it.
      if (child.type === 'paragraph' && next?.type === 'list') {
        const mine = blockOf(child)
        if (isLabelAlone(mine.block.text)) {
          own(mine)
          visit(child, mine)
          visit(next, mine)
          i++
          continue
        }
      }
      visit(child, owner)
    }
  }

  const visit = (node: Nodes, owner: Owner | undefined): void => {
    if (node.type === 'heading') {
      enterHeading(headingStack, node.depth, headingName(node))
      visitChildren(node.children, undefined)
      return
    }
    if (node.type === 'listItem') {
      visitChildren(node.children, ownerFor(node, owner))
      return
    }
    if (node.type === 'paragraph') {
      const start = node.position?.start.line ?? 0
      const end = node.position?.end.line ?? start
      for (let n = start + 1; n <= end; n++) {
        const text = (lines[n - 1] ?? '').replace(LINE_PREFIX, '')
        if (wrappedLabelOf(text) !== undefined) midBlockLabels.push({ line: n, text })
      }
      visitChildren(node.children, owner?.block.line === start ? owner : ownerFor(node, owner))
      return
    }
    if (node.type === 'linkReference' && owner !== undefined) {
      const c = counts.get(owner.block.line)
      if (c !== undefined) c.references++
    }
    if (node.type === 'link') {
      // Locate the URL's exact char span in the source (for autofix). The link
      // node's raw text is `[text](url …)`; the URL is the last occurrence of
      // `node.url` within it (a URL in the link text would come earlier). If the
      // source form differs from the decoded `node.url`, leave the span absent —
      // no fix is emitted without an exact span.
      let urlStart: number | undefined
      let urlEnd: number | undefined
      const startOff = node.position?.start.offset
      const endOff = node.position?.end.offset
      if (source !== undefined && startOff !== undefined && endOff !== undefined) {
        const raw = source.slice(startOff, endOff)
        const rel = raw.lastIndexOf(node.url)
        if (rel >= 0) {
          urlStart = startOff + rel
          urlEnd = urlStart + node.url.length
        }
      }
      if (owner !== undefined) {
        const c = counts.get(owner.block.line)
        if (c !== undefined) c.links++
      }
      out.push({
        url: node.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(node.url),
        urlStart,
        urlEnd,
        ...(owner !== undefined ? { block: owner.block } : {}),
        sectionPath: headingStack.filter((h) => h !== undefined),
      })
    }
    if ('children' in node) visitChildren(node.children, owner)
  }

  visitChildren(root.children, undefined)
  const blocks = [...counts.values()].map((c) => ({
    ...c.block,
    links: c.links,
    references: c.references,
  }))
  return { links: out, blocks, midBlockLabels }
}

/**
 * Collect inline markdown links (`[text](url)`) from a document tree. Links
 * inside fenced code are not parsed as `link` nodes by mdast, so they are
 * naturally excluded.
 */
export function collectLinks(root: Root, source?: string): MdLinkRef[] {
  return collectLinkBlocks(root, source).links
}

/** A link with its owning document attached — the element the builders and conditions operate on. */
export interface MdLink extends MdLinkRef {
  readonly doc: MdDocument
}
