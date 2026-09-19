import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

/**
 * Which lines of a markdown document are prose, read with the parser the corpus is read with (bugs 0286
 * and 0287). A scan for a claim a document makes — a `State:` line, a `Deferred:` summary, a ruling, a
 * term, a citation — must skip an example of the claim written as a code block. Four scans each
 * hand-rolled a regex for that, which read a triple-backtick run inside a longer fence as a closer and
 * disagreed with the parser the task-box pass beside one of them runs. They all ask the parser now,
 * through this one owner.
 *
 * Code blocks, and fenced examples inside an HTML block. An HTML block can hold a record's real claim as
 * well as an example of one, so setting whole HTML blocks aside silences real claims; that is bug 0293's
 * design question, not decided here.
 */

const GFM = gfm()
const GFM_MDAST = gfmFromMarkdown()

/** Parse markdown as the corpus does. */
function parseMarkdown(text: string): Root {
  return fromMarkdown(text, { extensions: [GFM], mdastExtensions: [GFM_MDAST] })
}

/**
 * A node's last line. A position's end is exclusive, so a block its container closes ends at column 1 of
 * the next line; that line is not part of the block.
 */
function lastLineOf(node: Nodes): number {
  if (!node.position) return 0
  const { start, end } = node.position
  return end.column === 1 && end.line > start.line ? end.line - 1 : end.line
}

/** Visit every node, in document order. */
function walk(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node)
  if ('children' in node) for (const child of node.children) walk(child, visit)
}

/**
 * How a code block is shaped, as far as a reader deciding what to set aside cares: a fence with its
 * closing line, a fence without one — ended by its container or by the end of the document — or an
 * indented block.
 */
type CodeShape = 'closed-fence' | 'unclosed-fence' | 'indented'

/**
 * Each code node with its first and last line and its shape, in document order.
 *
 * Whether a fence has its closing line is read off the parser, not re-derived: a closed fence spans its
 * opener, its content and its closer, so an unclosed one spans one line fewer than its content plus two.
 */
function codeBlocks(text: string, root: Root): { first: number; last: number; shape: CodeShape }[] {
  const lines = text.split('\n')
  const blocks: { first: number; last: number; shape: CodeShape }[] = []
  walk(root, (node) => {
    if (node.type !== 'code' || !node.position) return
    const first = node.position.start.line
    const last = lastLineOf(node)
    const opener = (lines[first - 1] ?? '').slice(node.position.start.column - 1)
    const contentLines = node.value === '' ? 0 : node.value.split('\n').length
    const shape: CodeShape = !/^(`{3,}|~{3,})/.test(opener)
      ? 'indented'
      : last - first + 1 >= contentLines + 2
        ? 'closed-fence'
        : 'unclosed-fence'
    blocks.push({ first, last, shape })
  })
  return blocks
}

/**
 * The closed fences written inside an HTML block. CommonMark reads such a fence as raw HTML, so the
 * parser has no code node for it; but the author fenced it as an example, and the copies this owner
 * replaced set it aside (bug 0287's review measured a fenced example inside `<details>` read as a
 * record's state and as a proposal's ruling). Paired as CommonMark pairs a fence: a closer is a run of
 * the opener's character at least as long, alone on its line. A fence with no closer inside the block is
 * not set aside.
 */
function fencesInHtml(text: string, root: Root): { first: number; last: number }[] {
  const lines = text.split('\n')
  const out: { first: number; last: number }[] = []
  walk(root, (node) => {
    if (node.type !== 'html' || !node.position) return
    const column = node.position.start.column - 1
    let open: { char: string; length: number; line: number } | null = null
    for (let n = node.position.start.line; n <= lastLineOf(node); n++) {
      const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec((lines[n - 1] ?? '').slice(column))
      const run = fence?.[1]
      if (run === undefined) continue
      const rest = fence?.[2] ?? ''
      if (open === null) {
        if (!(run.startsWith('`') && rest.includes('`')))
          open = { char: run.charAt(0), length: run.length, line: n }
      } else if (run.charAt(0) === open.char && run.length >= open.length && rest.trim() === '') {
        out.push({ first: open.line, last: n })
        open = null
      }
    }
  })
  return out
}

/**
 * Which code a reader sets aside (bug 0287).
 *
 * - `'commonmark'` — every code block, as CommonMark reads it. For a reader that reports what it cannot
 *   read: the ledger reads this way, and reports a fence that never closes and a `State:` line found only
 *   in code.
 * - `'closed-fences'` — only a fence with its closing line, the one shape that is certainly an example.
 *   For a reader that cannot report: an indented block, or a fence that never closes, is read. A reader
 *   whose findings grow with what it reads — a term, a citation — then errs toward a false red, never a
 *   silent pass. A reader that keeps only the last of something, as a proposal's ruling is kept, can
 *   instead take an example after the real line for the real one, so it needs a reader that reports the
 *   unclosed fence beside it: in this repo, `check:ledger` on the proposals lane.
 *
 * In both, a closed fence inside an HTML block is set aside too.
 */
export type SetAside = 'commonmark' | 'closed-fences'

/**
 * The document's text with every line of the code it sets aside blanked, and the line count kept, so a
 * line number read from it is a line number in the document. The mode is required: the two readings
 * drop different lines, and a caller must say which one it can answer for.
 */
export function proseText(
  text: string,
  setAside: SetAside,
  root: Root = parseMarkdown(text),
): string {
  const lines = text.split('\n')
  const blank = (first: number, last: number): void => {
    for (let line = first; line <= last && line <= lines.length; line++) lines[line - 1] = ''
  }
  for (const { first, last, shape } of codeBlocks(text, root)) {
    if (setAside === 'commonmark' || shape === 'closed-fence') blank(first, last)
  }
  for (const { first, last } of fencesInHtml(text, root)) blank(first, last)
  return lines.join('\n')
}

/**
 * The line of a fenced code block that never closes and so runs to the end of the document, or
 * `null`. By CommonMark everything after such a fence is code, so a `State:` line or a task box below
 * it is not the document's own; a reader that silently agrees reports nothing at all (bug 0286). A
 * fence its container ends is not reported.
 */
export function unterminatedFence(text: string, root: Root): number | null {
  const lastContentLine = text.trimEnd().split('\n').length
  const block = codeBlocks(text, root).find(
    (b) => b.shape === 'unclosed-fence' && b.last >= lastContentLine,
  )
  return block?.first ?? null
}
