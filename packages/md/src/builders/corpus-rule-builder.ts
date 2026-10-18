import { RuleBuilder } from '@nielspeter/eess'
import type { SelectorFault } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { mdNotExist, type MdLocation } from '../conditions/not-exist.js'
import { mdSelectorFault } from './selector-fault.js'
import { scopeDiagnosis } from '../predicates/in-documents.js'

/**
 * What every rule builder over a `corpus()` shares (plan 0456): a corpus that
 * loaded no document is an empty source, which outranks every declaration
 * (ADR-010 §3); an absence rule over a broken selector is a finding (bug 0460);
 * a positive rule emptied by an `inDocuments` scope names it (plan 0457); and
 * `notExist()`, each element reported where `locate` puts it.
 */
export abstract class CorpusRuleBuilder<T> extends RuleBuilder<T, Corpus> {
  /** Where an element is, and what a `notExist()` finding calls it. */
  protected abstract locate(element: T): MdLocation

  /** What a finding calls this builder's elements, in the plural: `'task items'`. */
  protected abstract readonly noun: string

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
    return scopeDiagnosis(this._predicates, this.getElements(), this.project.documents(), this.noun)
  }

  /** The selection must be empty: each selected element is a finding, at its own line. */
  notExist(): this {
    return this.addCondition(mdNotExist((e: T) => this.locate(e)))
  }
}
