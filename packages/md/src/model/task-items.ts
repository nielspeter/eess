import { ArchConfigError } from '@nielspeter/eess'
import type { ListItem, Nodes, Root } from 'mdast'
import type { MdDocument } from './document.js'
import { textOf } from './text-of.js'

/**
 * What a box mark declares: open (it blocks a close), done, or unjudged (bug 0525): a box no close
 * rule judges, neither open nor done, that a rule can still select by its mark or its state.
 */
export type BoxMarkState = 'open' | 'done' | 'unjudged'

/** The states a mark can be declared, in the order a message names them. */
const DECLARABLE: readonly string[] = ['open', 'done', 'unjudged'] satisfies BoxMarkState[]

/** How a caller reads box marks beyond GFM's (plan 0454). */
export interface TaskItemOptions {
  /**
   * Box marks beyond GFM's `[ ]` and `[x]`, each declared open (it blocks a close), done, or
   * unjudged (no close rule judges it).
   */
  readonly marks?: Readonly<Record<string, BoxMarkState>>
}

/** A box in a document: GFM's `- [ ]`/`- [x]`, a declared mark, or one that is not read. */
export interface MdTaskItemRef {
  /** `true` only when `state` is `'done'`. Kept for compatibility; derived from `state` in one place. */
  readonly checked: boolean
  /** The mark as written: `' '`, `'x'`, `'X'`, or the extra mark. */
  readonly mark: string
  /**
   * GFM's `[ ]` is open and `[x]` done; an extra mark has its declared state. `'undeclared'` is a
   * mark no one declared; `'malformed'` is a near-GFM box (`[ x ]`, `[x]done`, an empty `- [ ]`).
   */
  readonly state: BoxMarkState | 'undeclared' | 'malformed'
  /**
   * The item's own text after the box: every paragraph of the item and every sub-item that is not
   * itself a box, with whitespace collapsed across lines (bug 0507). A nested box is its own box,
   * so its text is not here; fenced code and HTML are not prose and are not read.
   */
  readonly text: string
  /** 1-based line of the box in the source document. */
  readonly line: number
}

/** `checked` from `state`: the one place it is derived, so the two cannot drift. */
export const checkedOf = (state: MdTaskItemRef['state']): boolean => state === 'done'

/** A box a rule cannot judge (undeclared or malformed), with its document. */
export type UnreadBox = MdTaskItemRef & { readonly doc: MdDocument }

