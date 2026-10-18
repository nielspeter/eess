import { collectResult, type CollectResult, type Predicate } from '@nielspeter/eess'
import { matchingElements } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import {
  causeViolation,
  fieldVerdict,
  haveFieldCondition,
  haveFieldPredicate,
  type HaveFieldOptions,
} from './have-field.js'
import type { MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
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
export class DocsRuleBuilder extends CorpusRuleBuilder<MdDocument> {
  /** What `haveField()` declared as a selector, with its predicate, for the findings (plan 0469). */
  private _fields: readonly {
    readonly spec: HaveFieldOptions
    readonly predicate: Predicate<MdDocument>
  }[] = []

  protected getElements(): MdDocument[] {
    return this.project.documents()
  }

  /**
   * The base result, plus what `haveField()` used as a selector could not read, for the documents
   * the rule's other predicates keep: a conflict, an empty value, a label in a form the rule does not
   * read, a value outside the header, prose that disagrees (plan 0469). A selector must not drop a
   * document without saying so (ADR-009). The scan raises no `examined`, as `links()`'s. A finding
   * the condition form already reported is not repeated.
   */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    if (this._fields.length === 0) return base
    const own = new Set(this._fields.map((f) => f.predicate))
    const others = this._predicates.filter((p) => !own.has(p))
    const kept = matchingElements(this.getElements(), others)
    const seen = new Set(base.map((v) => `${v.file}\u0000${String(v.line)}\u0000${v.message}`))
    const context = this.buildConditionContext()
    const found = this._fields.flatMap(({ spec }) =>
      kept.flatMap((d) =>
        fieldVerdict(d, spec)
          .causes.filter((c) => c.kind === 'unreadable')
          .map((c) => causeViolation(d, c, context)),
      ),
    )
    const fresh = found.filter((v) => {
      const key = `${v.file}\u0000${String(v.line)}\u0000${v.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (fresh.length === 0) return base
    return collectResult([...base, ...fresh], base)
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
    return this.addPredicate(haveSectionPredicate(name))
  }

  /**
   * Dual-use (plan 0469): after `.that()`, select the documents whose labelled value resolves (and,
   * with `oneOf`, is allowed); after `.should()`, assert every selected document has it. The value is
   * read as `fields()` reads it, and resolved in one place: structured forms beat plain prose, two
   * structured values conflict. Every cause that makes a value unreadable is reported in either
   * position. A readable value outside `oneOf` is, as a selector, the filter doing its job: pair the
   * rule with `fields(...).resolveAgainst(...)` to catch a misspelling. A selection taken with
   * `.select()` carries none of these findings.
   */
  haveField(spec: HaveFieldOptions): this {
    if (this._phase === 'condition') return this.addCondition(haveFieldCondition(spec))
    const predicate = haveFieldPredicate(spec)
    const next = this.addPredicate(predicate)
    // Replaced, not pushed, so a fork never shares its parent's specs.
    next._fields = [...next._fields, { spec, predicate }]
    return next
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
