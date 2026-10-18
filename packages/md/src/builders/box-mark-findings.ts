import type { ArchViolation, Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { MdDocument } from '../model/document.js'
import type { BoxMarkState, MdTaskItemRef } from '../model/task-items.js'

/** A box mark no rule was told about: one finding per document and mark (plan 0454). */
export const UNDECLARED_BOX_MARK = 'md/undeclared-box-mark'
/** A near-GFM box (`[ x ]`, `[x]done`, an empty `- [ ]`): one finding per box (plan 0454). */
export const MALFORMED_BOX = 'md/malformed-box'

/** A box a rule cannot judge, with its document. */
export type UnreadBox = MdTaskItemRef & { readonly doc: MdDocument }
/** A box read as open or done: what a `taskItems()` rule sees. */
export type ReadBox = Omit<MdTaskItemRef, 'state'> & {
  readonly state: BoxMarkState
  readonly doc: MdDocument
}

const NOT_A_BOX = 'If it is not a box, write the bracket escaped (`\\[`) or in inline code.'

/**
 * The unread boxes the rule could have judged: those its predicates select read as open, or read as
 * done. No list of "state predicates" is needed, so a caller's own state test is handled like
 * `areOpen()`. Applied by the kernel's one owner of predicate application.
 */
export function inScope(
  unread: readonly UnreadBox[],
  predicates: readonly Predicate<ReadBox>[],
): UnreadBox[] {
  const origin = new Map<ReadBox, UnreadBox>()
  const readAs =
    (state: BoxMarkState) =>
    (box: UnreadBox): ReadBox => {
      const copy: ReadBox = { ...box, state, checked: state === 'done' }
      origin.set(copy, box)
      return copy
    }
  const reached = new Set<UnreadBox>()
  for (const state of ['open', 'done'] as const) {
    for (const copy of matchingElements(unread.map(readAs(state)), [...predicates])) {
      const box = origin.get(copy)
      if (box !== undefined) reached.add(box)
    }
  }
  return unread.filter((box) => reached.has(box))
}

function finding(
  id: string,
  element: string,
  doc: MdDocument,
  line: number,
  message: string,
  suggestion: string,
): ArchViolation {
  return {
    rule: id,
    ruleId: id,
    element,
    file: doc.file,
    line,
    message,
    suggestion,
    bypassFilters: true,
  }
}

function listLines(lines: readonly number[]): string {
  const s = lines.map(String)
  return s.length <= 1 ? (s[0] ?? '') : `${s.slice(0, -1).join(', ')} and ${s[s.length - 1] ?? ''}`
}

/**
 * The findings for unread boxes: one `md/undeclared-box-mark` per (document, mark), at its first
 * box, naming every line (ADR-016's "one per cause": a mark is one missing declaration), and one
 * `md/malformed-box` per box (each is its own edit). Configuration findings: `.excluding()` cannot
 * hide them, and a `.warn()` rule carrying one fails. `examinedNothing` says the rule examined
 * nothing, so the message names these boxes as the cause.
 */
export function unreadFindings(
  boxes: readonly UnreadBox[],
  examinedNothing: boolean,
): ArchViolation[] {
  const why = examinedNothing ? ' They are why this rule examined nothing.' : ''
  const groups = new Map<string, UnreadBox[]>()
  const out: ArchViolation[] = []
  for (const box of boxes) {
    if (box.state === 'malformed') {
      out.push(
        finding(
          MALFORMED_BOX,
          `${box.doc.relPath}:${String(box.line)}`,
          box.doc,
          box.line,
          `this box reads like a box (mark \`${box.mark}\`), but GFM does not read it as one, so it is neither open nor done.${why}`,
          "Write it as `[x]` (or `[ ]`) followed by a space and the item's text. " +
            NOT_A_BOX +
            " A template's blank box (an issue or PR checklist) is given text, or left out of the rule's selection by its own predicates.",
        ),
      )
      continue
    }
    const key = `${box.doc.relPath}\u0000${box.mark}`
    const group = groups.get(key) ?? []
    group.push(box)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    const first = group[0]
    if (first === undefined) continue
    const lines = group.map((b) => b.line)
    const count = group.length === 1 ? '1 box, line' : `${String(group.length)} boxes, lines`
    out.push(
      finding(
        UNDECLARED_BOX_MARK,
        `${first.doc.relPath} [${first.mark}]`,
        first.doc,
        first.line,
        `\`[${first.mark}]\` is not a box mark this rule was told about (${count} ${listLines(lines)}), so ` +
          `${group.length === 1 ? 'it is' : 'they are'} neither open nor done and no rule can judge ${group.length === 1 ? 'it' : 'them'}.${why}`,
        `Declare it in the rule's \`marks\`: { '${first.mark}': 'open' } (or 'done'), passed to taskItems() or ` +
          `honestyAtClose(). Or rewrite each box as \`[ ]\` or \`[x]\`. ${NOT_A_BOX}`,
      ),
    )
  }
  return out
}
