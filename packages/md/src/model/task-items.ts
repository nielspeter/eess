import type { Root, Nodes } from 'mdast'

/** A GFM task-list item (`- [ ]` / `- [x]`) within a document. */
export interface MdTaskItemRef {
  /** `false` for an open box `- [ ]`, `true` for a checked box `- [x]`. */
  readonly checked: boolean
  /** The item's own text (its first paragraph), trimmed; nested sub-items excluded. */
  readonly text: string
  /** 1-based line of the `- [ ]` in the source document. */
  readonly line: number
}

function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return node.children.map((c) => textOf(c)).join('')
  return ''
}

/**
 * Collect GFM task-list items from a document tree.
 *
 * mdast supplies for free the false-positive guards a line-regex scanner has to
 * emulate by hand:
 *  - a `- [ ]` inside fenced code is part of a `code` node, never a `listItem`,
 *    so it is naturally excluded;
 *  - a task item inside a blockquote is a `listItem` under a `blockquote`
 *    ancestor and is skipped here — a quoted box is not a live ledger entry.
 *
 * Only list items with a boolean `checked` are task items; ordinary list items
 * have `checked: null`. The item's `text` is its first paragraph (its own line),
 * so a disposition token on the box line is seen but a nested sub-item's text is
 * not folded in — nested boxes are their own `listItem`s and are yielded
 * separately.
 */
export function collectTaskItems(root: Root): MdTaskItemRef[] {
  const out: MdTaskItemRef[] = []
  const visit = (node: Nodes, inBlockquote: boolean): void => {
    if (node.type === 'blockquote') {
      for (const child of node.children) visit(child, true)
      return
    }
    if (node.type === 'listItem' && typeof node.checked === 'boolean') {
      if (!inBlockquote) {
        const firstParagraph = node.children.find((c) => c.type === 'paragraph')
        const text = (firstParagraph ? textOf(firstParagraph) : textOf(node)).trim()
        out.push({ checked: node.checked, text, line: node.position?.start.line ?? 0 })
      }
    }
    if ('children' in node) {
      for (const child of node.children) visit(child, inBlockquote)
    }
  }
  visit(root, false)
  return out
}
