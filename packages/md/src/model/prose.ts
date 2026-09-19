import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

/**
 * Which lines of a markdown document are prose, read the way CommonMark reads them (bugs 0286 and
 * 0287). A scan for a claim a document makes about itself — a `State:` line, a `Deferred:` summary —
 * must skip an example of the claim, and an example is written as a code block or an HTML block. The
 * scans each hand-rolled a regex for that, which misread a four-backtick fence, an unclosed fence and an
 * indented block, and disagreed with the markdown parser the task-box pass beside them runs. This asks
 * that parser instead.
 */

const GFM = gfm()
const GFM_MDAST = gfmFromMarkdown()

/** Parse markdown as the corpus does. */
function parseMarkdown(text: string): Root {
  return fromMarkdown(text, { extensions: [GFM], mdastExtensions: [GFM_MDAST] })
}

/** A node that holds blocks, not inline content: an `html` node inside one is an HTML block. */
const FLOW_PARENTS: ReadonlySet<string> = new Set([
  'root',
  'blockquote',
  'listItem',
  'footnoteDefinition',
])

/**
 * The line ranges, inclusive, of every code block — fenced or indented — and every HTML block. Inline
 * code and inline HTML are prose: they sit inside a line that may be the claim itself.
 *
 * A position's end is exclusive, so a block its container closes ends at column 1 of the next line;
 * that line is not part of the block.
 */
function nonProseRanges(root: Root): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const visit = (node: Nodes, parentType: string): void => {
    const block = node.type === 'code' || (node.type === 'html' && FLOW_PARENTS.has(parentType))
    if (block && node.position) {
      const { start, end } = node.position
      ranges.push([start.line, end.column === 1 && end.line > start.line ? end.line - 1 : end.line])
    }
    if ('children' in node) for (const child of node.children) visit(child, node.type)
  }
  visit(root, 'root')
  return ranges
}

/**
 * The document's text with every line that is not prose blanked, and the line count kept, so a line
 * number read from it is a line number in the document.
 */
export function proseText(text: string, root: Root = parseMarkdown(text)): string {
  const lines = text.split('\n')
  for (const [first, last] of nonProseRanges(root)) {
    for (let line = first; line <= last && line <= lines.length; line++) lines[line - 1] = ''
  }
  return lines.join('\n')
}

/**
 * The line of a fenced code block that never closes and so runs to the end of the document, or
 * `null`. By CommonMark everything after such a fence is code, so a `State:` line or a task box below
 * it is not the document's own; a reader that silently agrees reports nothing at all (bug 0286).
 *
 * A fence its container closes — the end of a list item or a blockquote — is not reported: the
 * document goes on as prose after it.
 */
export function unterminatedFence(text: string, root: Root): number | null {
  const lines = text.split('\n')
  const lastContentLine = text.trimEnd().split('\n').length
  let found: number | null = null
  const visit = (node: Nodes): void => {
    if (found !== null) return
    if (node.type === 'code' && node.position) {
      const { start, end } = node.position
      const opener = (lines[start.line - 1] ?? '').slice(start.column - 1)
      const fence = /^(`{3,}|~{3,})/.exec(opener)?.[1]
      const endLine = end.column === 1 && end.line > start.line ? end.line - 1 : end.line
      if (fence !== undefined && endLine >= lastContentLine) {
        const closer = new RegExp(`^[\\s>]*\\${fence[0] ?? '`'}{${String(fence.length)},}\\s*$`)
        const closed = endLine > start.line && closer.test(lines[endLine - 1] ?? '')
        if (!closed) found = start.line
      }
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(root)
  return found
}
