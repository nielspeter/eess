import { RuleBuilder, type Predicate } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { collectLinks, type MdLink, type MdLinkRef } from '../model/links.js'
import { linkResolves, type LinkResolveOptions } from '../conditions/resolve.js'

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
  protected getElements(): MdLink[] {
    return this.project
      .documents()
      .flatMap((doc) =>
        collectLinks(doc.root, doc.text).map((link: MdLinkRef) => ({ ...link, doc })),
      )
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
   * Condition: internal links resolve to an existing repo file. Static-site
   * corpora with extensionless links pass `tryExtensions`/`tryIndex`, e.g.
   * `resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })`.
   */
  resolve(options?: LinkResolveOptions): this {
    return this.addCondition(linkResolves(this.project, options))
  }
}

/** Entry point: build rules over the corpus's markdown links. */
export function links(corpus: Corpus): LinkRuleBuilder {
  return new LinkRuleBuilder(corpus)
}
