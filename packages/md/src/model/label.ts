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
 * Accepted forms, each optionally after a list marker: `**Label:**`, `**Label**:`,
 * `__Label__:`, `Label:`. **The colon is required in every form.** Making it
 * optional turned any line beginning with the word into a declaration: the ledger
 * read `Stateless rendering is the default` as the state `less`, and `State
 * machine transitions are documented` as `machine`.
 *
 * The link walk hands these readers a block's text from its content column, so
 * an ordered-list marker, a task box or a blockquote `>` never reaches them; the
 * optional bullet marker is kept for the ledger, which reads raw lines.
 */

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Leading space and an optional bullet marker — the ledger's raw-line prefix. */
const PREFIX = String.raw`^\s*(?:[-*+]\s+)?`

/** The three wrapped forms over a label body (a regex source). */
const wrapped = (body: string): string =>
  String.raw`\*\*${body}:\*\*|\*\*${body}\*\*\s*:|__${body}__\s*:`

/** The plain form over a label body (a regex source). */
const plain = (body: string): string => String.raw`${body}\s*:`

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
