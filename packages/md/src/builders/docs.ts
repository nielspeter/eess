import { partition, uniqueByCondition } from '@nielspeter/eess/internal'
import { collectResult, type CollectResult } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { readsSections } from '../model/section-declarations.js'
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
  documentsTitled,
} from '../predicates/document.js'
import {
  haveSection as haveSectionCondition,
  haveTable as haveTableCondition,
  haveTitle as haveTitleCondition,
  type HaveSectionOptions,
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

  /**
   * The documents this rule can see, for the section-name scan: those its own predicates select,
   * leaving out the predicates that read a section name (a document lacking the section is what the
   * scan is about).
   */
  protected override visibleDocuments(): readonly MdDocument[] {
    return partition(
      this.project.documents(),
      this._predicates.filter((p) => !readsSections(p)),
    ).elements
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

  /**
   * Dual-use: predicate after `.that()`, condition after `.should()`. With `depth` (plan 0496), only
   * a heading at that level counts, a heading of the name at another level is named in the finding,
   * and the name is scanned for a heading this rule cannot read (`SectionRuleBuilder`'s scan).
   */
  haveSection(name: string | RegExp, options: HaveSectionOptions = {}): this {
    if (this._phase === 'condition') {
      return this.addCondition(haveSectionCondition(name, options))
    }
    return this.addPredicate(predicateHaveSection(name, options))
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

  /**
   * Dual-use (plan 0522): the document's title is its first heading, at depth 1, matching `name`
   * when given (a string exactly, or a `RegExp`). After `.should()` a document with no heading, a
   * first heading at another depth, or a title that does not match is a finding naming which.
   */
  haveTitle(name?: string | RegExp): this {
    if (this._phase === 'condition') return this.addCondition(haveTitleCondition(name))
    return this.addPredicate(documentsTitled(name))
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
   * set within the bound folders: a value no group names, in a folder a group binds, is reported. A
   * document in no group's folders whose value is in no group is not judged; add a `'rest'` group to
   * close the set everywhere. `direction` is the kernel's: left is the value, right is the folder.
   * The value is read as `fields()` reads it and resolved as `haveField` resolves it, so a value that
   * cannot be read is reported, never judged by its first occurrence. An agreement that selected
   * documents and judged none is its own finding.
   */
  agreeWithFolder(options: AgreeWithFolderOptions): this {
    const agreement = new FolderAgreement(this.project, options)
    const next = this.addCondition(agreement.condition)
    next._agreements = [...next._agreements, agreement]
    return next
  }

  /**
   * The kernel's verdict and evidence, unchanged, plus each `agreeWithFolder`'s own findings:
   * its declaration's (refused or reported even over an empty selection) and, when it selected
   * documents and judged none, that one. The kernel's `examined` stands, so a declared emptiness
   * expires as the kernel decides.
   */
  protected override collectViolations(): CollectResult {
    if (this._agreements.length === 0) return super.collectViolations()
    for (const a of this._agreements) a.start()
    const base = super.collectViolations()
    const context = this.buildConditionContext()
    const own = this._agreements.flatMap((a) => [
      ...a.declarationFindings(context),
      ...a.judgedNone(context),
    ])
    return own.length === 0 ? base : collectResult([...base, ...own], base)
  }
}

/** Entry point: build rules over the corpus's markdown documents. */
export function docs(corpus: Corpus): DocsRuleBuilder {
  return new DocsRuleBuilder(corpus)
}
