import { ArchConfigError, type Undecided } from '@nielspeter/eess'
import type { MdDocument } from './document.js'
import { resolveField } from './field-resolve.js'
import { unreadFieldMessage, unreadFields } from './field-unread.js'
import {
  checkRegion,
  readFields,
  regionSection,
  regionSections,
  scanFields,
  STRUCTURED_FORMS,
  type FieldForm,
  type FieldOccurrence,
  type FieldOptions,
} from './fields.js'
import { headingNotes } from './sections.js'
import { wrappedLabelOf } from './label.js'
import { codeShapeAt, proseText } from './prose.js'

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
  /** The headings the message names as the cause (plan 0496's section-name scan skips them). */
  readonly cites?: readonly number[]
}

/** A document's verdict: does it have the value, and what is said about it. */
export interface FieldVerdict {
  readonly has: boolean
  /** The value resolved (allowed or not): the reading is decided, whatever else is said (ADR-021). */
  readonly resolved: boolean
  /** The occurrence the value resolved to, set exactly when `resolved` (plan 0495). */
  readonly occurrence?: FieldOccurrence
  readonly causes: readonly FieldCause[]
}

/**
 * A verdict's three-way outcome (plan 0624), the one rule the predicate decides by and the public
 * reader returns: resolved → `value`; otherwise any unreadable cause → `unreadable`; otherwise
 * `absent`. A section region whose section the document lacks is `absent`, a decided "no" (plan
 * 0505). A `value` carries, as `notes`, the unreadable causes its verdict does not depend on (prose
 * that disagrees, a label in a form not read: ADR-021 clause 4); a `disallowed` cause is a judgement of
 * `oneOf`, not a note.
 */
type FieldOutcome =
  | {
      readonly kind: 'value'
      readonly occurrence: FieldOccurrence
      readonly notes: readonly FieldCause[]
    }
  | { readonly kind: 'absent'; readonly cause: FieldCause }
  | { readonly kind: 'unreadable'; readonly causes: readonly FieldCause[] }

/** The outcome of a verdict: see {@link FieldOutcome}. */
export function fieldOutcome(v: FieldVerdict): FieldOutcome {
  const unreadable = v.causes.filter((c) => c.kind === 'unreadable')
  if (v.resolved && v.occurrence !== undefined)
    return { kind: 'value', occurrence: v.occurrence, notes: unreadable }
  if (unreadable.length > 0) return { kind: 'unreadable', causes: unreadable }
  const cause = v.causes.find((c) => c.kind === 'absent')
  // `fieldVerdict` gives every unresolved document one cause (ADR-009 rule 2); an absent reading with
  // no message would be a verdict without evidence, so its absence is a defect, not an answer.
  if (cause === undefined)
    throw new Error(
      `fieldVerdict gave ${v.resolved ? 'a resolved' : 'an'} unread document no cause`,
    )
  return { kind: 'absent', cause }
}

/**
 * One document's labelled value as `haveField` decides it (plan 0624). The causes replace the value
 * (ADR-021): only the `value` arm carries one, so a reader cannot take a value from a document whose
 * value cannot be read.
 */
export type FieldReading =
  | {
      readonly kind: 'value'
      /** The split values of the one occurrence `haveField` resolves. */
      readonly values: readonly string[]
      readonly line: number
      /** The label as written: the label, or the alias that matched. */
      readonly label: string
      readonly form: FieldForm
      /**
       * Findings beside a decided value: prose that disagrees, a label in a form not read. The value
       * does not depend on them (ADR-021 clause 4), so do not forward them as a predicate's
       * `undecided()`: that would make a decided document undecided.
       */
      readonly notes: readonly Undecided[]
    }
  | {
      readonly kind: 'absent'
      /**
       * `haveField`'s message: the labels the document does carry, or the section it lacks. No line:
       * the whole document is the cause.
       */
      readonly message: string
    }
  | { readonly kind: 'unreadable'; readonly causes: readonly Undecided[] }

const CALL = 'resolveFieldValue'

/** The options `resolveFieldValue` takes: a field's, without `haveField`'s `oneOf`. */
export type FieldReadingOptions = FieldOptions & { readonly oneOf?: never }

/**
 * A reader returning `absent` for every record looks like an answer, so a misconfiguration throws:
 * an empty label or alias, no forms, a malformed region, or a `oneOf` this reader does not judge.
 */
