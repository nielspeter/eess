import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

/**
 * Which lines of a markdown document are prose, read with the parser the corpus is read with (bugs 0286
 * and 0287). A scan for a claim a document makes — a `State:` line, a `Deferred:` summary, a ruling, a
 * term, a citation — must skip an example of the claim written as a code block. Four scans each
 * hand-rolled a regex for that, which misread a four-backtick fence, an unclosed fence and an indented
 * block, and disagreed with the parser the task-box pass beside one of them runs. They all ask that
 * parser now, through this one owner.
 *
 * Code blocks only. An HTML block can hold a record's real claim as well as an example of one, so
 * setting HTML blocks aside silences real claims; that is bug 0293's design question, not decided here.
 */

const GFM = gfm()
const GFM_MDAST = gfmFromMarkdown()

/** Parse markdown as the corpus does. */
function parseMarkdown(text: string): Root {
  return fromMarkdown(text, { extensions: [GFM], mdastExtensions: [GFM_MDAST] })
}

/**
 * A code node's last line. A position's end is exclusive, so a block its container closes ends at
 * column 1 of the next line; that line is not part of the block.
 */
function lastLineOf(node: Nodes): number {
  if (!node.position) return 0
  const { start, end } = node.position
  return end.column === 1 && end.line > start.line ? end.line - 1 : end.line
}

/**
 * How a code block is shaped, as far as a reader deciding what to set aside cares: fenced and closed —
 * by its closer or by its container — fenced and running unclosed to the end of the document, or
 * indented.
 */
type CodeShape = 'closed-fence' | 'unterminated-fence' | 'indented'

/**
 * Each code node with its first and last line and its shape, in document order.
 *
 * Whether a fence closed is read off the parser, not re-derived: a closed fence spans its opener, its
 * content and its closer, so an unclosed one spans one line fewer than its content plus two. A fence its
 * container closes before the end of the document is closed.
 */
function codeBlocks(text: string, root: Root): { first: number; last: number; shape: CodeShape }[] {
  const lines = text.split('\n')
  const lastContentLine = text.trimEnd().split('\n').length
  const shapeOf = (node: Nodes & { type: 'code' }, first: number, last: number): CodeShape => {
    const opener = (lines[first - 1] ?? '').slice((node.position?.start.column ?? 1) - 1)
    if (!/^(`{3,}|~{3,})/.test(opener)) return 'indented'
    if (last < lastContentLine) return 'closed-fence'
    const contentLines = node.value === '' ? 0 : node.value.split('\n').length
    return last - first + 1 < contentLines + 2 ? 'unterminated-fence' : 'closed-fence'
  }
  const blocks: { first: number; last: number; shape: CodeShape }[] = []
  const visit = (node: Nodes): void => {
    if (node.type === 'code' && node.position) {
      const first = node.position.start.line
      const last = lastLineOf(node)
      blocks.push({ first, last, shape: shapeOf(node, first, last) })
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(root)
  return blocks
}

/**
 * Which code a reader sets aside (bug 0287).
 *
 * - `'commonmark'` — every code block, as CommonMark reads it. For a reader that reports what it
 *   cannot read: the ledger reads this way and reports an unterminated fence and a `State:` line found
 *   only in code.
 * - `'closed-fences'` — only a fenced block that closes, the one shape that is certainly an example.
 *   For a reader that cannot report: an indented block or a fence that never closes is read, so a
 *   malformed document errs toward a false red, never a silent pass. It is what the hand-rolled copies
 *   meant to do, with the fences paired by the parser.
 */
export type SetAside = 'commonmark' | 'closed-fences'

/**
 * The document's text with every line of the code it sets aside blanked, and the line count kept, so a
 * line number read from it is a line number in the document.
 */
export function proseText(
  text: string,
  root: Root = parseMarkdown(text),
  setAside: SetAside = 'commonmark',
): string {
  const lines = text.split('\n')
  for (const { first, last, shape } of codeBlocks(text, root)) {
    if (setAside === 'closed-fences' && shape !== 'closed-fence') continue
    for (let line = first; line <= last && line <= lines.length; line++) lines[line - 1] = ''
  }
  return lines.join('\n')
}

/**
 * The line of a fenced code block that never closes and so runs to the end of the document, or
 * `null`. By CommonMark everything after such a fence is code, so a `State:` line or a task box below
 * it is not the document's own; a reader that silently agrees reports nothing at all (bug 0286).
 */
export function unterminatedFence(text: string, root: Root): number | null {
  return codeBlocks(text, root).find((b) => b.shape === 'unterminated-fence')?.first ?? null
}
