import type { ConditionContext, Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
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
 * form, so a shape no form reads is still seen. Emphasis touching the label, or heading hashes, is
 * required (a bullet `*` or a quote `>` does not count), so plain prose ("Status: see the
 * **note**", "* Status: open", "> Status: …") is not taken for a label.
 */
function looseLabel(label: string): RegExp {
  const L = labelBody(label)
  return new RegExp(
    String.raw`^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?(?:#{1,6}\s+[*_~]{0,3}|[*_~]{1,3})(${L})\s*[*_~]{0,3}\s*:(.*)$`,
    'i',
  )
}

/** A label line in a document that the rule's forms did not read, and what reads it if anything. */
export interface UnreadField {
  readonly line: number
  readonly text: string
  readonly label: string
  readonly raw: string
  /** A form the rule could add to read it; `undefined` when no form reads this shape. */
  readonly form: FieldForm | undefined
}

/**
 * The label lines one document holds that the rule's forms did not read: a line a missing form
 * reads, or a marked-up line no form reads. Plain prose is never one. Read in the rule's region.
 */
export function unreadFields(doc: MdDocument, options: FieldOptions): UnreadField[] {
  const labels = [options.label, ...(options.aliases ?? [])]
  const missing = SCANNED.filter((f) => !options.forms.includes(f))
  const loose = labels.map(looseLabel)
  const read = new Set(scanFields(doc, labels, options.forms, options.region).map((h) => h.line))
  const byMissing = new Map(
    scanFields(doc, labels, missing, options.region).map((h) => [h.line, h]),
  )
  const lines = fieldLines(doc, options.region)
  const out: UnreadField[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1
    if (read.has(line)) continue
    const hit = byMissing.get(line)
    if (hit !== undefined) {
      out.push({ line, text: hit.text, label: hit.label, raw: hit.raw, form: hit.form })
      continue
    }
    const text = lines[i] ?? ''
    const m = loose.map((re) => re.exec(text)).find((x) => x !== null)
    if (m === undefined || m === null) continue
    out.push({
      line,
      text: text.trim(),
      label: (m[1] ?? '').replace(/\s+/g, ' ').trim(),
      raw: m[2] ?? '',
      form: undefined,
    })
  }
  return out
}

/** The finding's message for a label line the rule did not read. */
export function unreadFieldMessage(u: UnreadField): string {
  const quoted = `found \`${u.text}\` at line ${String(u.line)}`
  return u.form !== undefined
    ? `${quoted}, in a form this rule does not read (${u.form}); add '${u.form}' to forms, or rewrite the line`
    : `${quoted}, in a shape no form reads; rewrite it as \`**${u.label}:** v\`, \`## ${u.label}: v\` or \`**${u.label}: v**\``
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
  const cut = options.value ?? cleanValue
  const candidates: MdTerm[] = []
  const unread = new Map<MdTerm, UnreadField>()
  for (const doc of corpus.documents()) {
    for (const u of unreadFields(doc, options)) {
      // A shape no form reads takes the rule's first form as its own: none is.
      const form = u.form ?? options.forms[0] ?? 'bold'
      const term: MdTerm = {
        value: cut(u.raw),
        raw: u.raw,
        doc,
        line: u.line,
        label: u.label,
        form,
      }
      candidates.push(term)
      unread.set(term, u)
    }
  }
  return matchingElements(candidates, [...predicates]).flatMap((t) => {
    const u = unread.get(t)
    if (u === undefined) return []
    return [
      mdViolation({
        element: `${t.doc.relPath}:${String(t.line)}`,
        file: t.doc.file,
        line: t.line,
        message: unreadFieldMessage(u),
        context,
      }),
    ]
  })
}
