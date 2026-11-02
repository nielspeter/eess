import type { Root, Nodes } from 'mdast'
import { textOf } from './text-of.js'
import { isLabelAlone, wrappedLabelOf } from './label.js'
import type { MdDocument } from './document.js'
import { sectionPathAt } from './sections.js'
import { definitionsOf, type MdLinkDefinition } from './definitions.js'
import { destinationAt, writtenAt } from './destination.js'
import {
  attributeOf,
  elementText,
  inlineTagStarts,
  isLinkStart,
  readHtmlNode,
} from './html-attributes.js'

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
}

// A URL is external if it has a scheme (`https:`, `mailto:`) or is protocol-relative. Exported
// model-internally (plan 0549), so `mentions()` and `links()` cannot disagree about a link; its one
// owner is `external.ts` (bug 0565).
export { EXTERNAL_RE } from './external.js'
import { EXTERNAL_RE } from './external.js'

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

/**
 * Why an HTML link could not be read (plan 0580, R3): a tag its `html` node ended inside, cut by a
 * blank line it would finish without (`split-tag`) or not (`unterminated`); or a tag micromark left as
 * text, for an unquoted value holding `/` (`unquoted-slash`) or for a reason no measurement explains
 * (`refused-tag`).
 */
export type UnreadLinkCause = 'split-tag' | 'unterminated' | 'unquoted-slash' | 'refused-tag'

/** An HTML link eess-md cannot read: where it sits, and why. Its URL and target are unknowable. */
export interface MdUnreadLinkRef {
  readonly line: number
  readonly cause: UnreadLinkCause
  /** For `unquoted-slash`: every attribute whose unquoted value holds a `/`. */
  readonly attributes?: readonly string[]
  readonly block?: MdLinkBlock
  readonly blockPath?: readonly MdLinkBlock[]
  readonly sectionPath?: readonly string[]
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

/** The text a reader sees in an inline node: text and inline code, never a tag. */
function seenText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(seenText).join('')
  return ''
}

type LinkBlocks = ReturnType<typeof walkLinkBlocks>

/**
 * One walk per document tree and source (plan 0580): `links()`'s elements, its unread sites,
 * `beLinkedBack()`'s index and the declaration scan all read it, and a tree is never mutated once
 * built. Callers read the arrays and never write to them.
 */
const walked = new WeakMap<
  Root,
  { readonly source: string | undefined; readonly blocks: LinkBlocks }
>()

/**
 * Collect the links from a document tree: Markdown inline (`[text](url)`) and reference-style (bug
 * 0558) links, and every `href` on an `<a>` or `<area>` in raw HTML (plan 0580), each with the
 * blocks that enclose it; the HTML links that cannot be read; every block; and every label written
 * where no block starts (later in a paragraph, in a table cell, in a heading), which therefore
 * declares nothing. A Markdown link in fenced code is not parsed as a link node; an `href` in a fence
 * inside an HTML block is read, since GitHub renders it as a link (D4).
 */
export function collectLinkBlocks(root: Root, source?: string): LinkBlocks {
  const known = walked.get(root)
  if (known !== undefined && known.source === source) return known.blocks
  const blocks = walkLinkBlocks(root, source)
  walked.set(root, { source, blocks })
  return blocks
}

