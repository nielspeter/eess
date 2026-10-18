import type { MdDocument } from './document.js'
import { proseText, type SetAside } from './prose.js'
import {
  LABEL_HEADING,
  PREFIX,
  boldLine,
  heading,
  labelBody,
  opensWithLabelShape,
  plain,
  wrapped,
} from './label.js'

/**
 * A labelled value in a record, read in the forms the caller names (plan 0468, proposal 017
 * block 1). eess-md has no default form: each corpus writes its labels its own way.
 *
 * | form        | reads                                    |
 * | ----------- | ---------------------------------------- |
 * | `bold`      | `**X:** v`, `**X**: v`, `__X__: v`       |
 * | `heading`   | `## X: v`, at any heading depth          |
 * | `bold-line` | `**X: v**`, a whole line in bold         |
 * | `plain`     | `X: v`                                   |
 *
 * Every form but `heading` may follow a list marker; every form may sit behind up to three spaces.
 */
export type FieldForm = 'bold' | 'heading' | 'bold-line' | 'plain'

/** What `fields()` reads: one label (and its aliases) in the forms the caller names. */
export interface FieldOptions {
  /** The label, compared ignoring ASCII case and runs of whitespace. */
  readonly label: string
  /** Other spellings of the same label, each reported under its own name. */
  readonly aliases?: readonly string[]
  /** The forms to read. Required: eess-md has no default form. */
  readonly forms: readonly FieldForm[]
  /** Where the value ends and how it is cleaned. Replaces the default, `cleanValue`. */
  readonly value?: (raw: string) => string
  /** Splits one value into several, after `value` has cut it. */
  readonly split?: (value: string) => readonly string[]
  /** `'header'`: read only the document's header. Default: the whole document. */
  readonly region?: 'header'
}

/** One labelled value found in a document. */
interface FieldOccurrence {
  /** The label as written, without its colon or emphasis. */
  readonly label: string
  readonly form: FieldForm
  /** 1-based line of the label. */
  readonly line: number
  /** The text after the label, continuation lines included, before cutting. */
  readonly raw: string
  /** The cut value, and the values `split` made of it (one, when there is no `split`). */
  readonly values: readonly string[]
  /** The line as written, for a finding that quotes it. */
  readonly text: string
}

/** The pattern for one form over a label body; group 1 is the label as written, the last group the rest. */
function formPattern(form: FieldForm, b: string): RegExp {
  const L = `(${b})`
  switch (form) {
    case 'heading':
      return new RegExp(`${heading(L)}\\s*(.*)$`, 'i')
    case 'bold-line':
      return new RegExp(`${PREFIX}${boldLine(L)}`, 'i')
    case 'bold':
      return new RegExp(`${PREFIX}(?:${wrapped(L)})(.*)$`, 'i')
    case 'plain':
      return new RegExp(`${PREFIX}${plain(L)}(.*)$`, 'i')
  }
}

/** The forms a line could be read in, most specific first, so one line is read once. */
const ORDER: readonly FieldForm[] = ['heading', 'bold-line', 'bold', 'plain']

const HEADING = /^\s*#{1,6}\s/
const DEEP_HEADING = /^\s*#{2,6}\s/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
const THEMATIC_BREAK = /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/

/**
 * The index past the document's header: the first heading of depth 2 or more that is not itself a
 * `## Label: value` heading (the shared `LABEL_HEADING`, the ledger's rule too). A title (depth 1)
 * does not end it. This is `fields()`'s header; the ledger's `State:` reader reads its own, larger
 * region (bug 0119).
 */
function headerEnd(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (DEEP_HEADING.test(line) && !LABEL_HEADING.test(line)) return i
  }
  return lines.length
}

/** The compiled patterns for some labels in some forms, built once per scan. */
type Patterns = readonly { readonly form: FieldForm; readonly re: RegExp }[]

function compile(labels: readonly string[], forms: readonly FieldForm[]): Patterns {
  const bodies = labels.map(labelBody)
  return ORDER.filter((f) => forms.includes(f)).flatMap((form) =>
    bodies.map((b) => ({ form, re: formPattern(form, b) })),
  )
}

/** A label's match on one line, or `undefined`. */
function matchLine(
  line: string,
  patterns: Patterns,
): { form: FieldForm; label: string; rest: string } | undefined {
  for (const { form, re } of patterns) {
    const m = re.exec(line)
    if (m === null) continue
    // Group order follows the pattern: for `bold` the label sits in one of three groups.
    const groups = m.slice(1)
    const rest = groups[groups.length - 1] ?? ''
    const label = groups.slice(0, -1).find((g) => g !== undefined) ?? ''
    return { form, label: label.replace(/\s+/g, ' ').trim(), rest }
  }
  return undefined
}

/**
 * The continuation of a value: the lines after its label until a blank line, a heading, a thematic
 * break, a line that opens with a label of any shape (the shared `opensWithLabelShape`), or the end
 * of its list item. A `heading` or `bold-line` value is one line.
 */
function continuation(lines: readonly string[], from: number, end: number): string[] {
  const out: string[] = []
  for (let i = from; i < end; i++) {
    const line = lines[i] ?? ''
    if (
      line.trim() === '' ||
      HEADING.test(line) ||
      THEMATIC_BREAK.test(line) ||
      LIST_ITEM.test(line) ||
      opensWithLabelShape(line)
    ) {
      break
    }
    out.push(line.trim())
  }
  return out
}

