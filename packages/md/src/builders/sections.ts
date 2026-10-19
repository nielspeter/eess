import type { Corpus } from '../corpus.js'
import { atLine, type MdLocation } from '../conditions/not-exist.js'
import {
  haveSubsection as haveSubsectionCondition,
  sectionHaveTable,
  sectionHolds,
  type SectionTableOptions,
} from '../conditions/section.js'
import type { SectionHolding } from '../model/section-holds.js'
import { sectionsOf, type MdSectionElement } from '../model/sections.js'
import { areInSectionPredicate } from '../predicates/declared-block.js'
import {
  sectionsAtDepth,
  sectionsHolding,
  sectionsNamed,
  sectionsWithSubsection,
  type SubsectionOptions,
} from '../predicates/section.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'

export type { MdSectionElement } from '../model/sections.js'
export type { SubsectionOptions } from '../predicates/section.js'
export type { SectionTableOptions } from '../conditions/section.js'

/**
 * Rule builder over the corpus's sections (plan 0496): every heading at a document's top level,
 * with the lines it governs, so a requirement can be stated per section.
 *
 * ```ts
 * sections(c).that().areNamed(/^Phase \d+/).should().haveSubsection('Files changed').check()
 * ```
 *
 * Every section name a rule reads (`areNamed`, `areInSection`, `haveSubsection`) is scanned in the
 * documents the rule can see: a heading that misses a string name only by case or spacing, and a
 * heading of the name inside a list item or blockquote (which does not start a section), are
 * findings of this rule, whatever it examined.
 */
export class SectionRuleBuilder extends CorpusRuleBuilder<MdSectionElement> {
  protected readonly noun = 'sections'

  protected getElements(): MdSectionElement[] {
    return this.project.documents().flatMap((doc) => [...sectionsOf(doc)])
  }

  /** A section is reported at its heading, `relPath:line`. */
  protected locate(s: MdSectionElement): MdLocation {
    return atLine(s)
  }

  /** Filter to sections whose heading text matches: a string exactly, or a `RegExp`, as `haveSection` matches. */
  areNamed(name: string | RegExp): this {
    return this.addPredicate(sectionsNamed(name))
  }

  /** Filter to sections whose heading level is `depth` (1 to 6; anything else is refused). */
  areAtDepth(depth: number): this {
    return this.addPredicate(sectionsAtDepth(depth))
  }

  /**
   * Filter to sections under a heading matching `name`, at any depth above them: the meaning
   * `links().areInSection()` has.
   */
  areInSection(name: string | RegExp): this {
    return this.addPredicate(areInSectionPredicate<MdSectionElement>(name))
  }

  /**
   * Dual-use: after `.that()`, the sections that contain a section of `name`; after `.should()`,
   * every selected section must contain one. With `depth`, only a subsection at that level counts.
   */
  haveSubsection(name: string | RegExp, options: SubsectionOptions = {}): this {
    if (this._phase === 'condition') {
      return this.addCondition(haveSubsectionCondition(name, options))
    }
    return this.addPredicate(sectionsWithSubsection(name, options))
  }

  /**
   * Assert every selected section contains a table with the columns. `docs().haveTable({ section })`
   * passes when any table under a heading of the name has them; this asserts it of each section.
   */
  haveTable(options: SectionTableOptions): this {
    return this.addCondition(sectionHaveTable(options))
  }

  /** Dual-use, read in either phase as `haveSubsection` is: the section holds what `h` names. */
  private holding(h: SectionHolding): this {
    return this._phase === 'condition'
      ? this.addCondition(sectionHolds(h))
      : this.addPredicate(sectionsHolding(h))
  }

  /**
   * Dual-use (plan 0522): the section holds something after its heading, subsections included: a
   * block other than a heading, a thematic break or an HTML comment.
   */
  haveContent(): this {
    return this.holding({ kind: 'content' })
  }

  /** Dual-use (plan 0522): the section holds a code block, tagged `lang` when given (any letter case). */
  haveCodeBlock(options: SectionCodeBlockOptions = {}): this {
    return this.holding(
      options.lang === undefined
        ? { kind: 'code block' }
        : { kind: 'code block', lang: options.lang },
    )
  }

  /** Dual-use (plan 0522): the section holds a list item, at any depth. */
  haveListItem(): this {
    return this.holding({ kind: 'list item' })
  }

  /** Dual-use (plan 0522): the section holds an inline link, as `links()` reads one. */
  haveLink(): this {
    return this.holding({ kind: 'link' })
  }

  /**
   * Dual-use (plan 0522): the section holds a code pointer, as `pointers()` reads one. Whether it is
   * live is `pointers(c).that().satisfy(inSections(…)).should().resolve()`, a second rule.
   */
  haveCodePointer(): this {
    return this.holding({ kind: 'code pointer' })
  }
}

/** Options for `haveCodeBlock`: the language its tag must name, compared as ADR-019 says. */
export interface SectionCodeBlockOptions {
  readonly lang?: string
}

/** Entry point: build rules over the corpus's sections (plan 0496). */
export function sections(corpus: Corpus): SectionRuleBuilder {
  return new SectionRuleBuilder(corpus)
}
