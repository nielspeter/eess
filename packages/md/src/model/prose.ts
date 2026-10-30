import type { Nodes, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { frontmatter } from 'micromark-extension-frontmatter'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { isMap, parseDocument } from 'yaml'
import { registerCacheReset } from '@nielspeter/eess/internal'
import { createParseMemo, type ParseMemo } from './parse-memo.js'
import { definitionsOf } from './definitions.js'

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

const GFM_ONLY = { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] }
const WITH_FRONT_MATTER = {
  extensions: [gfm(), frontmatter(['yaml'])],
  mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(['yaml'])],
}

// A URL with a scheme or `//` points outside the repository — the same test `MdLink.external` uses.
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * True when Markdown a reader checks — a task box, or a link into the repository, inline or
 * reference-style (bug 0558) — is in `root`.
 */
function holdsCheckedMarkdown(root: Root): boolean {
  const definitions = definitionsOf(root, undefined)
  const visit = (node: Nodes): boolean => {
    if (node.type === 'listItem' && typeof node.checked === 'boolean') return true
    if (node.type === 'link' && !EXTERNAL.test(node.url)) return true
    if (node.type === 'linkReference') {
      const url = definitions.get(node.identifier)?.url
      if (url !== undefined && !EXTERNAL.test(url)) return true
    }
    return 'children' in node && node.children.some(visit)
  }
  return visit(root)
}

/**
 * Whether a line-1 `---` block is front matter (bug 0087). Only if it is a YAML mapping that parses
 * with no error — the yaml library hands back a mapping even beside an error, so the errors decide —
 * and holds nothing a Markdown reader checks: a task box or a link into the repository, which a
 * YAML value can carry on an indented continuation line and still parse. Anything else is read as
 * Markdown, as it was before front matter was parsed, so no box or link is hidden by it.
 *
 * A reference-style link counts when the block defines it (bug 0558). One whose definition is in
 * the body is not seen: a YAML flow list (`tags: [adr]`) has its shape, so judging it by the body's
 * definitions read ordinary front matter as Markdown (bug 0566).
 */
function isFrontMatter(value: string): boolean {
  const doc = parseDocument(value)
  if (doc.errors.length > 0 || !isMap(doc.contents) || doc.contents.items.length === 0) return false
  return !holdsCheckedMarkdown(fromMarkdown(value, GFM_ONLY))
}

/**
 * Parse markdown — the one parser for eess-md: `corpus()` reads every document with it, and the
 * readers here default to it, so the two cannot disagree about where a code block or a section is.
 *
 * GFM, and YAML front matter, which parses to a `yaml` node. Without it, CommonMark reads the
 * closing `---` as a setext underline and the YAML above it becomes a depth-2 section (bug 0087).
 * A line-1 `---` block that is not front matter by {@link isFrontMatter} is read as Markdown instead,
 * so it fails closed: every reader sees what it holds. Text-line readers — `terms()`, `pointers()`,
 * the ledger — see front-matter lines either way, since only code blocks are set aside.
 */
export function parseMarkdown(text: string): Root {
  return structuredClone(memo.master(text))
}

/**
 * The same parse as {@link parseMarkdown}, kept out of the memo: for a text read once and dropped,
 * such as a document with a fix written into it (plan 0550), which must not push a corpus text out.
 */
export function parseUncached(text: string): Root {
  return parseFresh(text)
}

function parseFresh(text: string): Root {
  const root = fromMarkdown(text, WITH_FRONT_MATTER)
  const first = root.children[0]
  if (first?.type !== 'yaml' || isFrontMatter(first.value)) return root
  return fromMarkdown(text, GFM_ONLY)
}

// Bug 0547: one parse per distinct text per process; the master tree never leaves this module, and
// `parseMarkdown` hands each caller a copy (`./parse-memo.ts`). 2^24 characters is about 210 MB of
// trees, twice this repository's corpus (spike 0546).
const memo: ParseMemo = createParseMemo(2 ** 24, parseFresh)
registerCacheReset(() => memo.reset())

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
 * The shape of the code block that holds `line` (1-based), or `undefined` when no code block holds
 * it: so a finding about a line set aside as code can say which kind of code set it aside.
 */
export function codeShapeAt(text: string, root: Root, line: number): CodeShape | undefined {
  return codeBlocks(text, root).find((b) => line >= b.first && line <= b.last)?.shape
}

