import type { Condition, ConditionContext, Predicate } from '@nielspeter/eess'
import type { MdDocument } from '../model/document.js'
import type { FieldOptions } from '../model/fields.js'
import { fieldVerdict, type FieldCause, type FieldVerdict } from '../model/field-verdict.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import { judge, type Allowed } from './vocabulary.js'

/** What `haveField` asks of a document (plan 0469). */
export interface HaveFieldOptions extends FieldOptions {
  /** The allowed values, after the caller's `value`: what `resolveAgainst` takes. */
  readonly oneOf?: Allowed
}

/** The verdict for one document under a `haveField` spec, its `oneOf` judged as `resolveAgainst` does. */
export function verdictOf(doc: MdDocument, spec: HaveFieldOptions): FieldVerdict {
  return fieldVerdict(doc, spec, spec.oneOf === undefined ? undefined : judge(spec.oneOf))
}

/** A cause as a finding with the rule's context. */
export function causeViolation(
  doc: MdDocument,
  c: FieldCause,
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

const describe = (spec: HaveFieldOptions): string =>
  `have a ${spec.label} field` +
  (spec.oneOf === undefined
    ? ''
    : spec.oneOf instanceof RegExp
      ? ` matching ${String(spec.oneOf)}`
      : ' in the vocabulary')

/** `haveField` after `.that()`: documents whose value exists and is allowed. */
export function haveFieldPredicate(spec: HaveFieldOptions): Predicate<MdDocument> {
  return { description: describe(spec), test: (d) => verdictOf(d, spec).has }
}

/** `haveField` after `.should()`: every selected document has the value; every cause is a finding. */
export function haveFieldCondition(spec: HaveFieldOptions): Condition<MdDocument> {
  return {
    description: describe(spec),
    evaluate: (docs, context) =>
      docs.flatMap((d) => verdictOf(d, spec).causes.map((c) => causeViolation(d, c, context))),
  }
}
