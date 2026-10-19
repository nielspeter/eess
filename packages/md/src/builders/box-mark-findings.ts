import type { ArchViolation, Predicate, Undecided } from '@nielspeter/eess'
import { membership } from '@nielspeter/eess/internal'
import type { MdDocument } from '../model/document.js'
import { checkedOf, type BoxMarkState, type ReadBox, type UnreadBox } from '../model/task-items.js'

/** A box mark no rule was told about: one finding per document and mark (plan 0454). */
export const UNDECLARED_BOX_MARK = 'md/undeclared-box-mark'
/** A near-GFM box (`[ x ]`, `[x]done`, an empty `- [ ]`): one finding per box (plan 0454). */
export const MALFORMED_BOX = 'md/malformed-box'

const NOT_A_BOX = 'If it is not a box, write the bracket escaped (`\\[`) or in inline code.'

/**
 * The unread boxes the rule could have judged: those its predicates select read as open, as done,
 * or as unjudged (bug 0525). No list of "state predicates" is needed, so a caller's own state test is handled like
 * `areOpen()`. Applied through the kernel's one truth table (ADR-021): a box whose membership is
 * undecided is reached too, so its mark is reported, and the causes are returned so the caller
 * reports them as well. Neither finding is dropped because the box's document cannot be read.
 */
export function inScope(
  unread: readonly UnreadBox[],
  predicates: readonly Predicate<ReadBox>[],
): { readonly reached: UnreadBox[]; readonly undecided: readonly Undecided[] } {
  const origin = new Map<ReadBox, UnreadBox>()
  const readAs =
    (state: BoxMarkState) =>
    (box: UnreadBox): ReadBox => {
      const copy: ReadBox = { ...box, state, checked: checkedOf(state) }
      origin.set(copy, box)
      return copy
    }
  const reached = new Set<UnreadBox>()
  const undecided: Undecided[] = []
  for (const state of ['open', 'done', 'unjudged'] as const) {
    for (const copy of unread.map(readAs(state))) {
      const m = membership(predicates, 'all', copy)
      if (m === false) continue
      const box = origin.get(copy)
      if (box !== undefined) reached.add(box)
      if (m !== true) undecided.push(...m)
    }
  }
  return { reached: unread.filter((box) => reached.has(box)), undecided }
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
          `Write the mark you meant as \`[${box.mark}]\` followed by a space and the item's text` +
            `${box.mark === ' ' || box.mark === 'x' || box.mark === 'X' ? '' : ", and declare it if it is not GFM's"}` +
            '. Write `[x]` only if the work is done. ' +
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
        `Declare the state it means in the rule's \`marks\`, passed to taskItems() or honestyAtClose(): ` +
          `{ '${first.mark}': 'open' } if the work is not finished (in a closed record an open box then needs ` +
          `a disposition), 'done' only if it is, or 'unjudged' only if it never blocks a close in any record: ` +
          `it then leaves every close rule for good, so never for unfinished work. ` +
          `Or rewrite each box as \`[ ]\`, or \`[x]\` if done. ${NOT_A_BOX}`,
      ),
    )
  }
  return out
}
