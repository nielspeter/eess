import type { ConditionContext, Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { cleanValue, type FieldOptions } from '../model/fields.js'
import { unreadFieldMessage, unreadFields, type UnreadField } from '../model/field-unread.js'
import { mdViolation, type ArchViolation } from '../model/violation.js'
import type { MdTerm } from './vocabulary.js'

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
    // Unreachable: `matchingElements` returns the candidates themselves. A finding must not vanish.
    if (u === undefined) throw new Error('fields(): an unread-label candidate lost its record')
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
