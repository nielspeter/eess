import type { Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdLink } from '../model/links.js'
import { resolveLink, type LinkResolveOptions } from '../model/resolve-link.js'

/**
 * Links whose target is not a frozen corpus document (plan 0406), resolved with
 * `resolveLink` and `options` — pass `beLinkedBack()` the same options, so both
 * resolve a link the same way. Every other case is kept: a missing or external
 * target is still examined, and still reported.
 */
export function haveLiveTargetsPredicate(
  corpus: Corpus,
  options: LinkResolveOptions = {},
): Predicate<MdLink> {
  return {
    description: 'have live targets (not in a frozen folder)',
    test: (link) => {
      const target = resolveLink(link, corpus, options)
      return !(target.kind === 'document' && target.doc.frozen)
    },
  }
}
