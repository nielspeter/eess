import { ArchConfigError } from '@nielspeter/eess'
import type { ListItem, Nodes, Root } from 'mdast'
import type { MdDocument } from './document.js'
import { textOf } from './text-of.js'

/** What a box mark declares: open (it blocks a close) or done. */
export type BoxMarkState = 'open' | 'done'

/** How a caller reads box marks beyond GFM's (plan 0454). */
export interface TaskItemOptions {
  /** Box marks beyond GFM's `[ ]` and `[x]`, each declared open (it blocks a close) or done. */
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
  /** The item's own text (its first paragraph after the box), trimmed; nested sub-items excluded. */
  readonly text: string
  /** 1-based line of the box in the source document. */
  readonly line: number
}

/** `checked` from `state`: the one place it is derived, so the two cannot drift. */
export const checkedOf = (state: MdTaskItemRef['state']): boolean => state === 'done'

/** A box a rule cannot judge (undeclared or malformed), with its document. */
export type UnreadBox = MdTaskItemRef & { readonly doc: MdDocument }

/** A box read as open or done, with its document: what a `taskItems()` rule sees. */
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
 * is GFM's own space, `x` or `X`, or a state other than `'open'` or `'done'`. Each refusal names the
 * key. Shared by `taskItems()` and `honestyAtClose()`.
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
    if (value !== 'open' && value !== 'done') {
      throw new ArchConfigError(
        caller,
        `box mark '${key}' is declared ${JSON.stringify(value)}; declare it 'open' or 'done'.`,
      )
    }
  }
}

/** A box read off one list item, or `null` when the item is not a box. */
type Box = Pick<MdTaskItemRef, 'mark' | 'state' | 'text'>

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
    const text = (paragraph ? textOf(paragraph) : textOf(item)).trim()
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
  const text = after.trim()
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
 * skipped here, as a quoted box is not a live ledger entry. A box's `text` is its first paragraph,
 * so a nested sub-item is its own box. `source` is the document's text: mdast resolves an escaped
 * `\[` to `[`, so the escape is read from the source.
 */
export function collectTaskItems(
  root: Root,
  options: TaskItemOptions & { readonly source: string },
): MdTaskItemRef[] {
  const marks = options.marks ?? {}
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
