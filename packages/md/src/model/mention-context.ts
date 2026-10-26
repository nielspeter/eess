import type { Nodes, RootContent } from 'mdast'
import type { MdDocument } from './document.js'
import { sectionPathAt } from './sections.js'

/**
 * The text around a mention that a fix reads for another project's name (plan 0550, Decision 2, as
 * Phase 0 measured it): its own paragraph; in a table, its own row and the header row; in a list,
 * its own item and the paragraphs of each item it is nested under; a whole blockquote; the paragraph
 * directly before a top-level list or table; and the heading of each section that contains it, the
 * title included. Read by line, as the measurement read it.
 */
interface MentionContext {
  /** Each piece of text read, in no particular order. */
  readonly texts: readonly string[]
  /** The mention sits in a table cell. */
  readonly inTable: boolean
}

/** Containers whose children are joined with a line break, so two cells never run together. */
const JOINED_BY_LINE = new Set(['list', 'listItem', 'table', 'tableRow', 'blockquote'])

/** The text a reader sees in a block, inline code without its backticks. */
function visible(node: Nodes): string {
  // A hard break is a line break: without it, a name before it would run into the next word.
  if (node.type === 'break') return '\n'
  if ('value' in node && typeof node.value === 'string') return node.value
  if (!('children' in node)) return ''
  const sep = JOINED_BY_LINE.has(node.type) ? '\n' : ''
  return node.children.map((c: Nodes) => visible(c)).join(sep)
}

const INLINE = new Set([
  'text',
  'inlineCode',
  'emphasis',
  'strong',
  'link',
  'delete',
  'break',
  'image',
  'html',
])
const LEAF_BLOCKS = new Set(['paragraph', 'heading', 'tableCell', 'code', 'definition'])

const holds = (node: Nodes, line: number): boolean =>
  node.position !== undefined && node.position.start.line <= line && line <= node.position.end.line

/** The blocks from the document root down to the leaf block holding `line`, outermost first. */
function chainAt(root: Nodes, line: number): Nodes[] {
  const out: Nodes[] = []
  let current: Nodes = root
  for (;;) {
    if (!('children' in current)) break
    const children: readonly Nodes[] = current.children
    const next = children.find((k) => holds(k, line) && !INLINE.has(k.type))
    if (next === undefined) break
    out.push(next)
    current = next
    if (LEAF_BLOCKS.has(next.type)) break
  }
  return out
}

/** The context a fix reads for the mention at `line` of `doc`. */
export function mentionContext(doc: MdDocument, line: number): MentionContext {
  const chain = chainAt(doc.root, line)
  const texts: string[] = []
  const top = chain[0]
  const inTable = chain.some((n) => n.type === 'tableRow')
  if (top?.type === 'blockquote') {
    texts.push(visible(top))
  } else {
    const items = chain.filter((n) => n.type === 'listItem')
    const innermost = items.at(-1)
    for (const [i, n] of chain.entries()) {
      if (n.type === 'listItem') {
        if (n === innermost) texts.push(visible(n))
        else
          texts.push(
            n.children
              .filter((k) => k.type === 'paragraph')
              .map((k) => visible(k))
              .join('\n'),
          )
      } else if (n.type === 'tableRow') {
        texts.push(visible(n))
        const table = chain[i - 1]
        const header = table !== undefined && table.type === 'table' ? table.children[0] : undefined
        if (header !== undefined && header !== n) texts.push(visible(header))
      } else if (
        (n.type === 'paragraph' || n.type === 'heading') &&
        innermost === undefined &&
        !inTable
      ) {
        texts.push(visible(n))
      }
    }
    if (top !== undefined && (top.type === 'list' || top.type === 'table')) {
      const siblings: readonly RootContent[] = doc.root.children
      const before = siblings[siblings.indexOf(top) - 1]
      if (before?.type === 'paragraph') texts.push(visible(before))
    }
  }
  texts.push(...sectionPathAt(doc, line))
  return { texts, inTable }
}