/** One label line a scan found. */
export interface ScannedField {
  readonly label: string
  readonly form: FieldForm
  readonly line: number
  readonly raw: string
  readonly text: string
}

/**
 * A document's lines as the field readers see them: fenced code blanked (by `setAside`, default
 * `'closed-fences'`, which reads past a fence that never closes, so a reader whose findings grow
 * with what it reads reports too much rather than nothing), a trailing `\r` removed so a CRLF file
 * reads as an LF one, and cut at the header's end when `region` is `'header'`.
 */
export function fieldLines(
  doc: MdDocument,
  region: 'header' | undefined,
  setAside: SetAside = 'closed-fences',
): string[] {
  const lines = proseText(doc.text, setAside, doc.root)
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
  return region === 'header' ? lines.slice(0, headerEnd(lines)) : lines
}

/** The label occurrences of one document in the given forms, in reading order. */
export function scanFields(
  doc: MdDocument,
  labels: readonly string[],
  forms: readonly FieldForm[],
  region: 'header' | undefined,
  setAside: SetAside = 'closed-fences',
): ScannedField[] {
  const lines = fieldLines(doc, region, setAside)
  const patterns = compile(labels, forms)
  const out: ScannedField[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const hit = matchLine(line, patterns)
    if (hit === undefined) continue
    const more =
      hit.form === 'heading' || hit.form === 'bold-line'
        ? []
        : continuation(lines, i + 1, lines.length)
    out.push({
      label: hit.label,
      form: hit.form,
      line: i + 1,
      raw: [hit.rest, ...more].join('\n'),
      text: line.trim(),
    })
  }
  return out
}

/**
 * Every occurrence of the label (and its aliases) in one document, in the forms the caller names.
 * The one labelled-value reader: `fields()` and the unnamed-form scan use it, and so will
 * `haveField` (plan 0469, which should pass `'code-blocks'` as `setAside`: for a presence check,
 * reading past an unclosed fence errs toward "present"). An occurrence whose cut value is empty is
 * still yielded, with the value `''`, so a check reports it rather than skipping it.
 */
export function readFields(
  doc: MdDocument,
  options: FieldOptions,
  setAside: SetAside = 'closed-fences',
): FieldOccurrence[] {
  const cut = options.value ?? cleanValue
  const out: FieldOccurrence[] = []
  const labels = [options.label, ...(options.aliases ?? [])]
  for (const hit of scanFields(doc, labels, options.forms, options.region, setAside)) {
    const value = cut(hit.raw)
    const split = value === '' || options.split === undefined ? [value] : options.split(value)
    const values = split.filter((v) => v !== '')
    out.push({ ...hit, values: values.length > 0 ? values : [''] })
  }
  return out
}

const PICTOGRAPH = String.raw`[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]`
const LEADING_PICTOGRAPHS = new RegExp(`^(?:${PICTOGRAPH}\\s*)+`, 'u')
const TRAILING_PICTOGRAPHS = new RegExp(`(?:\\s*${PICTOGRAPH})+$`, 'u')

/**
 * The default value: paired emphasis delimiters removed (`**x**`, `_x_`, `` `x` ``, `~~x~~`, never a
 * lone `_` inside a word), a leading or trailing pictograph dropped, whitespace trimmed and
 * collapsed. It cuts nothing: `High — the reason` stays whole. Compose it with a helper to cut.
 */
export function cleanValue(raw: string): string {
  return raw
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/~~([^~\n]+?)~~/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1')
    .replace(/(^|[^\p{L}\p{N}_])__([^_\n]+?)__(?=[^\p{L}\p{N}_]|$)/gu, '$1$2')
    .replace(/(^|[^\p{L}\p{N}_*])\*([^*\n]+?)\*(?=[^\p{L}\p{N}_*]|$)/gu, '$1$2')
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+?)_(?=[^\p{L}\p{N}_]|$)/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_PICTOGRAPHS, '')
    .replace(TRAILING_PICTOGRAPHS, '')
    .trim()
}

/** A value cut at the first of `chars`, trimmed: `untilDelimiter(['—'])` on `High — reason` is `High`. */
export function untilDelimiter(chars: readonly string[]): (raw: string) => string {
  return (raw) => {
    let end = raw.length
    for (const c of chars) {
      const at = raw.indexOf(c)
      if (at >= 0 && at < end) end = at
    }
    return raw.slice(0, end).trim()
  }
}

/**
 * The longest allowed value the text starts with, ignoring case and the apostrophe's glyph (`’` is
 * `'`), as a whole word; the text is trimmed first. When none matches, the trimmed text is returned, so a check reports it.
 */
export function longestOf(allowed: readonly string[]): (raw: string) => string {
  const fold = (t: string): string => t.toLowerCase().replace(/’/g, "'")
  const byLength = [...allowed].sort((a, b) => b.length - a.length)
  return (raw) => {
    const text = raw.trim()
    const folded = fold(text)
    for (const a of byLength) {
      if (!folded.startsWith(fold(a))) continue
      // The ledger's word characters (letters, digits, `_`, `-`, an apostrophe): `Done-ish` is not `Done`.
      const next = text.charAt(a.length)
      if (next === '' || !/[\p{L}\p{N}_'’-]/u.test(next)) return text.slice(0, a.length)
    }
    return text
  }
}
