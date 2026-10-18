import type { ConditionContext, Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import {
  cleanValue,
  fieldLines,
  scanFields,
  type FieldForm,
  type FieldOptions,
} from '../model/fields.js'
import { labelBody } from '../model/label.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import type { MdTerm } from './vocabulary.js'

/** The marked-up forms a missing form could read; `plain` is never scanned (prose opens "status: …"). */
const SCANNED: readonly FieldForm[] = ['bold', 'heading', 'bold-line']

/**
 * A line naming the label with markup before its colon, in any shape: behind any indent, a
 * blockquote, a list marker or a task box, under heading hashes, in any emphasis. Wider than every
 * form, so a shape no form reads is still seen. The markup is required before the colon, so plain
 * prose ("Status: see the **note**") is not taken for a label.
 */
function looseLabel(label: string): RegExp {
  const L = labelBody(label)
  return new RegExp(
    String.raw`^(?=[^:\n]*[*_#>~])\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?(?:#{1,6}\s+)?[*_~]{0,3}\s*(${L})\s*[*_~]{0,3}\s*:(.*)$`,
    'i',
  )
}

/** A line the rule could not read, and what it could do about it. */
interface Unread {
  readonly text: string
  /** A form the rule could add to read it; `undefined` when no form reads this shape. */
  readonly form: FieldForm | undefined
}

/**
 * A label the rule's selection holds that the rule did not read is a finding, never a silent skip
 * (plan 0468). Two kinds: a line a form the rule does not name would read (add the form), and a
 * marked-up line no form reads (rewrite it). Scoped to the rule's selection: each candidate passes
 * through the rule's own predicates, by the kernel's one owner of predicate application, so a rule
 * over `bugs/**` never reds on a README's `## Status: beta`. Read in the same region as the rule.
 */
export function unnamedFormFindings(
  corpus: Corpus,
  options: FieldOptions,
  predicates: readonly Predicate<MdTerm>[],
  context: ConditionContext,
): ArchViolation[] {
  const labels = [options.label, ...(options.aliases ?? [])]
  const missing = SCANNED.filter((f) => !options.forms.includes(f))
  const loose = labels.map(looseLabel)
  const cut = options.value ?? cleanValue
  const candidates: MdTerm[] = []
  const unread = new Map<MdTerm, Unread>()
  const add = (term: MdTerm, why: Unread): void => {
    candidates.push(term)
    unread.set(term, why)
  }
  for (const doc of corpus.documents()) {
    const read = new Set(scanFields(doc, labels, options.forms, options.region).map((h) => h.line))
    const byMissing = new Map(
      scanFields(doc, labels, missing, options.region).map((h) => [h.line, h]),
    )
    const lines = fieldLines(doc, options.region)
    for (let i = 0; i < lines.length; i++) {
      const line = i + 1
      if (read.has(line)) continue
      const hit = byMissing.get(line)
      if (hit !== undefined) {
        const term = {
          value: cut(hit.raw),
          raw: hit.raw,
          doc,
          line,
          label: hit.label,
          form: hit.form,
        }
        add(term, { text: hit.text, form: hit.form })
        continue
      }
      const text = lines[i] ?? ''
      const m = loose.map((re) => re.exec(text)).find((x) => x !== null)
      if (m === undefined || m === null) continue
      const label = (m[1] ?? '').replace(/\s+/g, ' ').trim()
      const raw = m[2] ?? ''
      // The element's form is the rule's first: no form reads this shape, so none is its own.
      const term = { value: cut(raw), raw, doc, line, label, form: options.forms[0] ?? 'bold' }
      add(term, { text: text.trim(), form: undefined })
    }
  }
  return matchingElements(candidates, [...predicates]).map((t) => {
    const why = unread.get(t)
    const quoted = `found \`${why?.text ?? ''}\` at line ${String(t.line)}`
    const message =
      why?.form !== undefined
        ? `${quoted}, in a form this rule does not read (${why.form}); add '${why.form}' to forms, or rewrite the line`
        : `${quoted}, in a shape no form reads; rewrite it as \`**${t.label}:** v\`, \`## ${t.label}: v\` or \`**${t.label}: v**\``
    return mdViolation({
      element: `${t.doc.relPath}:${String(t.line)}`,
      file: t.doc.file,
      line: t.line,
      message,
      context,
    })
  })
}
