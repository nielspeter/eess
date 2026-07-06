import { RuleBuilder } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { matchTableRows, type MdRow, type RowMatchOptions } from '../model/rows.js'

/**
 * Rule builder over table rows drawn from the corpus.
 *
 * A row is a first-class element (`MdRow`): its located-column accessor
 * (`get(role)`), its real source line, and back references to its document and
 * table. Rows are drawn from **every** table (across all documents) that sits
 * under the requested section and has all the requested columns.
 *
 * The primary use is `.select()` — turning spec-table rows into one side of a
 * kernel `correspondence()` so a table can be bound to code and fail on drift.
 * The standard `.that().satisfy(…)` / `.should().satisfy(…)` surface is
 * inherited, so rows are also directly rule-able.
 */
export class RowsRuleBuilder extends RuleBuilder<MdRow, Corpus> {
  constructor(
    corpus: Corpus,
    private readonly opts: RowMatchOptions,
  ) {
    super(corpus)
  }

  protected getElements(): MdRow[] {
    return this.project.documents().flatMap((doc) => matchTableRows(doc, this.opts))
  }

  // `RowMatchOptions` is carried as an own property, so the base `fork()`
  // (Object.assign) preserves it across `.should()`. A test asserts this.
}

/**
 * Entry point: build rules over table rows in the corpus.
 *
 * ```ts
 * const packageRows = rows(c, {
 *   section: /^Packages$/,
 *   columns: { pkg: /^Package$/, status: /^Status$/ },
 * }).select({
 *   label: 'README package row',
 *   identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
 * })
 * ```
 */
export function rows(corpus: Corpus, opts: RowMatchOptions): RowsRuleBuilder {
  return new RowsRuleBuilder(corpus, opts)
}
