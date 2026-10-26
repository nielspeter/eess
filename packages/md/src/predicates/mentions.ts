import type { Predicate } from '@nielspeter/eess'
import type { MdMention } from '../model/mentions.js'
import type { MdDocument } from '../model/document.js'
import { titleOf } from '../model/sections.js'

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

/**
 * Plan 0549: mentions that sit in a link, as `beLinked()` reads one. A predicate, so a rule over a
 * link's target selects the linked mentions: `.that().satisfy(areLinked())`. An unread mention's link
 * is unknown, so a rule whose predicates read it reports that mention (ADR-021).
 */
export function areLinked(): Predicate<MdMention> {
  return { description: 'are in a link', test: (m) => m.link !== undefined }
}

/** What `areInTitleLinks` strips before it compares (plan 0549). Both `RegExp`s are the caller's (ADR-022). */
export interface TitleLinkOptions {
  /** Stripped once from the start of the link's text before it is compared, such as `/^\d{4} — /`. */
  readonly linkPrefix?: RegExp
  /** Stripped once from the start of the target's title before it is compared, such as `/^Bug \d{4}: /`. */
  readonly titlePrefix?: RegExp
}

/** A private copy with the caller's `g` and `y` dropped: no `lastIndex` is shared. */
const copyOf = (re: RegExp): RegExp => new RegExp(re.source, re.flags.replace(/[gy]/g, ''))

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()
const lowerAscii = (s: string): string => s.replace(/[A-Z]/g, (ch) => ch.toLowerCase())

/** The length of `prefix`'s match at the start of `text`, or 0 when it matches elsewhere or not at all. */
function prefixLength(text: string, prefix: RegExp | undefined): number {
  if (prefix === undefined) return 0
  const m = prefix.exec(text)
  return m !== null && m.index === 0 ? m[0].length : 0
}

/**
 * Whether the link's text says more than the mention: a letter or a digit outside it. Inline code's
 * backticks and punctuation are not more, so `[bug 0001.](…)` is a mention that is the whole text.
 */
function saysMore(mention: string, text: string): boolean {
  const rest = collapse(text.replace(/`/g, '')).replace(collapse(mention), '')
  return /[\p{L}\p{N}]/u.test(rest)
}

/**
 * Plan 0549: mentions in a link whose text is its target's title, such as a board row
 * `[0448 — a Bun load guard, and bug 0439's fix](./0448-….md)`, which quotes another record because the
 * title does. True only when all four hold:
 *
 * 1. the link resolves to a corpus document (`link.target.kind === 'document'`), never to itself;
 * 2. the link's text says more than the mention: a letter or digit outside it;
 * 3. the link's text less `linkPrefix` equals the target's title less `titlePrefix` (as `haveTitle()`
 *    reads it), whitespace collapsed and ASCII letter case ignored;
 * 4. the mention starts in the link's text (`link.offset`), and not in the stripped prefix.
 *
 * Equality, not containment: a text that only had to occur in the title could be the mention and the
 * title's next word, a stamp. Equality also puts the mention's own text at its place in the title. A
 * predicate, so a rule over a link's target drops these with `not()`.
 */
export function areInTitleLinks(options: TitleLinkOptions = {}): Predicate<MdMention> {
  const linkPrefix = options.linkPrefix && copyOf(options.linkPrefix)
  const titlePrefix = options.titlePrefix && copyOf(options.titlePrefix)
  return {
    description: "are in links whose text is their target's title",
    test: (m) => {
      const link = m.link
      if (link === undefined || link.target.kind !== 'document') return false
      if (!saysMore(m.text, link.text)) return false
      const title = titleOf(link.target.doc)
      if (link.offset === undefined || title === undefined) return false
      const cut = prefixLength(link.text, linkPrefix)
      if (link.offset < cut) return false
      const compared = collapse(link.text.slice(cut))
      const titled = collapse(title.slice(prefixLength(title, titlePrefix)))
      return lowerAscii(compared) === lowerAscii(titled)
    },
  }
}