/** A box read as open, done or unjudged, with its document: what a `taskItems()` rule sees. */
export type ReadBox = Omit<MdTaskItemRef, 'state'> & {
  readonly state: BoxMarkState
  readonly doc: MdDocument
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The graphemes of `s`, so `[→]` and a combining sequence are each one mark. */
function graphemes(s: string): string[] {
  return [...segmenter.segment(s)].map((g) => g.segment)
}

const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u
const GFM_MARKS = new Set([' ', 'x', 'X'])

/**
 * Refuse a declaration that cannot mean what it says (ADR-009): a key that is not one grapheme, or
 * is GFM's own space, `x` or `X`, or a state other than `'open'`, `'done'` or `'unjudged'`. No state
 * is filled in for a mark, so `'unjudged'` is only ever declared (bug 0525). Each refusal names the
 * key. Shared by `taskItems()`, `honestyAtClose()` and `collectTaskItems()`.
 */
export function validateMarks(
  marks: Readonly<Record<string, unknown>> | undefined,
  caller: string,
): void {
  for (const [key, value] of Object.entries(marks ?? {})) {
    if (graphemes(key).length !== 1) {
      throw new ArchConfigError(
        caller,
        `box mark '${key}' is not one grapheme; a mark is the one character a reader sees between the brackets.`,
      )
    }
    if (key === '[' || key === ']' || (/^\s$/u.test(key) && key !== ' ')) {
      throw new ArchConfigError(
        caller,
        `box mark ${JSON.stringify(key)} can never be read as a mark: a bracket ends the box, and GFM reads whitespace as its own.`,
      )
    }
    if (GFM_MARKS.has(key)) {
      throw new ArchConfigError(
        caller,
        `box mark '${key}' is GFM's own; GFM reads [ ] as open and [x] as done, so it cannot be declared.`,
      )
    }
    if (typeof value !== 'string' || !DECLARABLE.includes(value)) {
      throw new ArchConfigError(
        caller,
        `box mark '${key}' is declared ${value === undefined ? 'undefined' : JSON.stringify(value)}; declare it 'open', 'done' or 'unjudged'.`,
      )
    }
  }
}

/** A box read off one list item, or `null` when the item is not a box. */
type Box = Pick<MdTaskItemRef, 'mark' | 'state' | 'text'>

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()

/**
 * The rest of a box's own text, after its first paragraph (bug 0507): its other blocks, and its
 * sub-items that are not boxes, each read the same way, so a deferral written below the box's line
 * belongs to the box. A sub-item that is a box is its own box and is left out, with everything in it.
 */
function restOfItem(
  item: ListItem,
  source: string,
  marks: Readonly<Record<string, BoxMarkState>>,
): string {
  const parts: string[] = []
  item.children.forEach((child, i) => {
    if (i === 0 && child.type === 'paragraph') return
    if (child.type === 'code' || child.type === 'html') return
    if (child.type !== 'list') {
      parts.push(textOf(child))
      return
    }
    for (const sub of child.children) {
      if (readBoxMark(sub, source, marks) !== null) continue
      const first = sub.children[0]
      parts.push(first?.type === 'paragraph' ? textOf(first) : '', restOfItem(sub, source, marks))
    }
  })
  return collapse(parts.join(' '))
}

/** The first paragraph's text after the box, and the rest of the item's own text, as one. */
const ownText = (first: string, rest: string): string => collapse(`${first} ${rest}`)

/**
 * Read a list item's box (plan 0454). GFM's boxes come from mdast's `checked`. Any other item is a
 * box only when its first paragraph opens with a plain text node (not a link, a reference or inline
 * code), not escaped in the source (`\[`), that starts with `[`:
 *
 * - `[`, one grapheme, `]`, a space and text: a mark. Declared, it has its state; undeclared, it is
 *   `'undeclared'`, except an undeclared letter or digit, which is not a mark (`[1]`, `[o]`).
 * - `[`, spaces, one grapheme that is a space, `x`, `X`, a declared mark or no letter or digit,
 *   spaces, `]`, and not exactly a box or a mark: `'malformed'` (`[ x ]`, `[x]done`, `- [ ]`).
 */
function readBoxMark(
  item: ListItem,
  source: string,
  marks: Readonly<Record<string, BoxMarkState>>,
): Box | null {
  const paragraph = item.children[0]?.type === 'paragraph' ? item.children[0] : undefined
  if (typeof item.checked === 'boolean') {
    // Only the item's own text is read, so a large document is not copied once per box.
    const at = item.position?.start.offset
    const end = item.position?.end.offset
    const written = at !== undefined ? /\[([ xX])\]/.exec(source.slice(at, end))?.[1] : undefined
    const mark = written ?? (item.checked ? 'x' : ' ')
    const text = paragraph
      ? ownText(textOf(paragraph), restOfItem(item, source, marks))
      : collapse(textOf(item))
    return { mark, state: item.checked ? 'done' : 'open', text }
  }
  const first = paragraph?.children[0]
  if (paragraph === undefined || first?.type !== 'text' || !first.value.startsWith('[')) return null
  const start = paragraph.position?.start.offset
  if (start !== undefined && source.charAt(start) === '\\') return null
  const close = first.value.indexOf(']')
  if (close < 0) return null
  const inner = first.value.slice(1, close)
  const full = textOf(paragraph)
  const after = full.slice(full.indexOf(']') + 1)
  const text = ownText(after, restOfItem(item, source, marks))
  const trimmed = inner.trim()
  const glyphs = graphemes(trimmed === '' ? inner.slice(0, 1) : trimmed)
  if (glyphs.length !== 1) return null
  const mark = glyphs[0] ?? ''
  const declared = marks[mark]
  const known = GFM_MARKS.has(mark) || declared !== undefined
  if (!known && LETTER_OR_DIGIT.test(mark)) return null
  // GFM takes a space, a tab or a line ending after the box; so does a mark.
  const exact = inner === mark && /^[ \t\r\n]/.test(after) && text !== ''
  if (exact && !GFM_MARKS.has(mark)) {
    return { mark, state: declared ?? 'undeclared', text }
  }
  return { mark, state: 'malformed', text }
}

/**
 * Collect the boxes of a document tree: GFM's, and since plan 0454 every other box mark too, each
 * with its `state`. An undeclared or malformed box has `checked: false`.
 *
 * mdast supplies for free the false-positive guards a line-regex scanner has to emulate by hand: a
 * box inside fenced code is part of a `code` node, never a `listItem`; one inside a blockquote is
 * skipped here, as a quoted box is not a live ledger entry. A box's `text` is all of its own
 * content but the boxes nested in it, which are their own boxes (bug 0507). `source` is the document's text: mdast resolves an escaped
 * `\[` to `[`, so the escape is read from the source.
 */
export function collectTaskItems(
  root: Root,
  options: TaskItemOptions & { readonly source: string },
): MdTaskItemRef[] {
  validateMarks(options.marks, 'collectTaskItems')
  // Only the own keys validation read: a state on the prototype is never looked up, so it cannot be
  // forged past the check (release review, enforcement M1).
  const marks = Object.fromEntries(Object.entries(options.marks ?? {}))
  const out: MdTaskItemRef[] = []
  const visit = (node: Nodes, inBlockquote: boolean): void => {
    if (node.type === 'blockquote') {
      for (const child of node.children) visit(child, true)
      return
    }
    if (node.type === 'listItem' && !inBlockquote) {
      const box = readBoxMark(node, options.source, marks)
      if (box !== null) {
        out.push({ ...box, checked: checkedOf(box.state), line: node.position?.start.line ?? 0 })
      }
    }
    if ('children' in node) {
      for (const child of node.children) visit(child, inBlockquote)
    }
  }
  visit(root, false)
  return out
}
