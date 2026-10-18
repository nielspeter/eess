import type { MdDocument } from './document.js'
import { proseText } from './prose.js'

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
export interface FieldOccurrence {
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

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A label's body: ASCII case ignored (the `i` flag), any run of whitespace matching any other. */
const body = (label: string): string =>
  label
    .trim()
    .split(/\s+/)
    .map(escapeRe)
    .join(String.raw`\s+`)

const INDENT = String.raw`^ {0,3}`
const MARKER = String.raw`(?:(?:[-*+]|\d+[.)])\s+)?`

/** The pattern for one form over a label body; group 1 is the label as written, group 2 the rest. */
function formPattern(form: FieldForm, b: string): RegExp {
  const L = `(${b})`
  switch (form) {
    case 'heading':
      return new RegExp(String.raw`${INDENT}#{1,6}\s+${L}\s*:\s*(.*)$`, 'i')
    case 'bold-line':
      // Not `**X:** **v**`: a bold label with a bold value is the `bold` form.
      return new RegExp(
        String.raw`${INDENT}${MARKER}\*\*${L}\s*:(?!\*\*)\s*((?:(?!\*\*).)*?)\*\*\s*$`,
        'i',
      )
    case 'bold':
      return new RegExp(
        String.raw`${INDENT}${MARKER}(?:\*\*${L}:\*\*|\*\*${L}\*\*\s*:|__${L}__\s*:)(.*)$`,
        'i',
      )
    case 'plain':
      return new RegExp(String.raw`${INDENT}${MARKER}${L}\s*:(.*)$`, 'i')
  }
}

/** The forms a line could be read in, most specific first, so one line is read once. */
const ORDER: readonly FieldForm[] = ['heading', 'bold-line', 'bold', 'plain']

/** Any heading written `## Label: value`: it continues a header rather than ending it. */
const LABEL_HEADING = /^ {0,3}#{2,6}\s+[^:\n#][^:\n]*:\s*\S/
const HEADING = /^ {0,3}#{1,6}\s/
const DEEP_HEADING = /^ {0,3}#{2,6}\s/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
/** A line opening with a label in any form, any label: it ends a value above it. */
// A plain label is label-shaped (the ledger's `PLAIN_LABEL`), so prose holding a colon does not cut.
const ANY_LABEL =
  /^ {0,3}(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*[^*\n]+?:\*\*|\*\*[^*\n]+?\*\*\s*:|__[^_\n]+?__\s*:|\*\*[^*\n]+?:.*\*\*\s*$|[A-Za-z][A-Za-z ]{0,40}?\s*:)/

/**
 * The index past the document's header: the first heading of depth 2 or more that is not itself a
 * `## Label: value` heading. A title (depth 1) does not end it, and nor do label headings, so
 * `## Status: open` followed by `## Severity: High` stays one header.
 */
function headerEnd(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (DEEP_HEADING.test(line) && !LABEL_HEADING.test(line)) return i
  }
  return lines.length
}

/** A label's match on one line in one of `forms`, or `undefined`. */
function matchLine(
  line: string,
  bodies: readonly string[],
  forms: readonly FieldForm[],
): { form: FieldForm; label: string; rest: string } | undefined {
  for (const form of ORDER) {
    if (!forms.includes(form)) continue
    for (const b of bodies) {
      const m = formPattern(form, b).exec(line)
      if (m === null) continue
      // Group order follows the pattern: for `bold` the label sits in one of three groups.
      const groups = m.slice(1)
      const rest = groups[groups.length - 1] ?? ''
      const label = groups.slice(0, -1).find((g) => g !== undefined) ?? ''
      return { form, label: label.replace(/\s+/g, ' ').trim(), rest }
    }
  }
  return undefined
}

/**
 * The continuation of a value: the lines after its label until a blank line, a heading, a line that
 * is itself a label in any form, or the end of its list item. A `heading` or `bold-line` value is
 * one line.
 */
function continuation(lines: readonly string[], from: number, end: number): string[] {
  const out: string[] = []
  for (let i = from; i < end; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '' || HEADING.test(line) || LIST_ITEM.test(line) || ANY_LABEL.test(line)) {
      break
    }
    out.push(line.trim())
  }
  return out
}

/** The lines and label occurrences of one document in the given forms, in reading order. */
export function scanFields(
  doc: MdDocument,
  labels: readonly string[],
  forms: readonly FieldForm[],
  region: 'header' | undefined,
): { label: string; form: FieldForm; line: number; raw: string; text: string }[] {
  // Fenced code is an example: its lines are blanked, so nothing in it is read.
  const lines = proseText(doc.text, 'closed-fences', doc.root).split('\n')
  const end = region === 'header' ? headerEnd(lines) : lines.length
  const bodies = labels.map(body)
  const out: { label: string; form: FieldForm; line: number; raw: string; text: string }[] = []
  for (let i = 0; i < end; i++) {
    const line = lines[i] ?? ''
    const hit = matchLine(line, bodies, forms)
    if (hit === undefined) continue
    const more =
      hit.form === 'heading' || hit.form === 'bold-line' ? [] : continuation(lines, i + 1, end)
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
 * The one labelled-value reader: `fields()` and the unnamed-form scan use it, and so does
 * `haveField` (plan 0469). An occurrence whose cut value is empty is not yielded.
 */
export function readFields(doc: MdDocument, options: FieldOptions): FieldOccurrence[] {
  const cut = options.value ?? cleanValue
  const out: FieldOccurrence[] = []
  for (const hit of scanFields(
    doc,
    [options.label, ...(options.aliases ?? [])],
    options.forms,
    options.region,
  )) {
    const value = cut(hit.raw)
    if (value === '') continue
    const values = options.split ? options.split(value).filter((v) => v !== '') : [value]
    out.push({ ...hit, values })
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
 * The longest allowed value the text starts with, ignoring case, as a whole word; the text is
 * trimmed first. When none matches, the trimmed text is returned, so a check reports it.
 */
export function longestOf(allowed: readonly string[]): (raw: string) => string {
  const byLength = [...allowed].sort((a, b) => b.length - a.length)
  return (raw) => {
    const text = raw.trim()
    const lower = text.toLowerCase()
    for (const a of byLength) {
      if (!lower.startsWith(a.toLowerCase())) continue
      const next = text.charAt(a.length)
      if (next === '' || !/[\p{L}\p{N}]/u.test(next)) return text.slice(0, a.length)
    }
    return text
  }
}
