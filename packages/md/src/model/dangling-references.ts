import type { Nodes } from 'mdast'

/** A full or collapsed reference whose label has no definition (bug 0558): text, not a link. */
interface DanglingReference {
  /** The label as the source writes it: the second brackets, or the first for `[label][]`. */
  readonly label: string
  /** The first brackets' text. */
  readonly text: string
  /** Char offset of the opening `[` in the source. */
  readonly offset: number
  /** 1-based line of the opening `[`. */
  readonly line: number
}

/** Inline nodes whose source cannot hold a dangling reference: code, links, images, HTML. */
const MASKED = new Set([
  'inlineCode',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'html',
  'footnoteReference',
])

/** The label normalized as the parser keys a definition: whitespace collapsed, case folded. */
const keyOf = (label: string): string =>
  label
    .replace(/[\t\n\r ]+/g, ' ')
    .trim()
    .toLowerCase()
    .toUpperCase()
    .toLowerCase()

// `[text][label]` or `[label][]`, neither bracket holding a bracket. The text and the label are
// checked to be non-blank below.
const SHAPE = /\[([^[\]]*)\]\[([^[\]]*)\]/g

/**
 * The dangling references in one leaf block (a paragraph, a heading, a table cell): `[text][label]`
 * or `[label][]` written in its source, outside code, links, images and HTML, not escaped, not an
 * image (`![…][…]`), whose label `defined` does not hold. A defined one is a `linkReference` to the
 * parser and never reaches here; `defined` keeps a shape the parser declined for another reason
 * from being reported. A shortcut `[label]` is never one: `[WIP]`, a task box and `[!NOTE]` share
 * its shape.
 */
export function danglingReferencesIn(
  block: Nodes,
  source: string,
  defined: ReadonlySet<string>,
): DanglingReference[] {
  const start = block.position?.start.offset
  const end = block.position?.end.offset
  if (start === undefined || end === undefined) return []
  const chars = source.slice(start, end).split('')
  const mask = (from: number, to: number): void => {
    for (let i = Math.max(from - start, 0); i < Math.min(to - start, chars.length); i++) {
      if (chars[i] !== '\n') chars[i] = ' '
    }
  }
  const walk = (node: Nodes): void => {
    if (node !== block && MASKED.has(node.type)) {
      mask(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0)
      return
    }
    if ('children' in node) for (const child of node.children) walk(child)
  }
  walk(block)
  // An escaped character is not markup: `\[` and `\]` open and close nothing.
  for (let i = 0; i < chars.length - 1; i++) {
    if (chars[i] === '\\') {
      chars[i] = ' '
      if (chars[i + 1] !== '\n') chars[i + 1] = ' '
      i++
    }
  }
  const masked = chars.join('')
  const out: DanglingReference[] = []
  for (const m of masked.matchAll(SHAPE)) {
    const [, text = '', second = ''] = m
    const label = second.trim() === '' ? text : second
    if (label.trim() === '' || text.trim() === '' || masked[m.index - 1] === '!') continue
    if (defined.has(keyOf(label))) continue
    const raw = source.slice(start + m.index, start + m.index + m[0].length)
    const rawLabel =
      second.trim() === '' ? raw.slice(1, 1 + text.length) : raw.slice(text.length + 3, -1)
    out.push({
      label: rawLabel,
      text: raw.slice(1, 1 + text.length),
      offset: start + m.index,
      line:
        (block.position?.start.line ?? 1) + (masked.slice(0, m.index).match(/\n/g)?.length ?? 0),
    })
  }
  return out
}
