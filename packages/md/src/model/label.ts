/**
 * The label grammar a Markdown record uses to declare something on a line —
 * `**State:** Done`, `**Related to:** [a](a.md)` (plan 0405).
 *
 * One grammar, shared by the ledger's `State:` reader, `links().areLabelled()`,
 * and the link walk's label-alone test, so `**Related to**:` cannot be a label to
 * one and a misspelling to another. Every reader below is built from the same
 * fragments; none restates a form by hand. Each caller decides case sensitivity
 * when it compiles the pattern: the ledger reads `**state:**` as `State`,
 * `areLabelled` matches the declared spelling exactly.
 *
 * Accepted forms, each optionally after a list marker (a bullet or an ordered `1.`/`1)`), behind
 * any indent: `**Label:**`, `**Label**:`, `__Label__:`, `Label:`. `fields()` (plan 0468) reads two
 * more forms from the same fragments, `## Label: v` and `**Label: v**`; the ledger and `fields()`
 * share the prefix, the label headings and the plain-label shape defined here, so they cannot read a
 * line differently. **The colon is required in every form.** Making it
 * optional turned any line beginning with the word into a declaration: the ledger
 * read `Stateless rendering is the default` as the state `less`, and `State
 * machine transitions are documented` as `machine`.
 *
 * The link walk hands these readers a block's text from its content column, so
 * an ordered-list marker, a task box or a blockquote `>` never reaches them; the
 * optional bullet marker is kept for the ledger, which reads raw lines.
 */

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Any indent and an optional list marker (bullet or ordered): every reader's raw-line prefix. */
export const PREFIX = String.raw`^\s*(?:(?:[-*+]|\d+[.)])\s+)?`

/** The three wrapped forms over a label body (a regex source). */
export const wrapped = (body: string): string =>
  String.raw`\*\*${body}:\*\*|\*\*${body}\*\*\s*:|__${body}__\s*:`

/** The plain form over a label body (a regex source). */
export const plain = (body: string): string => String.raw`${body}\s*:`

/** A heading form over a label body: `## Label: v`, any depth (a regex source, no prefix). */
export const heading = (body: string): string => String.raw`^\s*#{1,6}\s+${body}\s*:`

/**
 * A whole line in bold over a label body: `**Label: v**` (a regex source, after the prefix). Not
 * `**Label:** **v**`, a bold label with a bold value, which is the wrapped form.
 */
export const boldLine = (body: string): string =>
  String.raw`\*\*${body}\s*:(?!\*\*)\s*((?:(?!\*\*).)*?)\*\*\s*$`

/** A label's body: any run of whitespace in the label matches any other (case is the caller's flag). */
export const labelBody = (label: string): string =>
  label
    .trim()
    .split(/\s+/)
    .map(escapeRe)
    .join(String.raw`\s+`)

/**
 * A `## Label: value` heading: its label and value. Such a heading continues a record's header
 * rather than ending it, as a run of field headings (`## Status: Open` then `## Severity: High`) is
 * one header (bug 0476). One definition, read by the ledger and by `fields()`.
 */
export const LABEL_HEADING = /^##\s+([A-Za-z][A-Za-z ]{0,40}?)\s*:\s*(\S.*?)\s*$/

/** A plain `Label:` opening a line, after the prefix: the label's text. Label-shaped, not prose. */
export const PLAIN_LABEL = /^\s*(?:(?:[-*+]|\d+[.)])\s+)?([A-Za-z][A-Za-z ]{0,40}?)\s*:/

/**
 * Any label's body. A plain body may be anything up to a colon: it is read only
 * to ask whether a line is a label alone, and a plain line that is not the
 * declared label never decides a declaration (`decidingBlock`), so a loose match
 * here cannot hide one.
 */
const ANY_WRAPPED = String.raw`([^*_\n]+?)`
const ANY_PLAIN = String.raw`[^\s:*_][^:\n]*?`

/** The regex source for a line that opens with `label`, in any accepted form. */
export function labelPattern(label: string): string {
  const l = escapeRe(label)
  return `${PREFIX}(?:${wrapped(l)}|${plain(l)})\\s*`
}

const WRAPPED_LABEL = new RegExp(`${PREFIX}(?:${wrapped(ANY_WRAPPED)})`)
const OPENS_WITH_LABEL = new RegExp(`${PREFIX}(?:${wrapped(ANY_WRAPPED)}|${plain(ANY_PLAIN)})`)
const LABEL_ALONE = new RegExp(`${OPENS_WITH_LABEL.source}\\s*$`)

/**
 * The text of a **wrapped** label (`**Label:**`, `**Label**:`, `__Label__:`) that
 * opens `line`, or `undefined`. The plain `Label:` form is deliberately absent:
 * prose that begins "related to: …" is common, so only a wrapped label is read
 * as an attempt to declare something.
 */
export function wrappedLabelOf(line: string): string | undefined {
  const m = WRAPPED_LABEL.exec(line)
  if (m === null) return undefined
  return m[1] ?? m[2] ?? m[3]
}

const BOLD_LINE_ANY = new RegExp(`${PREFIX}${boldLine(ANY_WRAPPED)}`)

/**
 * Whether `line` opens with a label of any shape a reader would take for one: wrapped, a whole bold
 * line, or a label-shaped plain `Label:`. A value continued over lines ends at such a line.
 */
export function opensWithLabelShape(line: string): boolean {
  return WRAPPED_LABEL.test(line) || BOLD_LINE_ANY.test(line) || PLAIN_LABEL.test(line)
}

/** True when `line` is a label in any form and nothing else follows it. */
export function isLabelAlone(line: string): boolean {
  return LABEL_ALONE.test(line)
}

/** Two label spellings that differ only in case or inner spacing. */
export function isNearMiss(found: string, declared: string): boolean {
  if (found === declared) return false
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()
  return norm(found) === norm(declared)
}
