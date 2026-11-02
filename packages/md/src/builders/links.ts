import type { CollectResult, ElementInfo, Predicate, Selection } from '@nielspeter/eess'
import { refuseUndecided } from '@nielspeter/eess/internal'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import type { Corpus } from '../corpus.js'
import {
  linksOf,
  unreadLinksOf,
  type MdLink,
  type MdLinkDefinition,
  type MdLinkRef,
  type MdUnreadLinkRef,
  type UnreadLinkCause,
} from '../model/links.js'
import type { MdDocument } from '../model/document.js'
import { reachedUnread, UNKNOWN, unreadFinding, withUnread } from './unread.js'
import { stampedByDocument } from '../model/by-document.js'
import { linkResolves, type LinkResolveOptions } from '../conditions/resolve.js'
import { linkedBack } from '../conditions/linked-back.js'
import { haveLiveTargetsPredicate } from '../predicates/live-target.js'
import { areInSectionPredicate, areLabelledPredicate } from '../predicates/declared-block.js'
import {
  declarationFindings,
  declarationKey,
  type LinkDeclaration,
} from './declaration-findings.js'
import type { ArchViolation } from '../model/violation.js'

export type { LinkResolveOptions } from '../conditions/resolve.js'

/** A link element: a link occurrence plus its containing document. */
export type { MdLink } from '../model/links.js'

/** An HTML link this rule cannot read: one finding per site per rule, unsuppressable (plan 0580, R4). */
export const UNREAD_LINK = 'md/unread-link'

/** An unread HTML link with its document. */
interface MdUnreadLink extends MdUnreadLinkRef {
  readonly doc: MdDocument
}

const WHERE: Record<UnreadLinkCause, (u: MdUnreadLink) => string> = {
  'split-tag': () => 'its HTML tag is cut by a blank line, which ends the HTML block',
  unterminated: () => 'its HTML tag never closes inside its HTML block',
  'unquoted-slash': (u) =>
    `the Markdown parser reads its tag as text, because ${names(u)} unquoted ${values(u)} a "/"`,
  'refused-tag': () => 'the Markdown parser reads its tag as text',
}

// Each remedy clears its finding (plan 0580, R3): measured by a row per cause.
const REMEDY: Record<UnreadLinkCause, (u: MdUnreadLink) => string> = {
  'split-tag': () => 'Keep the tag inside one HTML block: remove the blank lines inside it.',
  unterminated: () => 'Close the tag inside the same HTML block: its quote, or its ">".',
  'unquoted-slash': (u) =>
    `Quote ${names(u)} ${plural(u) ? 'values' : 'value'}: write each in double quotes.`,
  'refused-tag': () => 'Write the link in Markdown, `[text](url)`.',
}

const plural = (u: MdUnreadLink): boolean => (u.attributes?.length ?? 1) > 1
const values = (u: MdUnreadLink): string => (plural(u) ? 'values hold' : 'value holds')

/** "`href`'s", or "`href`'s and `title`'s". */
const names = (u: MdUnreadLink): string =>
  (u.attributes ?? ['href']).map((a) => `\`${a}\`'s`).join(' and ')

/** An unread link as a predicate sees it: where it sits is known; its URL, text and target are not. */
function asSeen(u: MdUnreadLink): MdLink {
  const unknown = (): never => {
    throw UNKNOWN
  }
  return {
    doc: u.doc,
    line: u.line,
    ...(u.block !== undefined ? { block: u.block } : {}),
    ...(u.blockPath !== undefined ? { blockPath: u.blockPath } : {}),
    ...(u.sectionPath !== undefined ? { sectionPath: u.sectionPath } : {}),
    get url(): string {
      return unknown()
    },
    get text(): string {
      return unknown()
    },
    get external(): boolean {
      return unknown()
    },
    get urlStart(): number | undefined {
      return unknown()
    },
    get urlEnd(): number | undefined {
      return unknown()
    },
    get definition(): MdLinkDefinition | undefined {
      return unknown()
    },
  }
}

/** One finding per unread link: `.excluding()` cannot hide it. */
function unreadLinkFindings(
  unread: readonly MdUnreadLink[],
  examinedNothing: boolean,
): ArchViolation[] {
  const why = examinedNothing ? ' It is why this rule examined nothing.' : ''
  return unread.map((u) =>
    unreadFinding({
      ruleId: UNREAD_LINK,
      element: `${u.doc.relPath}:${String(u.line)}`,
      file: u.doc.file,
      line: u.line,
      message: `an HTML link here cannot be read: ${WHERE[u.cause](u)}, so its target is not checked.${why}`,
      suggestion: REMEDY[u.cause](u),
    }),
  )
}

const areInternal = (): Predicate<MdLink> => ({
  description: 'are internal',
  test: (l) => !l.external,
})
const areExternal = (): Predicate<MdLink> => ({
  description: 'are external',
  test: (l) => l.external,
})

/**
 * Rule builder over the corpus's markdown links.
 */
export class LinkRuleBuilder extends CorpusRuleBuilder<MdLink> {
  protected readonly noun = 'links'
  protected override readonly sectionMissReason = 'the links under it are not checked'

  /** What `areLabelled()` declared, for the near-miss scan (plan 0405). */
  private _declarations: readonly LinkDeclaration[] = []

  protected getElements(): MdLink[] {
    return stampedByDocument<MdLinkRef>(this.project, linksOf)
  }

