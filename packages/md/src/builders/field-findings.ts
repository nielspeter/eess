import type { ConditionContext, Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { cleanValue, scanFields, type FieldForm, type FieldOptions } from '../model/fields.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import type { MdTerm } from './vocabulary.js'

/** The wrapped forms a reader can tell from prose; `plain` is never scanned (prose opens "status: …"). */
const SCANNED: readonly FieldForm[] = ['bold', 'heading', 'bold-line']

/**
 * A label written in a form the rule does not read is a finding, never a silent skip (plan 0468).
 * Scoped to the rule's selection: each candidate is passed through the rule's own predicates, by the
 * kernel's one owner of predicate application, so a rule over `bugs/**` never reds on a README's
 * `## Status: beta`. Read in the same region as the rule.
 */
export function unnamedFormFindings(
  corpus: Corpus,
  options: FieldOptions,
  predicates: readonly Predicate<MdTerm>[],
  context: ConditionContext,
): ArchViolation[] {
  const missing = SCANNED.filter((f) => !options.forms.includes(f))
  if (missing.length === 0) return []
  const labels = [options.label, ...(options.aliases ?? [])]
  const candidates: MdTerm[] = []
  const quoted = new Map<MdTerm, string>()
  for (const doc of corpus.documents()) {
    for (const hit of scanFields(doc, labels, missing, options.region)) {
      const term: MdTerm = {
        value: cleanValue(hit.raw),
        raw: hit.raw,
        doc,
        line: hit.line,
        label: hit.label,
        form: hit.form,
      }
      candidates.push(term)
      quoted.set(term, hit.text)
    }
  }
  return matchingElements(candidates, [...predicates]).map((t) =>
    mdViolation({
      element: `${t.doc.relPath}:${String(t.line)}`,
      file: t.doc.file,
      line: t.line,
      message:
        `found \`${quoted.get(t) ?? ''}\` at line ${String(t.line)}, in a form this rule does not ` +
        `read (${t.form}); add '${t.form}' to forms, or rewrite the line`,
      context,
    }),
  )
}
