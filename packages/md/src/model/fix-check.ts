import type { Nodes, Root } from 'mdast'
import type { ArchFix } from '@nielspeter/eess'
import { parseUncached } from './prose.js'

/**
 * Plan 0550: a mention fix is kept only when the document it writes parses to the same document with
 * that one mention linked. Characters beside a mention cannot show everything a link changes: its `)`
 * can close a `(` that a link definition's title left open, so a paragraph becomes that title, or its
 * `[` can end an e-mail address GFM did not link before. Re-parsing shows every such change.
 *
 * Compared: the blocks in order, each with its visible text (a link adds none), definitions by label,
 * URL and title; the emphasis marks and reference and footnote labels; and the links, by URL and
 * text, which must be the old ones and exactly the new.
 */
interface Shape {
  readonly blocks: readonly string[]
  readonly marks: readonly string[]
  /** Each link as its URL and text. */
  readonly links: readonly string[]
}

const BLOCKS = new Set([
  'paragraph',
  'heading',
  'list',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'blockquote',
  'code',
  'html',
  'definition',
  'thematicBreak',
  'yaml',
  'footnoteDefinition',
])
const MARKS = new Set(['emphasis', 'strong', 'delete'])

/** A link's text, inline code in backticks: how two links that read differently are told apart. */
function textOf(node: Nodes): string {
  if (node.type === 'inlineCode') return '`' + node.value + '`'
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return node.children.map((c: Nodes) => textOf(c)).join('')
  return ''
}

/** A link as the comparison holds it. */
export const linkKey = (url: string, text: string): string => `${url}\u0000${text}`

function shapeOf(root: Root): Shape {
  const blocks: string[] = []
  const marks: string[] = []
  const links: string[] = []
  let text = ''
  const flush = (): void => {
    if (text !== '') blocks.push(`text:${text}`)
    text = ''
  }
  const walk = (node: Nodes): void => {
    const block = BLOCKS.has(node.type)
    if (block) {
      flush()
      const detail =
        node.type === 'definition'
          ? `${node.identifier}|${node.url}|${node.title ?? ''}`
          : node.type === 'heading'
            ? String(node.depth)
            : node.type === 'footnoteDefinition'
              ? node.identifier
              : ''
      blocks.push(`${node.type}:${detail}`)
    }
    if (MARKS.has(node.type)) marks.push(node.type)
    if (node.type === 'link') links.push(linkKey(node.url, textOf(node)))
    if (node.type === 'linkReference' || node.type === 'imageReference') {
      marks.push(`${node.type}:${node.identifier}`)
    }
    if (node.type === 'footnoteReference') marks.push(`footnote:${node.identifier}`)
    if (node.type === 'image') blocks.push(`image:${node.url}|${node.alt ?? ''}`)
    if (node.type === 'break') text += '\n'
    else if (node.type === 'inlineCode') text += '`' + node.value + '`'
    else if ('value' in node && typeof node.value === 'string' && !block) text += node.value
    else if (block && 'value' in node && typeof node.value === 'string') blocks.push(node.value)
    if ('children' in node) for (const child of node.children) walk(child)
    if (block) {
      flush()
      blocks.push(`/${node.type}`)
    }
  }
  walk(root)
  flush()
  return { blocks, marks, links }
}

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i])

const sorted = (xs: readonly string[]): string[] => [...xs].sort()

/** `text` with `fixes` written, the latest first so the earlier offsets hold. */
function written(text: string, fixes: readonly ArchFix[]): string {
  let out = text
  for (const f of [...fixes].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, f.start) + f.replacement + out.slice(f.end)
  }
  return out
}

/** A fix, with the link it writes as the comparison holds it. */
export interface CheckedFix {
  readonly fix: ArchFix
  readonly link: string
}

/**
 * The stretch of source a fix can change: the top-level block it sits in and one block on each side.
 * A fix writes inline text, so what it can change beyond its own block is a neighbour it joins or
 * splits, as a link definition's open title just above it is joined (H1). Both sides of a check are
 * read from this stretch alone, so they are read the same way.
 */
interface Stretch {
  readonly start: number
  readonly end: number
  /** For a table row: the header and delimiter lines run from `[0]` to `[1]`, and the row starts at `[2]`. */
  readonly keep?: readonly [number, number, number]
}

