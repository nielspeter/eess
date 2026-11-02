import type { ArchViolation, CollectResult } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import {
  findMentions,
  validateMentionPattern,
  type MdMention,
  type MdMentionLink,
  type MdMentionRef,
  type MdMentionSpan,
  type MdUnreadMention,
  type UnreadMentionRef,
} from '../model/mentions.js'
import type { MdDocument } from '../model/document.js'
import { EXTERNAL_RE } from '../model/links.js'
import type { PhrasingLink } from '../model/phrasing.js'
import { resolveLink, type LinkResolveOptions, type LinkTarget } from '../model/resolve-link.js'
import type { UnreadCause } from '../model/phrasing.js'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import { resideInFile, resideInFolder } from '../predicates/document.js'
import { liftToDocument } from '../predicates/in-documents.js'
import { beLinked, type BeLinkedOptions } from '../conditions/be-linked.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import { reachedUnread, UNKNOWN, withUnread } from './unread.js'

export type { MdMention, MdUnreadMention }

/** What a `mentions()` rule matches: the caller's pattern. No default exists (ADR-022). */
export interface MentionOptions {
  readonly pattern: RegExp
  /**
   * How a mention's `link.target` resolves (plan 0549): the options a `links().resolve()` rule takes,
   * so a corpus with extensionless links does not read every link as `missing`.
   */
  readonly resolve?: LinkResolveOptions
}

type Found = { readonly mentions: MdMentionRef[]; readonly unread: UnreadMentionRef[] }

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
 * is never an element: it is reported, unless the rule's predicates decide it out without its link.
 */
export class MentionRuleBuilder extends CorpusRuleBuilder<MdMention> {
  protected readonly noun = 'mentions'

  private readonly pattern: RegExp
  private readonly resolve: LinkResolveOptions

  /** One walk per document per builder: a document is built once and never mutated. */
  private readonly found = new WeakMap<MdDocument, Found>()

  constructor(corpus: Corpus, options: MentionOptions) {
    super(corpus)
    validateMentionPattern(options.pattern, 'mentions')
    this.pattern = options.pattern
    this.resolve = options.resolve ?? {}
  }

  /** The document's mentions, each link resolved once from the document's own path. */
  private foundIn(doc: MdDocument): Found {
    const known = this.found.get(doc)
    if (known !== undefined) return known
    const { mentions: raw, unread } = findMentions(doc.root, this.pattern, doc.text)
    const targets = new Map<PhrasingLink, LinkTarget>()
    const targetOf = (link: PhrasingLink): LinkTarget => {
      let target = targets.get(link)
      if (target === undefined) {
        const external = EXTERNAL_RE.test(link.url)
        target = resolveLink({ url: link.url, external, doc }, this.project, this.resolve)
        targets.set(link, target)
      }
      return target
    }
    const mentions = raw.map(({ link, offset, ...m }): MdMentionRef => {
      if (link === undefined) return m
      const resolved: MdMentionLink = {
        url: link.url,
        text: link.text,
        target: targetOf(link),
        ...(offset !== undefined ? { offset } : {}),
      }
      return { ...m, link: resolved }
    })
    const found = { mentions, unread }
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
    const { reached, undecided } = reachedUnread(this.unread(), this._predicates, asSeen)
    // ADR-021: a mention whose membership is undecided reports that cause too, beside it.
    return withUnread(
      base,
      unreadFindings(reached, base.examined === 0),
      undecided,
      this.buildConditionContext(),
    )
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

  /**
   * Every selected mention sits in a link. Presence only: the link's target is not judged. With
   * `fix`, a plain mention exactly one record holds carries a fix linking it there (plan 0550).
   */
  beLinked<R>(options: BeLinkedOptions<R> = {}): this {
    return this.addCondition(beLinked(options))
  }
}

/** An unread mention as a predicate sees it: everything known, and `link` and `inCode` unknowable. */
function asSeen(u: MdUnreadMention): MdMention {
  return {
    doc: u.doc,
    line: u.line,
    text: u.text,
    groups: u.groups,
    get inCode(): boolean {
      throw UNKNOWN
    },
    get link(): MdMentionLink | undefined {
      throw UNKNOWN
    },
    get span(): MdMentionSpan | undefined {
      throw UNKNOWN
    },
  }
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
