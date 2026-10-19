import { uniqueByCondition } from '@nielspeter/eess/internal'
import { collectResult, type CollectResult } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { haveFieldCondition, predicateHaveField, type HaveFieldOptions } from './have-field.js'
import type { MdLocation } from '../conditions/not-exist.js'
import { CorpusRuleBuilder } from './corpus-rule-builder.js'
import type { MdDocument } from '../model/document.js'
import { mdViolation } from '../model/violation.js'
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
import { FolderAgreement, type AgreeWithFolderOptions } from '../conditions/agree-with-folder.js'

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
  /** The `agreeWithFolder` conditions, kept for their declaration findings and evidence (plan 0495). */
  private _agreements: FolderAgreement[] = []

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

  /**
   * Assert no two matched documents share `key`'s value (plan 0459). Every member of a group is a
   * finding at its own line 1, naming the others; `what` names the value in the message. Exact match:
   * normalise in `key`. Remove a document without a value with `.that()` first.
   */
  beUniqueBy(key: (d: MdDocument) => string, what: string): this {
    return this.addCondition(
      uniqueByCondition<MdDocument>({
        key,
        what,
        locate: (d) => ({ name: d.relPath, at: `${d.relPath}:1` }),
        toViolation: (d, message, context) =>
          mdViolation({ element: d.relPath, file: d.file, line: 1, message, context }),
      }),
    )
  }

  /**
   * Plan 0495 (proposal 017, block 5): each document's value and the folder it sits in say the same
   * thing. `groups` bind values to folders, one group may bind `'rest'`, and the values are a closed
   * set in every direction. `direction` is the kernel's: left is the value, right is the folder. The
   * value is read as `fields()` reads it and resolved as `haveField` resolves it, so a value that
   * cannot be read is reported, never judged by its first occurrence. `examined` counts the
   * documents judged, not the documents selected.
   */
  agreeWithFolder(options: AgreeWithFolderOptions): this {
    const agreement = new FolderAgreement(this.project, options)
    const next = this.addCondition(agreement.condition)
    next._agreements = [...next._agreements, agreement]
    return next
  }

  protected override copy(): this {
    const clone = super.copy()
    clone._agreements = [...this._agreements]
    return clone
  }

  /**
   * The kernel's verdict, plus each `agreeWithFolder`'s declaration findings (refused or reported
   * even over an empty selection), and the evidence counted as plan 0495 decision D1 asks: when every
   * condition is an `agreeWithFolder`, `examined` is the documents one of them judged, so a rule that
   * read no value (a misspelt label, the wrong forms or region) is the zero-examined finding, not
   * green over every document it selected. Beside any other condition, every selected document is
   * judged by that one, and the kernel's count stands.
   */
  protected override collectViolations(): CollectResult {
    if (this._agreements.length === 0) return super.collectViolations()
    for (const a of this._agreements) a.start()
    const base = super.collectViolations()
    const context = this.buildConditionContext()
    const declared = this._agreements.flatMap((a) => a.declarationFindings(context))
    const onlyAgreements = this._conditions.every((c) =>
      this._agreements.some((a) => a.condition === c),
    )
    const judged = new Set<MdDocument>()
    let ran = true
    for (const a of this._agreements) {
      const each = a.judged()
      if (each === undefined) ran = false
      else for (const d of each) judged.add(d)
    }
    const examined = onlyAgreements && ran ? judged.size : base.examined
    return collectResult([...base, ...declared], {
      examined,
      sourceEmpty: base.sourceEmpty,
      declaredEmpty: base.declaredEmpty,
      notRun: base.notRun,
      deadGlob: base.deadGlob,
      undecided: base.undecided,
    })
  }
}

/** Entry point: build rules over the corpus's markdown documents. */
export function docs(corpus: Corpus): DocsRuleBuilder {
  return new DocsRuleBuilder(corpus)
}
