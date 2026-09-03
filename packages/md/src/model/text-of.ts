import type { Nodes } from 'mdast'

/**
 * The visible text of an mdast node, with formatting flattened.
 *
 * `[**bold** link](url)` is three nodes; a rule that reads a link's text wants
 * `bold link`. Recursing over `children` and concatenating leaf `value`s is what
 * produces that, and returning `''` for a node with neither — an image, a
 * thematic break — is deliberate: it contributes nothing to the reader's text.
 *
 * Extracted because `links.ts` and `task-items.ts` each carried a byte-identical
 * copy, which `no-copy-paste` reported at 100%.
 */
export function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return node.children.map((c) => textOf(c)).join('')
  return ''
}