function checkReaderOptions(options: FieldReadingOptions): void {
  for (const label of [options.label, ...(options.aliases ?? [])])
    if (label.trim() === '')
      throw new ArchConfigError(CALL, `${CALL}: a label or alias is empty; name the field's label`)
  if (options.forms.length === 0)
    throw new ArchConfigError(
      CALL,
      `${CALL}: forms is empty; name the forms the label is written in`,
    )
  // A plain-JavaScript caller, or a spec typed loosely, can still carry one; `undefined` is no oneOf.
  const loose: { readonly oneOf?: unknown } = options
  if (loose.oneOf !== undefined)
    throw new ArchConfigError(
      CALL,
      `${CALL}: oneOf is not read here; this reader returns the value as haveField reads it, before ` +
        'any oneOf. Drop oneOf from the options (`const { oneOf: _, ...spec } = options`), and ' +
        'judge the value with haveField({ oneOf }) or yourself',
    )
  checkRegion(options.region, CALL)
}

/**
 * Read one document's field as `haveField` decides it (plan 0624): the value, absent with
 * `haveField`'s message, or the causes it cannot be read. Not a rule: a waiver comment does not
 * apply, and nothing is reported.
 */
export function resolveFieldValue(doc: MdDocument, options: FieldReadingOptions): FieldReading {
  checkReaderOptions(options)
  const toUndecided = (c: FieldCause): Undecided => ({
    file: doc.file,
    line: c.line,
    element: c.element,
    message: c.message,
  })
  const o = fieldOutcome(fieldVerdict(doc, options))
  switch (o.kind) {
    case 'value':
      return {
        kind: 'value',
        values: o.occurrence.values,
        line: o.occurrence.line,
        label: o.occurrence.label,
        form: o.occurrence.form,
        notes: o.notes.map(toUndecided),
      }
    case 'absent':
      return { kind: 'absent', message: o.cause.message }
    case 'unreadable':
      return { kind: 'unreadable', causes: o.causes.map(toUndecided) }
  }
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
  const one = (cause: FieldCause): FieldVerdict => ({
    has: false,
    resolved: false,
    causes: [cause],
  })
  // Plan 0505: a section region with no section of its name is its own cause, never "no field".
  const section = regionSection(spec.region)
  if (section !== undefined && regionSections(doc, section).length === 0) {
    const at = section.depth === undefined ? '' : ` at depth ${String(section.depth)}`
    const notes = headingNotes(doc, section.section, { depth: section.depth })
    return one({
      kind: 'absent',
      element: doc.relPath,
      line: 1,
      message:
        `no section "${String(section.section)}"${at} to read ${spec.label} from (region)` +
        notes.map((n) => `; ${n.note}`).join(''),
      cites: notes.map((n) => n.line),
    })
  }
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
    return {
      has: refused.length === 0,
      resolved: true,
      occurrence: o,
      causes: [...prose, ...unread, ...disallowed],
    }
  }
  if (unread.length > 0) return { has: false, resolved: false, causes: unread }
  // Read past code that is not certainly an example (a fence that never closes, an indented block),
  // the label is there, in a form the rule reads or not: say so, naming the code, rather than "no
  // field".
  const [inCode] = [
    ...readFields(doc, spec, 'closed-fences').map((o) => o.line),
    ...unreadFields(doc, spec, 'closed-fences').map((u) => u.line),
  ].sort((a, b) => a - b)
  if (inCode !== undefined) {
    const shape = codeShapeAt(doc.text, doc.root, inCode)
    const where =
      shape === 'indented'
        ? 'sits in an indented code block (four spaces or a tab); unindent it'
        : 'follows a code fence that never closes; close the fence'
    return one({
      kind: 'unreadable',
      element: at(inCode),
      line: inCode,
      message: `${spec.label} at line ${String(inCode)} ${where}`,
    })
  }
  const labels = [spec.label, ...(spec.aliases ?? [])]
  if (section !== undefined) {
    const [outside] = scanFields(doc, labels, STRUCTURED_FORMS, undefined, 'code-blocks')
    if (outside !== undefined) {
      return one({
        kind: 'unreadable',
        element: at(outside.line),
        line: outside.line,
        message: `${spec.label} at line ${String(outside.line)} is outside the "${String(section.section)}" section (region); move it into the section, or change the region`,
      })
    }
  }
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
