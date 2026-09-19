import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

/**
 * Which lines of a markdown document are prose, read the way CommonMark reads them (bugs 0286 and
 * 0287). A scan for a claim a document makes about itself — a `State:` line, a `Deferred:` summary —
 * must skip an example of the claim written as a code block. The scans each hand-rolled a regex for
 * that, which misread a four-backtick fence, an unclosed fence and an indented block, and disagreed with
 * the markdown parser the task-box pass beside them runs. This asks that parser instead.
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

/** Each code node — fenced or indented — with its first and last line, in document order. */
function codeBlocks(root: Root): { node: Nodes & { type: 'code' }; first: number; last: number }[] {
  const blocks: { node: Nodes & { type: 'code' }; first: number; last: number }[] = []
  const visit = (node: Nodes): void => {
    if (node.type === 'code' && node.position) {
      blocks.push({ node, first: node.position.start.line, last: lastLineOf(node) })
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }
  visit(root)
  return blocks
}

/**
 * The document's text with every line of a code block blanked, and the line count kept, so a line
 * number read from it is a line number in the document.
 */
export function proseText(text: string, root: Root = parseMarkdown(text)): string {
  const lines = text.split('\n')
  for (const { first, last } of codeBlocks(root)) {
    for (let line = first; line <= last && line <= lines.length; line++) lines[line - 1] = ''
  }
  return lines.join('\n')
}

/**
 * The line of a fenced code block that never closes and so runs to the end of the document, or
 * `null`. By CommonMark everything after such a fence is code, so a `State:` line or a task box below
 * it is not the document's own; a reader that silently agrees reports nothing at all (bug 0286).
 *
 * Whether a fence closed is read off the parser, not re-derived: a closed fence spans its opener, its
 * content and its closer, so an unclosed one spans one line fewer than its content plus two. A fence its
 * container closes before the end of the document is not reported.
 */
export function unterminatedFence(text: string, root: Root): number | null {
  const lines = text.split('\n')
  const lastContentLine = text.trimEnd().split('\n').length
  for (const { node, first, last } of codeBlocks(root)) {
    const opener = (lines[first - 1] ?? '').slice((node.position?.start.column ?? 1) - 1)
    if (!/^(`{3,}|~{3,})/.test(opener)) continue // an indented block has no fence to close
    if (last < lastContentLine) continue
    const contentLines = node.value === '' ? 0 : node.value.split('\n').length
    if (last - first + 1 < contentLines + 2) return first
  }
  return null
}