function walkLinkBlocks(
  root: Root,
  source?: string,
): {
  readonly links: readonly MdLinkRef[]
  readonly blocks: readonly MdLinkBlock[]
  readonly unreadLabels: readonly MdUnreadLabel[]
  readonly unreadLinks: readonly MdUnreadLinkRef[]
} {
  const out: MdLinkRef[] = []
  const unreadLinks: MdUnreadLinkRef[] = []
  const lines = source?.split('\n') ?? []
  const blocks: MdLinkBlock[] = []
  const definitions = definitionsOf(root, source)
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

  const at = (path: readonly MdLinkBlock[]) =>
    path.length > 0 ? { block: path[path.length - 1], blockPath: path } : {}

  /**
   * An `html` node (plan 0580, Phase 2): each `<a>` or `<area>` with an `href` is a link at the
   * line its `href` sits on (R1), and each such tag the node ends inside is unread (R3). The text of
   * an `<a>` is what the node holds before its `</a>`, or else the inline nodes after it up to one.
   */
  const html = (
    node: Nodes,
    after: readonly Nodes[],
    path: readonly MdLinkBlock[],
    depth: number,
  ): void => {
    if (node.type !== 'html') return
    const read = readHtmlNode(node, source === undefined ? 'no-source' : { source, depth })
    for (const tag of read.starts) {
      const href = isLinkStart(tag) ? attributeOf(tag, 'href') : undefined
      if (href === undefined) continue
      let text = tag.name === 'a' ? elementText(node.value, tag, read) : ''
      if (text === undefined) {
        // An inline `<a>`: its text is what a reader sees in the nodes up to its `</a>`. A tag
        // between them (`<b>`, `<img>`) is HTML, never text.
        text = ''
        for (const next of after) {
          if (
            next.type === 'html' &&
            readHtmlNode(next, 'no-source').ends.some((e) => e.name === 'a')
          )
            break
          text += seenText(next)
        }
      }
      out.push({
        url: href.value,
        text: text.replace(/\s+/g, ' ').trim(),
        line: href.line,
        external: EXTERNAL_RE.test(href.value),
        ...at(path),
      })
    }
    for (const u of read.unfinished) {
      if (u.name === 'a' || u.name === 'area')
        unreadLinks.push({ line: u.line, cause: u.cause, ...at(path) })
    }
  }

  /** A paragraph, heading or table cell: the HTML links micromark left as text (R3, D7). */
  const inline = (node: Nodes, path: readonly MdLinkBlock[], depth: number): void => {
    if (source === undefined) return
    if (node.type !== 'paragraph' && node.type !== 'heading' && node.type !== 'tableCell') return
    for (const start of inlineTagStarts(node, source, depth)) {
      // Every kind is named, so a new one is a compile error, not a site dropped (R3's "by
      // construction"). `refused-tag` has no input that reaches it today: it is the report a refusal
      // nobody has measured gets, so it stays though no row can drive it here.
      switch (start.kind) {
        case 'unquoted-slash':
          unreadLinks.push({
            line: start.line,
            cause: 'unquoted-slash',
            attributes: start.attributes,
            ...at(path),
          })
          break
        case 'refused-tag':
          unreadLinks.push({ line: start.line, cause: 'refused-tag', ...at(path) })
          break
        case 'not-a-tag': // a named silence: GitHub renders it as text
        case 'no-href': // a named silence: an anchor, not a link
          break
        default: {
          // Exhaustive: a kind added to `InlineTagStart` without a case here does not compile.
          const unknown: never = start
          void unknown
        }
      }
    }
  }

  const visitChildren = (
    parent: Nodes,
    children: readonly Nodes[],
    path: readonly MdLinkBlock[],
    depth: number,
  ): void => {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child === undefined) continue
      if (child.type === 'html') {
        html(child, children.slice(i + 1), path, depth)
        continue
      }
      // A label alone on its paragraph encloses the lists directly after it — every
      // one, since a changed bullet starts a new list.
      if (child.type === 'paragraph' && children[i + 1]?.type === 'list') {
        const label = blockOf(child)
        if (isLabelAlone(label.text)) {
          const inner = enter(path, label)
          visit(child, inner, depth)
          while (children[i + 1]?.type === 'list') {
            const list = children[i + 1]
            if (list !== undefined) visit(list, inner, depth)
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
      visit(child, path, depth)
    }
  }

  const visit = (node: Nodes, path: readonly MdLinkBlock[], depth: number): void => {
    if (node.type === 'heading') {
      inline(node, [], depth)
      visitChildren(node, node.children, [], depth)
      return
    }
    if (node.type === 'listItem' || node.type === 'paragraph') {
      const inner = enter(path, blockOf(node))
      inline(node, inner, depth)
      visitChildren(node, node.children, inner, depth)
      return
    }
    if (node.type === 'tableCell') inline(node, path, depth)
    if (node.type === 'linkReference') {
      const site = definitions.get(node.identifier)
      // The parser makes a `linkReference` only where its label is defined, and both carry the same
      // normalized `identifier`, so a miss here means that contract broke: fail loudly rather
      // than drop the link from every rule's `examined` (ADR-009).
      if (site === undefined) {
        throw new ParserContractBroken(node.label ?? node.identifier)
      }
      out.push({
        url: site.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(site.url),
        urlStart: site.urlStart,
        urlEnd: site.urlEnd,
        definition: { label: site.label, line: site.line },
        ...at(path),
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
      out.push({
        url: node.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(node.url),
        urlStart,
        urlEnd,
        ...at(path),
      })
    }
    if ('children' in node)
      visitChildren(node, node.children, path, node.type === 'blockquote' ? depth + 1 : depth)
  }

  visitChildren(root, root.children, [], 0)
  return { links: out, blocks, unreadLabels, unreadLinks }
}

/** The links of a document tree, as `collectLinkBlocks` reads them (Markdown and raw HTML). */
export function collectLinks(root: Root, source?: string): readonly MdLinkRef[] {
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

/** A document's unread HTML links (plan 0580, R3), each with the sections that contain its line. */
export function unreadLinksOf(doc: MdDocument): MdUnreadLinkRef[] {
  return collectLinkBlocks(doc.root, doc.text).unreadLinks.map((u) => ({
    ...u,
    sectionPath: sectionPathAt(doc, u.line),
  }))
}

/** A link with its owning document attached — the element the builders and conditions operate on. */
export interface MdLink extends MdLinkRef {
  readonly doc: MdDocument
}
