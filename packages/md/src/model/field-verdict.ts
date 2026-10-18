import type { MdDocument } from './document.js'
import { resolveField } from './field-resolve.js'
import { unreadFieldMessage, unreadFields } from './field-unread.js'
import {
  readFields,
  scanFields,
  STRUCTURED_FORMS,
  type FieldOccurrence,
  type FieldOptions,
} from './fields.js'
import { wrappedLabelOf } from './label.js'
import { proseText } from './prose.js'

/** How a caller's allowed set judges one value: `ok`, and the clause a finding says when it fails. */
interface AllowedJudge {
  readonly ok: (value: string) => boolean
  readonly says: string
}

/** One finding about one document, before it gets a rule's context. */
export interface FieldCause {
  /**
   * `unreadable`: the value cannot be told (reported in both positions); `absent`: no field;
   * `disallowed`: a readable value outside the allowed set (both reported only by a condition).
   */
  readonly kind: 'unreadable' | 'absent' | 'disallowed'
  readonly element: string
  readonly line: number
  readonly message: string
}

/** A document's verdict: does it have the value, and what is said about it. */
export interface FieldVerdict {
  readonly has: boolean
  readonly causes: readonly FieldCause[]
}

const valueAt = (o: FieldOccurrence): string => o.values.join(', ')

/** The wrapped labels a document carries, so "no Status" can point at the label it does write. */
function labelsOf(doc: MdDocument): string[] {
  const found = new Set<string>()
  for (const line of proseText(doc.text, 'code-blocks', doc.root).split('\n')) {
    const label = wrappedLabelOf(line)?.trim()
    if (label !== undefined && label !== '') found.add(label)
  }
  return [...found]
}

/**
 * The verdict for one document (plan 0469), every reading under one fence mode, `'code-blocks'`, so
 * the resolver and the scan for unread labels cannot disagree about a line. Each document that does
 * not have the value gets one cause (ADR-009 rule 2), in this order: a conflict; an empty value; a
 * label in a form the rule does not read; a value that only a reading past an unclosed fence finds;
 * a value outside the header; no field. A document that has the value can still carry findings:
 * prose that disagrees, a label elsewhere in a form the rule does not read, a value outside
 * `allowed`.
 */
export function fieldVerdict(
  doc: MdDocument,
  spec: FieldOptions,
  allowed?: AllowedJudge,
): FieldVerdict {
  const at = (line: number): string => `${doc.relPath}:${String(line)}`
  const one = (cause: FieldCause): FieldVerdict => ({ has: false, causes: [cause] })
  const r = resolveField(doc, spec, 'code-blocks')
  const unread = unreadFields(doc, spec, 'code-blocks').map(
    (u): FieldCause => ({
      kind: 'unreadable',
      element: at(u.line),
      line: u.line,
      message: unreadFieldMessage(u),
    }),
  )
  if (r.kind === 'conflict') {
    const lines = r.occurrences.map((o) => o.line)
    const listed = r.occurrences.map((o) => `line ${String(o.line)} '${valueAt(o)}'`).join(', ')
    const times = lines.length === 2 ? 'twice' : `${String(lines.length)} times`
    return one({
      kind: 'unreadable',
      element: `${doc.relPath}:${lines.join(',')}`,
      line: lines[0] ?? 1,
      message: `${spec.label} is given ${times} (${listed}); keep one`,
    })
  }
  if (r.kind === 'empty') {
    const o = r.occurrence
    return one({
      kind: 'unreadable',
      element: at(o.line),
      line: o.line,
      message: `${o.label} at line ${String(o.line)} has no value this rule can read`,
    })
  }
  if (r.kind === 'value') {
    const o = r.occurrence
    const prose = r.disagreeing.map(
      (p): FieldCause => ({
        kind: 'unreadable',
        element: at(p.line),
        line: p.line,
        message: `prose says ${o.label} '${valueAt(p)}', but the field at line ${String(o.line)} says '${valueAt(o)}'`,
      }),
    )
    const refused = allowed === undefined ? [] : o.values.filter((v) => !allowed.ok(v))
    const disallowed = refused.map(
      (v): FieldCause => ({
        kind: 'disallowed',
        element: at(o.line),
        line: o.line,
        message: `'${v}' (${o.label}, line ${String(o.line)}) ${allowed?.says ?? ''}`,
      }),
    )
    return { has: refused.length === 0, causes: [...prose, ...unread, ...disallowed] }
  }
  if (unread.length > 0) return { has: false, causes: unread }
  // Read past an unclosed fence, the value is there: say so, rather than "no field".
  const [pastFence] = readFields(doc, spec, 'closed-fences')
  if (pastFence !== undefined) {
    return one({
      kind: 'unreadable',
      element: at(pastFence.line),
      line: pastFence.line,
      message: `${spec.label} at line ${String(pastFence.line)} follows a code fence that never closes; close the fence`,
    })
  }
  const labels = [spec.label, ...(spec.aliases ?? [])]
  if (spec.region === 'header') {
    const [outside] = scanFields(doc, labels, STRUCTURED_FORMS, undefined, 'code-blocks')
    if (outside !== undefined) {
      return one({
        kind: 'unreadable',
        element: at(outside.line),
        line: outside.line,
        message: `${spec.label} at line ${String(outside.line)} is outside the header (region: 'header'); move it into the header, or drop the region`,
      })
    }
  }
  // A plain `Status: x` line the rule does not read is named, so the author is not told to add a
  // field that is there. It stays "no field": prose opening "status: …" is common.
  const [plainLine] = spec.forms.includes('plain')
    ? []
    : scanFields(doc, labels, ['plain'], spec.region, 'code-blocks')
  const carried = labelsOf(doc)
  const hint =
    plainLine !== undefined
      ? `; line ${String(plainLine.line)} has \`${plainLine.text}\`, a plain line this rule does not read: add 'plain' to forms, or write it as \`**${spec.label}:** v\``
      : carried.length > 0
        ? `; its labels: ${carried.join(', ')}`
        : '; it carries no wrapped label'
  return one({
    kind: 'absent',
    element: doc.relPath,
    line: 1,
    message: `no ${spec.label} field (read as ${spec.forms.join(', ')})${hint}`,
  })
}
