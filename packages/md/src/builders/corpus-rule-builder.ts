import { collectResult, RuleBuilder, type CollectResult } from '@nielspeter/eess'
import type { SelectorFault } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { mdNotExist, type MdLocation } from '../conditions/not-exist.js'
import { mdSelectorFault } from '../model/selector-fault.js'
import type { MdDocument } from '../model/document.js'
import { citedHeadings, sectionDeclarationsOf } from '../model/section-declarations.js'
import type { ArchViolation } from '../model/violation.js'
import { admittedDocuments, scopeDiagnosis } from '../predicates/in-documents.js'
import { sectionDeclarationFindings } from './section-declarations.js'

/**
 * What every rule builder over a `corpus()` shares (plan 0456): a corpus that
 * loaded no document is an empty source, which outranks every declaration
 * (ADR-010 §3); an absence rule over a broken selector is a finding (bug 0460);
 * a positive rule emptied by an `inDocuments` scope names it (plan 0457); the
 * section-name scan over every section name its predicates and conditions read
 * (plan 0496); and `notExist()`, each element reported where `locate` puts it.
 */
export abstract class CorpusRuleBuilder<T> extends RuleBuilder<T, Corpus> {
  /** Where an element is, and what a `notExist()` finding calls it. */
  protected abstract locate(element: T): MdLocation

  /** What a finding calls this builder's elements, in the plural: `'task items'`. */
  protected abstract readonly noun: string

  /** Why a heading that misses a section name matters to this rule (the scan's near miss). */
  protected readonly sectionMissReason: string = 'this rule does not read it'

  /** No document loaded at all outranks everything, `.expectEmpty()` included (ADR-010 §3). */
  protected override sourceEmpty(): boolean {
    return this.project.documents().length === 0
  }

  /** Bug 0460: why an absence rule examined nothing, when the reason is its selector. */
  protected override cardinalitySelectorFault(): SelectorFault | undefined {
    return mdSelectorFault(this.globs(), this.project)
  }

  /** Plan 0457: a positive rule that examined nothing because of an `inDocuments` scope says so. */
  protected override deadGlobDiagnosis(): string | undefined {
    return scopeDiagnosis(
      this._predicates,
      () => this.getElements(),
      this.project.documents(),
      this.noun,
    )
  }

  /**
   * The documents this rule can see, for the scan's container and depth notes: those its
   * `inDocuments` scopes admit, or every document.
   */
  protected visibleDocuments(): readonly MdDocument[] {
    return admittedDocuments(this._predicates, this.project.documents())
  }

  /**
   * Findings about what the rule declared rather than what it selected: the section-name scan
   * (plan 0496). A builder with declarations of its own (`links().areLabelled()`) adds them here.
   * `base` is the kernel's verdict, whose findings already name some headings.
   */
  protected declarationFindings(base: readonly ArchViolation[]): ArchViolation[] {
    const declarations = sectionDeclarationsOf([...this._predicates, ...this._conditions])
    if (declarations.length === 0) return []
    return sectionDeclarationFindings({
      corpus: this.project,
      declarations,
      visible: this.visibleDocuments(),
      context: this.buildConditionContext(),
      missReason: this.sectionMissReason,
      cited: citedHeadings(base),
    })
  }

  /**
   * The base result, plus the declaration findings. The base evidence passes through unchanged:
   * the scan examines nothing the rule asserts over, so it must not raise `examined` (which would
   * hide the zero-examined finding when every declaration is misspelt) and must not go through
   * `mergeCollectResults`, whose dead-member rule would read an empty findings part as a dead rule
   * on every clean run.
   */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const findings = this.declarationFindings(base)
    if (findings.length === 0) return base
    return collectResult([...base, ...findings], base)
  }

  /** The selection must be empty: each selected element is a finding, at its own line. */
  notExist(): this {
    return this.addCondition(mdNotExist((e: T) => this.locate(e)))
  }
}
