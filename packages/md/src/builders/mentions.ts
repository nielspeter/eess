import {
  collectResult,
  type ArchViolation,
  type CollectResult,
  type Predicate,
  type Undecided,
} from '@nielspeter/eess'
import { membership, undecidedViolations } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { stampedByDocument } from '../model/by-document.js'
import {
  collectMentions,
  validateMentionPattern,
  type MdMention,
  type MdUnreadMention,
} from '../model/mentions.js'
import type { UnreadCause } from '../model/phrasing.js'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import { resideInFile, resideInFolder } from '../predicates/document.js'
import { liftToDocument } from '../predicates/in-documents.js'
import { beLinked } from '../conditions/be-linked.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'

export type { MdMention, MdUnreadMention }

/** What a `mentions()` rule matches: the caller's pattern. No default exists (ADR-022). */
export interface MentionOptions {
  readonly pattern: RegExp
}

/** A mention in text this rule cannot read: one finding per mention, unsuppressable. */
export const UNREAD_MENTION = 'md/unread-mention'

const WHERE: Record<UnreadCause, string> = {
  'html-block': 'a raw HTML block',
  'reference-link': "a reference-style link's text",
  'image-alt': "an image's alt text",
  'link-title': "a link's or image's title",
}

const REMEDY: Record<UnreadCause, string> = {
  'html-block':
    'Move the mention out of the HTML into Markdown, or put the HTML in a fenced code block if it is an example.',
  'reference-link': 'Write the link inline, `[text](url)`, so its target sits beside the mention.',
  'image-alt': 'Name the record in the text beside the image, as a link.',
  'link-title': "Name the record in the link's text or beside it, as a link.",
}

/**
 * Rule builder over mentions (plan 0539): every match of the caller's pattern in a document's
 * paragraphs, headings and table cells, inline code included. A match in text this rule cannot read
 * is never an element: a rule whose predicates would reach it, read as linked or as not, reports it.
 */
export class MentionRuleBuilder extends CorpusRuleBuilder<MdMention> {
  protected readonly noun = 'mentions'

  private readonly pattern: RegExp

  constructor(corpus: Corpus, options: MentionOptions) {
    super(corpus)
    validateMentionPattern(options.pattern, 'mentions')
    this.pattern = options.pattern
  }

  private scan(): { mentions: MdMention[]; unread: MdUnreadMention[] } {
    const mentions: MdMention[] = []
    const unread: MdUnreadMention[] = []
    for (const doc of this.project.documents()) {
      const found = collectMentions(doc.root, this.pattern, { source: doc.text })
      for (const m of found.mentions) mentions.push({ ...m, doc })
      for (const u of found.unread) unread.push({ ...u, doc })
    }
    return { mentions, unread }
  }

  protected getElements(): MdMention[] {
    return stampedByDocument(
      this.project,
      (doc) => collectMentions(doc.root, this.pattern, { source: doc.text }).mentions,
    )
  }

  /** The kernel's verdict, plus a finding for each unread mention this rule's predicates reach. */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const { reached, undecided } = reachedUnread(this.scan().unread, this._predicates)
    if (reached.length === 0) return base
    // ADR-021: a mention whose membership is undecided reports that cause too, beside it.
    const causes = undecidedViolations(undecided, this.buildConditionContext(), base)
    return collectResult([...base, ...causes, ...unreadFindings(reached, base.examined === 0)], {
      examined: base.examined,
      sourceEmpty: base.sourceEmpty,
      declaredEmpty: base.declaredEmpty,
      notRun: base.notRun,
      deadGlob: base.deadGlob,
      undecided: (base.undecided ?? 0) + causes.length,
    })
  }

  protected locate(m: MdMention): MdLocation {
    return atLine(m)
  }

  /** Filter to mentions in documents whose repo-relative path matches the file glob. */
  resideInFile(glob: string): this {
    const p = resideInFile(glob)
    return this.addPredicate(liftToDocument<MdMention>(p, p.description))
  }

  /** Filter to mentions in documents whose repo-relative path matches the folder glob. */
  resideInFolder(glob: string): this {
    const p = resideInFolder(glob)
    return this.addPredicate(liftToDocument<MdMention>(p, p.description))
  }

  /** Every selected mention sits in a link. Presence only: the link's target is not judged. */
  beLinked(): this {
    return this.addCondition(beLinked())
  }
}

/**
 * The unread mentions the rule could have judged: an unread mention is everything a read one is
 * except whether it is linked, so it is tried against the predicates read both ways, through the
 * kernel's one truth table (ADR-021). Undecided is reached too, and its causes returned.
 */
function reachedUnread(
  unread: readonly MdUnreadMention[],
  predicates: readonly Predicate<MdMention>[],
): { readonly reached: MdUnreadMention[]; readonly undecided: readonly Undecided[] } {
  const reached: MdUnreadMention[] = []
  const undecided: Undecided[] = []
  for (const u of unread) {
    const base = { doc: u.doc, line: u.line, text: u.text, groups: u.groups, inCode: false }
    let hit = false
    for (const read of [base, { ...base, link: { url: '' } }] satisfies MdMention[]) {
      const m = membership(predicates, 'all', read)
      if (m === false) continue
      hit = true
      if (m !== true) undecided.push(...m)
    }
    if (hit) reached.push(u)
  }
  return { reached, undecided }
}

/** One configuration finding per unread mention: `.excluding()` cannot hide it. */
function unreadFindings(
  unread: readonly MdUnreadMention[],
  examinedNothing: boolean,
): ArchViolation[] {
  const why = examinedNothing ? ' It is why this rule examined nothing.' : ''
  return unread.map((u) => ({
    rule: UNREAD_MENTION,
    ruleId: UNREAD_MENTION,
    element: `${u.doc.relPath}:${String(u.line)}`,
    file: u.doc.file,
    line: u.line,
    message:
      `"${u.text.replace(/\s+/g, ' ')}" sits in ${WHERE[u.cause]}, which this rule does not read, ` +
      `so it can be judged neither linked nor not.${why}`,
    suggestion: REMEDY[u.cause],
    bypassFilters: true,
  }))
}

/**
 * Entry point: rules over every match of `pattern` in the corpus's text (plan 0539):
 * `mentions(c, { pattern: /\b(?<kind>bug|plan)\s+(?<n>\d{3})\b/gi }).should().beLinked().check()`.
 */
export function mentions(corpus: Corpus, options: MentionOptions): MentionRuleBuilder {
  return new MentionRuleBuilder(corpus, options)
}
