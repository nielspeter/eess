import { RuleBuilder, collectResult, type CollectResult, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinks, type MdLink, type MdLinkRef } from '../model/links.js'
import { stampedByDocument } from '../model/by-document.js'
import { linkResolves, type LinkResolveOptions } from '../conditions/resolve.js'
import { areInSectionPredicate, areLabelledPredicate } from '../predicates/declared-block.js'
import {
  declarationFindings,
  declarationKey,
  type LinkDeclaration,
} from './declaration-findings.js'

export type { LinkResolveOptions } from '../conditions/resolve.js'

/** A link element: a link occurrence plus its containing document. */
export type { MdLink } from '../model/links.js'

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
export class LinkRuleBuilder extends RuleBuilder<MdLink, Corpus> {
  /** What `areLabelled()`/`areInSection()` declared, for the near-miss scan (plan 0405). */
  private _declarations: readonly LinkDeclaration[] = []

  protected getElements(): MdLink[] {
    return stampedByDocument<MdLinkRef>(this.project, (doc) => collectLinks(doc.root, doc.text))
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
   * wrapped label inside the declaration, the label where no block starts, a
   * declaration holding reference-style links, and a wrapped declaration with
   * nothing under it. That check
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
   * is reported, as for `areLabelled()`.
   */
  areInSection(name: string | RegExp): this {
    return this.addPredicate(areInSectionPredicate(name)).recordDeclaration({
      kind: 'section',
      name,
    })
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
   * The base result, plus findings about the declarations themselves (plan
   * 0405). The base evidence passes through unchanged: the declarations' scan
   * examines nothing the rule asserts over, so it must not raise `examined`
   * (which would hide the zero-examined finding when every declaration is
   * misspelt) and must not go through `mergeCollectResults`, whose dead-member
   * rule would read an empty findings part as a dead rule on every clean run.
   */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    if (this._declarations.length === 0) return base
    const findings = declarationFindings(
      this.project,
      this._declarations,
      this.buildConditionContext(),
    )
    if (findings.length === 0) return base
    return collectResult([...base, ...findings], base)
  }
}

/** Entry point: build rules over the corpus's markdown links. */
export function links(corpus: Corpus): LinkRuleBuilder {
  return new LinkRuleBuilder(corpus)
}
