import type { Root, Nodes } from 'mdast'
import { textOf } from './text-of.js'
import { isLabelAlone, wrappedLabelOf } from './label.js'
import type { MdDocument } from './document.js'
import { sectionPathAt } from './sections.js'
import { definitionsOf, type MdLinkDefinition } from './definitions.js'
import { destinationAt, writtenAt } from './destination.js'
import { danglingReferencesIn } from './dangling-references.js'

export type { MdLinkDefinition } from './definitions.js'

/**
 * The Markdown parser handed eess-md a reference-style link without the definition it pairs it
 * with (bug 0558): eess-md and the installed `mdast-util-from-markdown` disagree. Never the rule
 * author's fault, so not an `ArchConfigError`; eess-ts reports it as the crash it is.
 */
class ParserContractBroken extends Error {
  constructor(label: string) {
    super(
      `eess-md: the Markdown parser gave the reference [${label}] no definition it pairs with. ` +
        'eess-md and the installed mdast-util-from-markdown disagree about reference links; ' +
        'please report it to eess, with both versions.',
    )
    this.name = 'ParserContractBroken'
  }
}

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
  /** The innermost block that holds this link (plan 0405); absent in a heading or a table cell. */
  readonly block?: MdLinkBlock
  /**
   * Every block enclosing this link, outermost first, ending with `block` — the
   * paragraphs and list items it sits in, and a label alone on its paragraph for
   * the lists directly after it (plan 0405). Mirrors `sectionPath`.
   */
  readonly blockPath?: readonly MdLinkBlock[]
  /**
   * The sections that contain this link, outermost first, as `MdTable.sectionPath` records them:
   * read from the section index (bug 0502), so a heading in a list item or blockquote, which does
   * not start a section, is never in it. Set by `linksOf`.
   */
  readonly sectionPath?: readonly string[]
  /**
   * For a reference-style link, `[text][label]`, `[label][]` or `[label]` (bug 0558): the definition
   * that holds its URL. `url`, `urlStart` and `urlEnd` are the definition's, and `line` is the
   * reference's own.
   */
  readonly definition?: MdLinkDefinition
  /**
   * For a full or collapsed reference whose label has no definition (bug 0558): the label as the
   * source writes it. Such a link has no destination (`url` is `''`); `resolve()` and
   * `beLinkedBack()` report it as having no definition.
   */
  readonly undefinedReference?: { readonly label: string }
}

// A URL is external if it has a scheme (`https:`, `mailto:`) or is protocol-relative.
// Exported model-internally (plan 0549), so `mentions()` and `links()` cannot disagree about a link.
export const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * A block that can hold a link (plan 0405): a paragraph or a list item.
 *
 * `line` is the block's first source line; `text` is that line from the block's
 * content column, so a list marker (`-`, `1.`), a task box (`[ ]`) and a
 * blockquote `>` are not part of it.
 */
export interface MdLinkBlock {
  readonly line: number
  readonly text: string
}

/** A label written where no block starts — read by `areLabelled()`'s declaration scan. */
interface MdUnreadLabel {
  readonly line: number
  readonly label: string
  /** `position`: not where a block starts; `format`: at a block's start, in a form the grammar does not read. */
  readonly reason: 'position' | 'format'
}

const TASK_BOX = /^\[[ xX]\]\s+/

/**
 * The label a `strong` node writes, or `undefined`: `**Label:**` (the colon
 * inside) or `**Label**:` (the colon in the text after it). `__Label__:` is a
 * `strong` node too.
 */
function strongLabel(node: Nodes, next: Nodes | undefined): string | undefined {
  if (node.type !== 'strong') return undefined
  const text = textOf(node)
  // `**Label:**`, and a whole line in bold (`**Label: [a](a.md)**`).
  const inside = /^\s*([^:\n]+?)\s*:/.exec(text)
  if (inside?.[1] !== undefined) return inside[1]
  if (next?.type === 'text' && /^\s*:/.test(next.value)) return text.trim()
  return undefined
}

/**
 * Collect markdown links from a document tree: inline (`[text](url)`) and reference-style (bug
 * 0558), each with the blocks that enclose it; plus every block, and every label written where no
 * block starts (later in a paragraph, in a table cell, in a heading), which therefore declares
 * nothing. Links inside fenced code are not parsed as link nodes by mdast, so they are naturally
 * excluded, and the parser makes a reference-style link only where its label is defined.
 */
