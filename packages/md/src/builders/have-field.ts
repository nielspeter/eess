import {
  ArchConfigError,
  type Condition,
  type ConditionContext,
  type Predicate,
  type Undecided,
} from '@nielspeter/eess'
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
function verdictOf(doc: MdDocument, spec: HaveFieldOptions): FieldVerdict {
  return fieldVerdict(doc, spec, spec.oneOf === undefined ? undefined : judge(spec.oneOf))
}

/** A cause as a finding with the rule's context. */
function causeViolation(doc: MdDocument, c: FieldCause, context: ConditionContext): ArchViolation {
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

/**
 * `haveField` as a predicate: documents whose value exists and is allowed (plan 0469). A document
 * whose value cannot be read, for any of the verdict's unreadable causes, is undecided (ADR-021): the
 * builder neither selects nor drops it but reports each cause, and `test` refuses it, so a wrapper
 * written around `test` cannot drop it silently. The verdict is memoized per document, so a
 * predicate lifted onto a document's boxes reads the document once (spike 0485: 450 ms against 42 ms
 * on 10,000 boxes before the memo).
 */
export function predicateHaveField(spec: HaveFieldOptions): Predicate<MdDocument> {
  const verdicts = new WeakMap<MdDocument, { has: boolean; undecided: readonly Undecided[] }>()
  const read = (d: MdDocument): { has: boolean; undecided: readonly Undecided[] } => {
    const known = verdicts.get(d)
    if (known !== undefined) return known
    const v = verdictOf(d, spec)
    // Undecided only when the value itself cannot be read. A value that resolved, allowed or not, is
    // decided even beside prose that disagrees or a label in an unread form: structured forms win
    // (plan 0469), so the verdict does not depend on those causes (ADR-021 clause 4), and the
    // condition form reports them.
    const undecided = (v.resolved ? [] : v.causes)
      .filter((c) => c.kind === 'unreadable')
      .map(
        (c): Undecided => ({ file: d.file, line: c.line, element: c.element, message: c.message }),
      )
    const fresh = { has: v.has, undecided }
    verdicts.set(d, fresh)
    return fresh
  }
  return {
    description: describe(spec),
    undecided: (d) => read(d).undecided,
    test: (d) => {
      const { has, undecided } = read(d)
      const [first] = undecided
      if (first !== undefined) {
        throw new ArchConfigError(
          first.element,
          `haveField cannot judge ${first.element}: ${first.message}. Apply it through a rule, ` +
            'which reports this, or forward its undecided() with its test() (ADR-021).',
        )
      }
      return has
    },
  }
}

/** `haveField` after `.should()`: every selected document has the value; every cause is a finding. */
export function haveFieldCondition(spec: HaveFieldOptions): Condition<MdDocument> {
  return {
    description: describe(spec),
    evaluate: (docs, context) =>
      docs.flatMap((d) => verdictOf(d, spec).causes.map((c) => causeViolation(d, c, context))),
  }
}
