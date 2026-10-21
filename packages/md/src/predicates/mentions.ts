import type { Predicate } from '@nielspeter/eess'
import type { MdMention } from '../model/mentions.js'
import type { MdDocument } from '../model/document.js'

/** The two keys a self-mention compares, both the caller's (ADR-022). */
export interface SelfMentionKeys {
  /** The key a mention names, or `undefined` when it names none. */
  readonly mention: (m: MdMention) => string | undefined
  /** The key a document is, or `undefined` when it is not a record. */
  readonly document: (d: MdDocument) => string | undefined
}

/**
 * Plan 0539: mentions of the document they sit in, such as a record's own number in its title. True
 * when both keys are defined and equal. A predicate, so a rule drops them with `not()`:
 * `.that().satisfy(not(areSelfMentions(keys)))`. Normalise letter case in the keys: a pattern read
 * with `i` captures `ADR` and `adr` alike.
 */
export function areSelfMentions(keys: SelfMentionKeys): Predicate<MdMention> {
  return {
    description: 'are mentions of their own document',
    test: (m) => {
      const named = keys.mention(m)
      const own = keys.document(m.doc)
      return named !== undefined && own !== undefined && named === own
    },
  }
}
