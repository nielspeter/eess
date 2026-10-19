import type { Corpus } from '../corpus.js'
import { haveFieldCondition, predicateHaveField, type HaveFieldOptions } from './have-field.js'
import type { MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import type { MdDocument } from '../model/document.js'
import {
  resideInFolder,
  resideInFile,
  haveNameMatching,
  predicateHaveSection,
} from '../predicates/document.js'
import {
  haveSection as haveSectionCondition,
  haveTable as haveTableCondition,
  type HaveTableOptions,
} from '../conditions/structure.js'

/**
 * Rule builder over the corpus's markdown documents.
 *
 * `.that()` methods filter documents (predicates); `.should()` methods assert
 * over them (conditions). `haveSection` is a single phase-dispatched method —
 * a predicate after `.that()`, a condition after `.should()` — mirroring the
 * dual-use methods in the TS dialect (plan 0041).
 */
export class DocsRuleBuilder extends CorpusRuleBuilder<MdDocument> {
  protected readonly noun = 'documents'

  protected getElements(): MdDocument[] {
    return this.project.documents()
  }

  /** A document is named by its path and reported at its first line. */
  protected locate(d: MdDocument): MdLocation {
    return { doc: d, line: 1, name: d.relPath }
  }

  /** Filter to documents whose repo-relative path matches the folder glob. */
  resideInFolder(glob: string): this {
    return this.addPredicate(resideInFolder(glob))
  }

  /** Filter to documents whose repo-relative path matches the file glob. */
  resideInFile(glob: string): this {
    return this.addPredicate(resideInFile(glob))
  }

  /** Filter to documents whose file name matches the pattern. */
  haveNameMatching(re: RegExp): this {
    return this.addPredicate(haveNameMatching(re))
  }

  /** Dual-use: predicate after `.that()`, condition after `.should()`. */
  haveSection(name: string | RegExp): this {
    if (this._phase === 'condition') {
      return this.addCondition(haveSectionCondition(name))
    }
    return this.addPredicate(predicateHaveSection(name))
  }

  /**
   * Dual-use (plan 0469): after `.that()`, select the documents whose labelled value resolves (and,
   * with `oneOf`, is allowed); after `.should()`, assert every selected document has it. The value is
   * read as `fields()` reads it, and resolved in one place: structured forms beat plain prose, two
   * structured values conflict. Every cause that makes a value unreadable is reported in either
   * position: as a selector, such a document is undecided (ADR-021), neither selected nor dropped,
   * and `.select()` over it refuses. A readable value outside `oneOf` is, as a selector, the filter
   * doing its job: pair the rule with `fields(...).resolveAgainst(...)` to catch a misspelling.
   */
  haveField(spec: HaveFieldOptions): this {
    if (this._phase === 'condition') return this.addCondition(haveFieldCondition(spec))
    return this.addPredicate(predicateHaveField(spec))
  }

  /** Assert each matched document contains a GFM table with the required columns. */
  haveTable(opts: HaveTableOptions): this {
    return this.addCondition(haveTableCondition(opts))
  }
}

/** Entry point: build rules over the corpus's markdown documents. */
export function docs(corpus: Corpus): DocsRuleBuilder {
  return new DocsRuleBuilder(corpus)
}