  /** The unread HTML links this rule's predicates reach (ADR-021 rule 4), and their causes. */
  private reachedUnread(): ReturnType<typeof reachedUnread<MdLink, MdUnreadLink>> {
    const unread = this.project
      .documents()
      .flatMap((doc) => unreadLinksOf(doc).map((u): MdUnreadLink => ({ ...u, doc })))
    return reachedUnread(unread, this._predicates, asSeen)
  }

  /** The kernel's verdict, plus a finding for each unread HTML link this rule's predicates reach (R4). */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const { reached, undecided } = this.reachedUnread()
    return withUnread(
      base,
      unreadLinkFindings(reached, base.examined === 0),
      undecided,
      this.buildConditionContext(),
    )
  }

  /**
   * The selected links, for `correspondence()`. Refuses when the rule's predicates reach an HTML link
   * it cannot read (plan 0580, R7): a selection hands back no findings, so it would drop that link
   * without a word (ADR-021 rule 6).
   */
  override select(opts: {
    label: string
    identify: (element: MdLink) => ElementInfo
  }): Selection<MdLink> {
    const { reached } = this.reachedUnread()
    refuseUndecided(
      reached.map((u) => ({
        file: u.doc.file,
        line: u.line,
        element: `${u.doc.relPath}:${String(u.line)}`,
        message: `an HTML link here cannot be read: ${WHERE[u.cause](u)}`,
      })),
      'select()',
    )
    return super.select(opts)
  }
  protected locate(e: MdLink): MdLocation {
    return atLine(e)
  }

  /** Filter to links that point within the repo (no scheme). */
  areInternal(): this {
    return this.addPredicate(areInternal())
  }

  /** Filter to links with an external scheme (http, mailto, protocol-relative). */
  areExternal(): this {
    return this.addPredicate(areExternal())
  }

  /**
   * Filter to links declared under `label` (plan 0405), in any of the ledger's
   * forms (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`), matched exactly
   * and case-sensitively. A link is under the label when it sits in the block the
   * label opens, in that block's nested lists, or — for a label alone on its line
   * — in the lists directly after it. The nearest label decides: walking out from
   * the link, the first block that is the label, or opens with a wrapped label of
   * its own, settles it; a plain line that is not the label settles nothing.
   *
   * The rule also reports, over the whole corpus, what it cannot read: a wrapped
   * label that misses the declared one only by case or spacing, a different
   * wrapped label inside the declaration, the label where no block starts, and a
   * wrapped declaration with nothing under it. That check
   * runs through this method only: a selection taken with `.select()` carries no
   * findings, so it carries no such check either.
   */
  areLabelled(label: string): this {
    return this.addPredicate(areLabelledPredicate(label)).recordDeclaration({
      kind: 'label',
      label,
    })
  }

  /**
   * Filter to links under a heading matching `name` — a string exactly, or a
   * `RegExp` — at any depth beneath it, matched the way `haveSection()` matches
   * (plan 0405). A heading that misses a string `name` only by case or spacing
   * is reported, as for `areLabelled()`; the scan is the one every corpus
   * builder shares (plan 0496).
   */
  areInSection(name: string | RegExp): this {
    return this.addPredicate(areInSectionPredicate<MdLink>(name))
  }

  /**
   * Record a declaration once; declaring the same label twice scans it once.
   * Called on the copy `addPredicate()` returns, and it replaces the array rather
   * than pushing into it, so a fork never shares its parent's declarations — the
   * kernel's shallow `copy()` is enough.
   */
  private recordDeclaration(d: LinkDeclaration): this {
    const key = declarationKey(d)
    if (!this._declarations.some((x) => declarationKey(x) === key)) {
      this._declarations = [...this._declarations, d]
    }
    return this
  }

  /**
   * Condition: internal links resolve to an existing repo file. Static-site
   * corpora with extensionless links pass `tryExtensions`/`tryIndex`, e.g.
   * `resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })`.
   */
  resolve(options?: LinkResolveOptions): this {
    return this.addCondition(linkResolves(this.project, options))
  }

  /**
   * Filter to links whose target is not a frozen document (plan 0406) — a frozen
   * record is history and cannot be edited to answer. Pass the options you pass
   * `beLinkedBack()`, so the two resolve a link the same way. Every other target
   * is kept, and examined.
   */
  haveLiveTargets(options?: LinkResolveOptions): this {
    return this.addPredicate(haveLiveTargetsPredicate(this.project, options))
  }

  /**
   * Condition: each link's target links back to the link's document (plan 0406).
   * Any link back answers; several are one answer, and an incidental mention
   * counts. A target that cannot answer — frozen, outside the corpus, missing, a
   * directory, the record itself, an external URL — is one finding naming its
   * cause, with its remedy as the suggestion. Takes the options `resolve()`
   * takes, so a corpus with extensionless links resolves both ends the same way.
   */
  beLinkedBack(options?: LinkResolveOptions): this {
    return this.addCondition(linkedBack(this.project, options))
  }

  /** The section-name scan, plus findings about the labels it declared (plan 0405). */
  protected override declarationFindings(base: readonly ArchViolation[]): ArchViolation[] {
    const sections = super.declarationFindings(base)
    if (this._declarations.length === 0) return sections
    return [
      ...sections,
      ...declarationFindings(this.project, this._declarations, this.buildConditionContext()),
    ]
  }
}

/**
 * Entry point: build rules over the corpus's links: Markdown inline and reference-style links, and an
 * `href` on an `<a>` or `<area>` in raw HTML (plan 0580). An HTML link that cannot be read is reported
 * as `md/unread-link`, unsuppressable, wherever the rule's predicates reach it.
 */
export function links(corpus: Corpus): LinkRuleBuilder {
  return new LinkRuleBuilder(corpus)
}
