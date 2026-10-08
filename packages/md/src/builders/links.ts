import { RuleBuilder, collectResult, type CollectResult, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinks, type MdLink, type MdLinkRef } from '../model/links.js'
import { stampedByDocument } from '../model/by-document.js'
import { linkResolves, type LinkResolveOptions } from '../conditions/resolve.js'
import {
  areInSectionPredicate,
  areLabelledPredicate,
  declarationFindings,
  type LinkDeclaration,
} from '../predicates/declared-block.js'

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
   * Filter to links a block declares under `label` (plan 0405): links owned by a
   * paragraph or list item whose first line opens with the label, in any of the
   * ledger's forms (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`), matched
   * exactly and case-sensitively. A label alone on its line owns the list that
   * follows it; a labelled list item owns its nested list.
   *
   * The rule also reports, over the whole corpus, a wrapped label that misses
   * the declared one only by case or spacing, and a wrapped declaration that
   * holds only reference-style links or none. That check runs through this
   * method only: a selection taken with `.select()` carries no findings, so it
   * carries no near-miss check either.
   */
  areLabelled(label: string): this {
    const next = this.addPredicate(areLabelledPredicate(label))
    next._declarations = [...next._declarations, { kind: 'label', label }]
    return next
  }

  /**
   * Filter to links under a heading matching `name` — a string exactly, or a
   * `RegExp` — at any depth beneath it, matched the way `haveSection()` matches
   * (plan 0405). A heading that misses a string `name` only by case or spacing
   * is reported, as for `areLabelled()`.
   */
  areInSection(name: string | RegExp): this {
    const next = this.addPredicate(areInSectionPredicate(name))
    next._declarations = [...next._declarations, { kind: 'section', name }]
    return next
  }

  /**
   * Condition: internal links resolve to an existing repo file. Static-site
   * corpora with extensionless links pass `tryExtensions`/`tryIndex`, e.g.
   * `resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })`.
   */
  resolve(options?: LinkResolveOptions): this {
    return this.addCondition(linkResolves(this.project, options))
  }

  protected override copy(): this {
    const clone = super.copy()
    clone._declarations = [...this._declarations]
    return clone
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
    return collectResult([...base, ...findings], {
      examined: base.examined,
      sourceEmpty: base.sourceEmpty,
      declaredEmpty: base.declaredEmpty,
      notRun: base.notRun,
      deadGlob: base.deadGlob,
    })
  }
}

/** Entry point: build rules over the corpus's markdown links. */
export function links(corpus: Corpus): LinkRuleBuilder {
  return new LinkRuleBuilder(corpus)
}
