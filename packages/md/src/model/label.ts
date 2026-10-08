/**
 * The label grammar a Markdown record uses to declare something on a line —
 * `**State:** Done`, `**Related to:** [a](a.md)` (plan 0405).
 *
 * One grammar, shared by the ledger's `State:` reader and `links().areLabelled()`,
 * so `**Related to**:` cannot be a label to one and a misspelling to the other.
 * Each caller decides case sensitivity when it compiles the pattern: the ledger
 * reads `**state:**` as `State`, `areLabelled` matches the declared spelling exactly.
 *
 * Accepted forms, each optionally after a list marker: `**Label:**`, `**Label**:`,
 * `__Label__:`, `Label:`. **The colon is required in every form.** Making it
 * optional turned any line beginning with the word into a declaration: the ledger
 * read `Stateless rendering is the default` as the state `less`, and `State
 * machine transitions are documented` as `machine`.
 */

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The regex source for a line that opens with `label`, in any accepted form. */
export function labelPattern(label: string): string {
  const l = escapeRe(label)
  return String.raw`^\s*(?:[-*+]\s+)?(?:\*\*${l}:\*\*|\*\*${l}\*\*\s*:|__${l}__\s*:|${l}\s*:)\s*`
}

/**
 * The text of a **wrapped** label (`**Label:**`, `**Label**:`, `__Label__:`) that
 * opens `line`, or `undefined`. The plain `Label:` form is deliberately absent:
 * prose that begins "related to: …" is common, so only a wrapped label is read
 * as an attempt to declare something.
 */
export function wrappedLabelOf(line: string): string | undefined {
  const m =
    /^\s*(?:[-*+]\s+)?(?:\*\*([^*\n]+?):\*\*|\*\*([^*\n]+?)\*\*\s*:|__([^_\n]+?)__\s*:)/.exec(line)
  if (m === null) return undefined
  return m[1] ?? m[2] ?? m[3]
}

/** True when `line` is a label in any form and nothing else follows it. */
export function isLabelAlone(line: string): boolean {
  return /^\s*(?:\*\*[^*\n]+:\*\*|\*\*[^*\n]+\*\*\s*:|__[^_\n]+__\s*:|[^\s:*_][^:\n]*:)\s*$/.test(
    line,
  )
}

/** Two label spellings that differ only in case or inner spacing. */
export function isNearMiss(found: string, declared: string): boolean {
  if (found === declared) return false
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()
  return norm(found) === norm(declared)
}
