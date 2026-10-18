import type { ConditionContext, Predicate, Undecided } from '@nielspeter/eess'
import { membership, undecidedViolations } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { cleanValue, type FieldOptions } from '../model/fields.js'
import { unreadFieldMessage, unreadFields } from '../model/field-unread.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import type { MdTerm } from './vocabulary.js'

/**
 * A label the rule's selection holds that the rule did not read is a finding, never a silent skip
 * (plan 0468). Two kinds: a line a form the rule does not name would read (add the form), and a
 * marked-up line no form reads (rewrite it). Scoped to the rule's selection: each candidate passes
 * through the rule's own predicates, by the kernel's one truth table (ADR-021), so a rule
 * over `bugs/**` never reds on a README's `## Status: beta`. Read in the same region as the rule.
 */
export function unnamedFormFindings(
  corpus: Corpus,
  options: FieldOptions,
  predicates: readonly Predicate<MdTerm>[],
  context: ConditionContext,
  already: readonly ArchViolation[] = [],
): ArchViolation[] {
  const cut = options.value ?? cleanValue
  const found: ArchViolation[] = []
  const causes: Undecided[] = []
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
      // ADR-021: a candidate the rule's predicates cannot decide is reached (fail-closed), and the
      // causes are reported beside it, once, rather than the candidate being dropped.
      const m = membership(predicates, 'all', term)
      if (m === false) continue
      if (m !== true) causes.push(...m)
      found.push(
        mdViolation({
          element: `${doc.relPath}:${String(u.line)}`,
          file: doc.file,
          line: u.line,
          message: unreadFieldMessage(u),
          context,
        }),
      )
    }
  }
  return [...undecidedViolations(causes, context, already), ...found]
}