function stretchOf(root: Root, text: string, at: number): Stretch {
  const kids = root.children
  const i = kids.findIndex(
    (k) => (k.position?.start.offset ?? 0) <= at && at < (k.position?.end.offset ?? 0),
  )
  if (i < 0) return { start: 0, end: text.length }
  const own = kids[i]
  // A table row writes nothing beyond itself (a `|` in a target is refused): its stretch is the
  // header, the delimiter line and the row, read as a table of one row.
  if (own?.type === 'table') {
    const row = own.children.find(
      (r) => (r.position?.start.offset ?? 0) <= at && at < (r.position?.end.offset ?? 0),
    )
    const head = own.children[0]
    if (row !== undefined && head !== undefined && row !== head) {
      const headStart = head.position?.start.offset ?? 0
      const delimiter = text.indexOf('\n', head.position?.end.offset ?? 0)
      const afterDelimiter = text.indexOf('\n', delimiter + 1)
      const rowStart = row.position?.start.offset ?? 0
      const rowEnd = row.position?.end.offset ?? text.length
      if (delimiter >= 0 && afterDelimiter >= 0 && afterDelimiter < rowStart) {
        return { start: headStart, end: rowEnd, keep: [headStart, afterDelimiter + 1, rowStart] }
      }
    }
  }
  const start = i === 0 ? 0 : (kids[i - 1]?.position?.start.offset ?? 0)
  const end =
    i === kids.length - 1 ? text.length : (kids[i + 1]?.position?.end.offset ?? text.length)
  return { start, end }
}

/** Whether writing `set` into `text` leaves the same document, its mentions linked. */
function keepsShape(text: string, set: readonly CheckedFix[], before: Shape): boolean {
  const after = shapeOf(
    parseUncached(
      written(
        text,
        set.map((s) => s.fix),
      ),
    ),
  )
  return (
    same(after.blocks, before.blocks) &&
    same(after.marks, before.marks) &&
    same(sorted(after.links), sorted([...before.links, ...set.map((s) => s.link)]))
  )
}

/** A fix alone, checked over its stretch: the stretch parsed before and after, compared. */
function keepsAlone(root: Root, text: string, f: CheckedFix): boolean {
  const { start, end, keep } = stretchOf(root, text, f.fix.start)
  if (f.fix.end > end) return false
  // A row is read as a table of one row: the header and delimiter lines, then the row itself.
  const head = keep === undefined ? '' : text.slice(keep[0], keep[1])
  const from = keep === undefined ? start : keep[2]
  // A stretch that does not start the document starts on a fresh line, so a `---` there is never
  // read as front matter, which only the document's first line can open.
  const lead = (keep === undefined ? start : keep[0]) > 0 ? '\n' : ''
  const local = lead + head + text.slice(from, end)
  const shift = from - head.length - lead.length
  const moved: CheckedFix = {
    ...f,
    fix: { ...f.fix, start: f.fix.start - shift, end: f.fix.end - shift },
  }
  return keepsShape(local, [moved], shapeOf(parseUncached(local)))
}

/**
 * The fixes for one document that are safe applied alone, or all kept together: each alone leaves the
 * same document with its mention linked, and so does the set kept. The sets in between are not read. A fix applied alone is the common
 * case, since `.excluding()`, an overlap `applyFixes` drops, or a reader applying one by one each
 * leave the rest out; together is how `--apply` writes them. Each fix alone is checked over its
 * stretch (`stretchOf`); the set over the whole document, and when it fails, each fix passing alone
 * is added in order and kept only if the set still passes.
 */
export function fixesThatKeepTheDocument(
  root: Root,
  text: string,
  fixes: readonly CheckedFix[],
): Set<ArchFix> {
  const alone = fixes.filter((f) => keepsAlone(root, text, f))
  // Every kept set is read over the whole document too, one alone included: the stretch is argued
  // and fuzzed, not proved, and this parse is the backstop. No input is known that only it refuses.
  if (alone.length === 0) return new Set()
  const before = shapeOf(root)
  if (keepsShape(text, alone, before)) return new Set(alone.map((f) => f.fix))
  const kept: CheckedFix[] = []
  for (const f of alone) if (keepsShape(text, [...kept, f], before)) kept.push(f)
  return new Set(kept.map((f) => f.fix))
}