/**
 * The closed fences written inside an HTML block. CommonMark reads such a fence as raw HTML, so the
 * parser has no code node for it; but the author fenced it as an example, and the copies this owner
 * replaced set aside a simple one there — mis-reading a longer one, as they did everywhere else (bug
 * record's state and as a proposal's ruling). Paired by run length as CommonMark pairs a fence: a closer
 * is a run of the opener's character at least as long, alone on its line. A fence with no closer inside
 * the block is not set aside.
 *
 * **Indentation carries no meaning here**, of any width or kind. CommonMark's "at most three spaces, or
 * it is an indented code block instead" is a rule about a markdown block context, and inside an HTML
 * block there is none: every line is raw text. Importing that bound split `<details>` bodies by how far
 * their author indented them — four spaces or a tab and the example was read as the document's own
 * claim, measured on the ledger and on a proposal's ruling, where 0.6.0's textual regex set both aside.
 *
 * **This pairing is hand-rolled, and it is the one place in the family that still is.** Bug 0287's
 * thesis is "ask the parser", and here there is nothing to ask: the parser hands back one `html` node
 * and no structure inside it. So this loop can drift from micromark's fence rules where they are subtler
 * than run length and the info string — which is why it lives in the owner, under the check that allows
 * a fence regex in this file and nowhere else.
 */
function fencesInHtml(text: string, root: Root): { first: number; last: number }[] {
  const lines = text.split('\n')
  const out: { first: number; last: number }[] = []
  walk(root, (node) => {
    if (node.type !== 'html' || !node.position) return
    const column = node.position.start.column - 1
    let open: { char: string; length: number; line: number } | null = null
    for (let n = node.position.start.line; n <= lastLineOf(node); n++) {
      const fence = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec((lines[n - 1] ?? '').slice(column))
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
 * - `'code-blocks'` — every code block the parser reports, which is how CommonMark reads the document.
 *   For a reader that reports what it cannot read: the ledger reads this way, and reports a fence that
 *   never closes and a `State:` line found only in code. Not named `'commonmark'`: both readings deviate
 *   from it by one deliberate step, the fenced example inside an HTML block below.
 * - `'closed-fences'` — only a fence with its closing line, the one shape that is certainly an example.
 *   For a reader that cannot report: an indented block, or a fence that never closes, is read. A reader
 *   whose findings grow with what it reads — a term, a citation — then errs toward a false red, never a
 *   silent pass. A reader that keeps only the **last** of something does not have that property: an
 *   example read after the real line becomes the verdict. Such a reader must refuse below a fence with
 *   no closing line rather than pick a side — {@link unclosedFences} is the fact it refuses on, and the
 *   proposal-ruling gate script is the one that does it.
 *
 * In both, a closed fence inside an HTML block is set aside too.
 */
export type SetAside = 'code-blocks' | 'closed-fences'

/**
 * The document's text with every line of the code it sets aside blanked, and the line count kept, so a
 * line number read from it is a line number in the document. The mode is required: the two readings
 * drop different lines, and a caller must say which one it can answer for.
 */
export function proseText(
  text: string,
  setAside: SetAside,
  root: Root = memo.master(text),
): string {
  const lines = text.split('\n')
  const blank = (first: number, last: number): void => {
    for (let line = first; line <= last && line <= lines.length; line++) lines[line - 1] = ''
  }
  for (const { first, last, shape } of codeBlocks(text, root)) {
    if (setAside === 'code-blocks' || shape === 'closed-fence') blank(first, last)
  }
  for (const { first, last } of fencesInHtml(text, root)) blank(first, last)
  return lines.join('\n')
}

/**
 * The opening line of every fence with no closing line, in document order — ended by its container or by
 * the end of the document alike.
 *
 * For a reader that keeps only the last of something: below such a fence, whether a line is the
 * document's own claim or an example is not decidable, and the two readings disagree. A reader that can
 * report should refuse rather than pick (bug 0287's review measured an example ruling inside a
 * list-item-ended fence becoming a proposal's verdict).
 */
export function unclosedFences(text: string, root: Root = memo.master(text)): number[] {
  return codeBlocks(text, root)
    .filter((b) => b.shape === 'unclosed-fence')
    .map((b) => b.first)
}

/**
 * The line of a fenced code block that never closes and so runs to the end of the document, or
 * `null`. By CommonMark everything after such a fence is code, so a `State:` line or a task box below
 * it is not the document's own; a reader that silently agrees reports nothing at all (bug 0286). A
 * fence its container ends is not reported here — it hides only what is inside that container, and
 * {@link unclosedFences} is the wider fact.
 */
export function unterminatedFence(text: string, root: Root): number | null {
  const lastContentLine = text.trimEnd().split('\n').length
  const block = codeBlocks(text, root).find(
    (b) => b.shape === 'unclosed-fence' && b.last >= lastContentLine,
  )
  return block?.first ?? null
}
