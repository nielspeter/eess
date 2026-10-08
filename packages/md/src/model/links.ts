import type { Root, Nodes } from 'mdast'
import { textOf } from './text-of.js'
import { enterHeading, headingName } from './document.js'
import { isLabelAlone } from './label.js'
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
 * line holds the label. `line` and `text` are that first source line.
 */
interface MdLinkBlock {
  readonly line: number
  readonly text: string
}

/** One owning block and what it held — read by `areLabelled()`'s near-miss scan. */
interface MdDeclarationBlock extends MdLinkBlock {
  /** Inline links (`[t](url)`) the block owns. */
  readonly links: number
  /** Reference-style links (`[t][ref]`, `[ref]`) the block owns; eess-md does not resolve these. */
  readonly references: number
}

// A label in any form opening a line (see `model/label.ts`); used only to decide
// whether a block OWNS what nests under it.
const OPENS_WITH_LABEL =
  /^\s*(?:[-*+]\s+)?(?:\*\*[^*\n]+:\*\*|\*\*[^*\n]+\*\*\s*:|__[^_\n]+__\s*:|[^\s:*_][^:\n]*:)/

interface Owner {
  readonly block: MdLinkBlock
  /** Whether this block's first line is a label, so what nests under it is its declaration. */
  readonly labelled: boolean
}

/**
 * Collect inline markdown links (`[text](url)`) from a document tree, each with
 * its owning block and the headings above it, plus every owning block with what
 * it held. Links inside fenced code are not parsed as `link` nodes by mdast, so
 * they are naturally excluded.
 */
export function collectLinkBlocks(
  root: Root,
  source?: string,
): { links: MdLinkRef[]; blocks: MdDeclarationBlock[] } {
  const out: MdLinkRef[] = []
  const lines = source?.split('\n') ?? []
  const counts = new Map<number, { block: MdLinkBlock; links: number; references: number }>()
  const headingStack: string[] = []

  const ownerOf = (node: Nodes): Owner => {
    const line = node.position?.start.line ?? 0
    const text = lines[line - 1] ?? ''
    const block: MdLinkBlock = { line, text }
    if (!counts.has(line)) counts.set(line, { block, links: 0, references: 0 })
    return { block, labelled: OPENS_WITH_LABEL.test(text) }
  }

  const visitChildren = (children: readonly Nodes[], owner: Owner | undefined): void => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child === undefined) continue
      const next = children[i + 1]
      // A label alone on its paragraph owns the list right after it.
      if (
        child.type === 'paragraph' &&
        owner === undefined &&
        next?.type === 'list' &&
        isLabelAlone(lines[(child.position?.start.line ?? 0) - 1] ?? '')
      ) {
        const labelOwner = ownerOf(child)
        visit(child, labelOwner)
        visit(next, labelOwner)
        i++
        continue
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
      visitChildren(node.children, owner?.labelled === true ? owner : ownerOf(node))
      return
    }
    if (node.type === 'paragraph') {
      visitChildren(node.children, owner ?? ownerOf(node))
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
  return { links: out, blocks }
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