export function collectLinkBlocks(
  root: Root,
  source?: string,
): {
  links: MdLinkRef[]
  blocks: MdLinkBlock[]
  unreadLabels: MdUnreadLabel[]
} {
  // Each link with its source offset, so the dangling references a block's scan finds sit in
  // document order beside the link nodes the walk meets.
  const found: { readonly offset: number; readonly link: MdLinkRef }[] = []
  const add = (node: Nodes, link: MdLinkRef): void => {
    found.push({ offset: node.position?.start.offset ?? 0, link })
  }
  const lines = source?.split('\n') ?? []
  const blocks: MdLinkBlock[] = []
  const definitions = definitionsOf(root, source)
  const defined = new Set(definitions.keys())
  // Bug 0558 (b): a reference whose label has no definition is text to the parser, read here from
  // the block's source.
  const scanDangling = (node: Nodes, path: readonly MdLinkBlock[]): void => {
    if (source === undefined) return
    for (const d of danglingReferencesIn(node, source, defined)) {
      found.push({
        offset: d.offset,
        link: {
          url: '',
          text: d.text,
          line: d.line,
          external: false,
          undefinedReference: { label: d.label },
          ...(path.length > 0 ? { block: path[path.length - 1], blockPath: path } : {}),
        },
      })
    }
  }
  const unreadLabels: MdUnreadLabel[] = []

  // The block a node opens: its first line, read from its content column.
  const blockOf = (node: Nodes): MdLinkBlock => {
    const first = node.type === 'listItem' ? (node.children[0] ?? node) : node
    const line = first.position?.start.line ?? 0
    const column = first.position?.start.column ?? 1
    return { line, text: (lines[line - 1] ?? '').slice(column - 1).replace(TASK_BOX, '') }
  }
  const enter = (path: readonly MdLinkBlock[], block: MdLinkBlock): readonly MdLinkBlock[] => {
    if (path.at(-1)?.line === block.line) return path
    blocks.push(block)
    return [...path, block]
  }

  const visitChildren = (
    parent: Nodes,
    children: readonly Nodes[],
    path: readonly MdLinkBlock[],
  ): void => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child === undefined) continue
      // A label alone on its paragraph encloses the lists directly after it — every
      // one, since a changed bullet starts a new list.
      if (child.type === 'paragraph' && children[i + 1]?.type === 'list') {
        const label = blockOf(child)
        if (isLabelAlone(label.text)) {
          const inner = enter(path, label)
          visit(child, inner)
          while (children[i + 1]?.type === 'list') {
            const list = children[i + 1]
            if (list !== undefined) visit(list, inner)
            i++
          }
          continue
        }
      }
      // A label is read as a declaration only where its block starts — nothing but `*`/`_`
      // before it on the block's line — and only in a form the line grammar reads. The tree
      // sees every bold label, so any it finds elsewhere, or in another form, declares nothing.
      const label = strongLabel(child, children[i + 1])
      if (label !== undefined) {
        const line = child.position?.start.line ?? 0
        const block = path.at(-1)
        const rest = (lines[line - 1] ?? '').slice((child.position?.start.column ?? 1) - 1)
        const atStart =
          block !== undefined &&
          block.line === line &&
          /^[*_]*$/.test(block.text.slice(0, block.text.length - rest.length))
        if (!atStart) unreadLabels.push({ line, label, reason: 'position' })
        else if (wrappedLabelOf(block.text) !== label) {
          unreadLabels.push({ line, label, reason: 'format' })
        }
      }
      visit(child, path)
    }
  }

  const visit = (node: Nodes, path: readonly MdLinkBlock[]): void => {
    if (node.type === 'heading') {
      scanDangling(node, [])
      visitChildren(node, node.children, [])
      return
    }
    if (node.type === 'listItem' || node.type === 'paragraph') {
      const inner = enter(path, blockOf(node))
      if (node.type === 'paragraph') scanDangling(node, inner)
      visitChildren(node, node.children, inner)
      return
    }
    if (node.type === 'tableCell') scanDangling(node, path)
    if (node.type === 'linkReference') {
      const site = definitions.get(node.identifier)
      // The parser makes a `linkReference` only where its label is defined, and both carry the same
      // normalized `identifier`, so a miss here means that contract broke: fail loudly rather
      // than drop the link from every rule's `examined` (ADR-009).
      if (site === undefined) {
        throw new ParserContractBroken(node.label ?? node.identifier)
      }
      add(node, {
        url: site.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(site.url),
        urlStart: site.urlStart,
        urlEnd: site.urlEnd,
        definition: { label: site.label, line: site.line },
        ...(path.length > 0 ? { block: path[path.length - 1], blockPath: path } : {}),
      })
    }
    if (node.type === 'link') {
      // Locate the URL's exact char span in the source (for autofix). The link node's raw text is
      // `[text](url …)`: the destination starts after the `](` that closes the text (bug 0563, not
      // the last match of the URL, which a title or the text can hold). Where the source does not
      // write the URL as the parser read it (an escape, an entity), the span is absent, and no fix
      // is emitted without an exact span.
      let urlStart: number | undefined
      let urlEnd: number | undefined
      const startOff = node.position?.start.offset
      const endOff = node.position?.end.offset
      if (source !== undefined && startOff !== undefined && endOff !== undefined) {
        const raw = source.slice(startOff, endOff)
        const textEnd = (node.children.at(-1)?.position?.end.offset ?? startOff + 1) - startOff
        const at = raw.startsWith('](', textEnd) ? destinationAt(raw, textEnd + 2) : undefined
        if (at !== undefined && writtenAt(raw, at, node.url)) {
          urlStart = startOff + at
          urlEnd = urlStart + node.url.length
        }
      }
      add(node, {
        url: node.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(node.url),
        urlStart,
        urlEnd,
        ...(path.length > 0 ? { block: path[path.length - 1], blockPath: path } : {}),
      })
    }
    if ('children' in node) visitChildren(node, node.children, path)
  }

  visitChildren(root, root.children, [])
  const links = [...found].sort((a, b) => a.offset - b.offset).map((f) => f.link)
  return { links, blocks, unreadLabels }
}

/**
 * Collect markdown links, inline and reference-style, from a document tree. Links inside fenced
 * code are not parsed as link nodes by mdast, so they are naturally excluded.
 */
export function collectLinks(root: Root, source?: string): MdLinkRef[] {
  return collectLinkBlocks(root, source).links
}

/**
 * A document's links, each with the sections that contain its line (bug 0502). One owner of a
 * link's `sectionPath`: the section index tables and sections read, not a second heading walk.
 */
export function linksOf(doc: MdDocument): MdLinkRef[] {
  return collectLinks(doc.root, doc.text).map((l) => ({
    ...l,
    sectionPath: sectionPathAt(doc, l.line),
  }))
}

/** A link with its owning document attached — the element the builders and conditions operate on. */
export interface MdLink extends MdLinkRef {
  readonly doc: MdDocument
}
