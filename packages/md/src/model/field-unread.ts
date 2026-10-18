import type { MdDocument } from './document.js'
import {
  fieldLines,
  scanFields,
  STRUCTURED_FORMS,
  type FieldForm,
  type FieldOptions,
} from './fields.js'
import { labelBody } from './label.js'
import type { SetAside } from './prose.js'

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
export function unreadFields(
  doc: MdDocument,
  options: FieldOptions,
  setAside: SetAside = 'closed-fences',
): UnreadField[] {
  const labels = [options.label, ...(options.aliases ?? [])]
  const missing = STRUCTURED_FORMS.filter((f) => !options.forms.includes(f))
  const loose = labels.map(looseLabel)
  const read = new Set(
    scanFields(doc, labels, options.forms, options.region, setAside).map((h) => h.line),
  )
  const byMissing = new Map(
    scanFields(doc, labels, missing, options.region, setAside).map((h) => [h.line, h]),
  )
  const lines = fieldLines(doc, options.region, setAside)
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
