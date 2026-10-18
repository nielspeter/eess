import type { Condition, ConditionContext, Predicate } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import { resolveField } from '../model/field-resolve.js'
import { scanFields, type FieldOccurrence, type FieldOptions } from '../model/fields.js'
import { wrappedLabelOf } from '../model/label.js'
import { proseText } from '../model/prose.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import { unreadFieldMessage, unreadFields } from './field-findings.js'
import { judge, type Allowed } from './vocabulary.js'

/** What `haveField` asks of a document (plan 0469). */
export interface HaveFieldOptions extends FieldOptions {
  /** The allowed values, after the caller's `value`: what `resolveAgainst` takes. */
  readonly oneOf?: Allowed
}

/** One finding about one document, before it gets the rule's context. */
interface Cause {
  /**
   * `unreadable`: the value cannot be told (reported in both positions); `absent`: no field;
   * `disallowed`: a readable value outside `oneOf` (both reported only by the condition).
   */
  readonly kind: 'unreadable' | 'absent' | 'disallowed'
  readonly element: string
  readonly line: number
  readonly message: string
}

/** A document's verdict: is it selected, and what is said about it. */
interface FieldVerdict {
  readonly has: boolean
  readonly causes: readonly Cause[]
}

const STRUCTURED = ['bold', 'heading', 'bold-line'] as const

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
 * The verdict for one document. Each document that is not selected gets one cause (ADR-009 rule 2):
 * a conflict, an empty value, a label in a form the rule does not read, a value outside the header,
 * or no field. A selected document can still carry findings: prose that disagrees with its field, a
 * label elsewhere in a form the rule does not read, a value outside `oneOf`.
 */
export function fieldVerdict(doc: MdDocument, spec: HaveFieldOptions): FieldVerdict {
  const at = (line: number): string => `${doc.relPath}:${String(line)}`
  const r = resolveField(doc, spec)
  const unread = unreadFields(doc, spec).map(
    (u): Cause => ({
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
    const first = lines[0] ?? 1
    return {
      has: false,
      causes: [
        {
          kind: 'unreadable',
          element: `${doc.relPath}:${lines.join(',')}`,
          line: first,
          message: `${spec.label} is given ${times} (${listed}); keep one`,
        },
      ],
    }
  }
  if (r.kind === 'value') {
    const o = r.occurrence
    if (valueAt(o) === '') {
      return {
        has: false,
        causes: [
          {
            kind: 'unreadable',
            element: at(o.line),
            line: o.line,
            message: `${o.label} at line ${String(o.line)} has no value this rule can read`,
          },
        ],
      }
    }
    const prose = r.disagreeing.map(
      (p): Cause => ({
        kind: 'unreadable',
        element: at(p.line),
        line: p.line,
        message: `prose says ${o.label} '${valueAt(p)}', but the field at line ${String(o.line)} says '${valueAt(o)}'`,
      }),
    )
    const allowed = spec.oneOf === undefined ? undefined : judge(spec.oneOf)
    const refused = allowed === undefined ? [] : o.values.filter((v) => !allowed.ok(v))
    const disallowed = refused.map(
      (v): Cause => ({
        kind: 'disallowed',
        element: at(o.line),
        line: o.line,
        message: `'${v}' (${o.label}, line ${String(o.line)}) ${allowed?.says ?? ''}`,
      }),
    )
    return { has: refused.length === 0, causes: [...prose, ...unread, ...disallowed] }
  }
  if (unread.length > 0) return { has: false, causes: unread }
  if (spec.region === 'header') {
    const labels = [spec.label, ...(spec.aliases ?? [])]
    const [outside] = scanFields(doc, labels, STRUCTURED, undefined, 'code-blocks')
    if (outside !== undefined) {
      return {
        has: false,
        causes: [
          {
            kind: 'unreadable',
            element: at(outside.line),
            line: outside.line,
            message: `${spec.label} at line ${String(outside.line)} is outside the header (region: 'header'); move it into the header, or drop the region`,
          },
        ],
      }
    }
  }
  const carried = labelsOf(doc)
  return {
    has: false,
    causes: [
      {
        kind: 'absent',
        element: doc.relPath,
        line: 1,
        message:
          `no ${spec.label} field (read as ${spec.forms.join(', ')})` +
          (carried.length > 0
            ? `; its labels: ${carried.join(', ')}`
            : '; it carries no wrapped label'),
      },
    ],
  }
}

/** A cause as a finding with the rule's context. */
export function causeViolation(
  doc: MdDocument,
  c: Cause,
  context: ConditionContext,
): ArchViolation {
  return mdViolation({
    element: c.element,
    file: doc.file,
    line: c.line,
    message: c.message,
    context,
  })
}

/** `haveField` after `.that()`: documents whose value exists and is allowed. */
export function haveFieldPredicate(spec: HaveFieldOptions): Predicate<MdDocument> {
  return {
    description: `have a ${spec.label} field`,
    test: (d) => fieldVerdict(d, spec).has,
  }
}

/** `haveField` after `.should()`: every selected document has the value; every cause is a finding. */
export function haveFieldCondition(spec: HaveFieldOptions): Condition<MdDocument> {
  return {
    description: `have a ${spec.label} field`,
    evaluate: (docs, context) =>
      docs.flatMap((d) => fieldVerdict(d, spec).causes.map((c) => causeViolation(d, c, context))),
  }
}
