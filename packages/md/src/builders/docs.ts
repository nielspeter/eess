import { RuleBuilder } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdDocument } from '../model/document.js'
import {
  resideInFolder,
  resideInFile,
  haveNameMatching,
  haveSectionPredicate,
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
export class DocsRuleBuilder extends RuleBuilder<MdDocument, Corpus> {
  protected getElements(): MdDocument[] {
    return this.project.documents()
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
    return this.addPredicate(haveSectionPredicate(name))
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
