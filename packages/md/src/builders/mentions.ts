import {
  collectResult,
  type ArchViolation,
  type CollectResult,
  type Predicate,
  type Undecided,
} from '@nielspeter/eess'
import { undecidedViolations, type Membership } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import {
  collectMentions,
  validateMentionPattern,
  type MdMention,
  type MdUnreadMention,
} from '../model/mentions.js'
import type { MdDocument } from '../model/document.js'
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
  'html-link': 'a link written in HTML',
  'reference-link': "a reference-style link's text",
  'definition-title': "a link definition's title",
  'image-alt': "an image's alt text",
  'image-title': "an image's title",
}

// Each remedy clears its finding: it says where the text must go, not only what to add.
const REMEDY: Record<UnreadCause, string> = {
  'html-block':
    'Move the text out of the HTML block into Markdown, or put the HTML in a fenced code block if it is an example.',
  'html-link': 'Write the link in Markdown, `[text](url)`, instead of an HTML `<a>`.',
  'reference-link':
    "Write the link inline, `[text](url)`: a reference-style link's target is a definition elsewhere, which this rule does not read.",
  'definition-title': "Take the text out of the definition's title.",
  'image-alt':
    'Take the text out of the alt text; if it names something, name it beside the image, as a link.',
  'image-title':
    "Take the text out of the image's title; if it names something, name it beside the image, as a link.",
}

/**
 * Rule builder over mentions (plan 0539): every match of the caller's pattern in a document's
 * paragraphs, headings and table cells, inline code included. A match in text this rule cannot read
 * is never an element: it is reported, unless the rule's document scope leaves its document out.
 */
export class MentionRuleBuilder extends CorpusRuleBuilder<MdMention> {
  protected readonly noun = 'mentions'

  private readonly pattern: RegExp

  /** One walk per document per builder: a document is built once and never mutated. */
  private readonly found = new WeakMap<MdDocument, ReturnType<typeof collectMentions>>()

  constructor(corpus: Corpus, options: MentionOptions) {
    super(corpus)
    validateMentionPattern(options.pattern, 'mentions')
    this.pattern = options.pattern
  }

  private foundIn(doc: MdDocument): ReturnType<typeof collectMentions> {
    const known = this.found.get(doc)
    if (known !== undefined) return known
    const found = collectMentions(doc.root, this.pattern)
    this.found.set(doc, found)
    return found
  }

  protected getElements(): MdMention[] {
    return this.project
      .documents()
      .flatMap((doc) => this.foundIn(doc).mentions.map((m) => ({ ...m, doc })))
  }

  private unread(): MdUnreadMention[] {
    return this.project
      .documents()
      .flatMap((doc) => this.foundIn(doc).unread.map((u) => ({ ...u, doc })))
  }

  /** The kernel's verdict, plus a finding for each unread mention this rule's predicates reach. */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const { reached, undecided } = reachedUnread(this.unread(), this._predicates)
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

/** A predicate that decides by document alone: `resideInFile()`, `inDocuments(…)` and the like. */
function decidesByDocument<T>(
  p: Predicate<T>,
): p is Predicate<T> & { readonly docMembership: (d: MdDocument) => Membership } {
  return 'docMembership' in p && typeof p.docMembership === 'function'
}

/**
 * The unread mentions the rule must report. An unread mention's link, its target and whether it is in
 * code are unknown, so only a predicate that decides by its document can leave it out; any other
 * predicate (a `satisfy()`, a `not()`, a test of the link) cannot judge it, and it is reported rather
 * than dropped (ADR-021). A document scope that is undecided reaches it too, and its causes are
 * returned.
 */
function reachedUnread(
  unread: readonly MdUnreadMention[],
  predicates: readonly Predicate<MdMention>[],
): { readonly reached: MdUnreadMention[]; readonly undecided: readonly Undecided[] } {
  const scopes = predicates.filter((p) => decidesByDocument(p))
  const reached: MdUnreadMention[] = []
  const undecided: Undecided[] = []
  for (const u of unread) {
    let left = false
    for (const scope of scopes) {
      if (!decidesByDocument(scope)) continue
      const m = scope.docMembership(u.doc)
      if (m === false) left = true
      else if (m !== true) undecided.push(...m)
    }
    if (!left) reached.push(u)
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
