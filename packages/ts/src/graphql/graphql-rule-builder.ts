import type { Condition, Predicate, RuleDescription } from '@nielspeter/eess'
import {
  conditionContextFrom,
  evaluateConditions,
  matchingElements,
  ruleDescriptionOf,
  selectionMemo,
} from '@nielspeter/eess/internal'
import type { CollectResult } from '../core/terminal-builder.js'
import { TerminalBuilder } from '../core/terminal-builder.js'

/**
 * What `SchemaRuleBuilder` and `ResolverRuleBuilder` both are.
 *
 * The two were one class written twice: identical `_predicates`/`_conditions`
 * fields, identical `that`/`and`/`should`/`andShould`, `copy`,
 * `assertsSomething`, `describeRule`, `selected`, `examinedUnits` and
 * `collectViolations` — `no-copy-paste` reported the last pair as literally the
 * same text. Extracting the shared body into a free function only shortened the
 * copy; the honest reading of the finding is that the class is the duplicate.
 *
 * Neither extends `RuleBuilder`, because a GraphQL element is not a ts-morph
 * node and the predicate/condition surfaces are the schema's own. What they do
 * share is every piece of the ADR-010 evidence path, which is precisely where
 * two copies have already cost this repo something: they once derived their
 * `examined` count separately and disagreed, so a chain whose `.that()`
 * selected nothing reported 14 units examined, handed its conditions 0, and
 * passed green with `diagnose()` silent (plan 0096). One class is what makes
 * "the preview derives from the same computation the gate uses" structural.
 *
 * Subclasses supply the four things that genuinely differ: where elements come
 * from, the noun this family counts, the subject its description opens with,
 * and the conditions its assertion-less remedy should name.
 */
export abstract class GraphqlRuleBuilder<T> extends TerminalBuilder {
  protected _predicates: Predicate<T>[] = []
  protected _conditions: Condition<T>[] = []

  /**
   * Per-instance rather than per-module, which is what a generic class allows:
   * a single module-level `selectionMemo<T>()` cannot be typed for two element
   * types. Keying is still by builder identity, and `copy()` hands the clone
   * the same map, so the caching behaviour is the one the two modules had.
   */
  private readonly selectionOf = selectionMemo<T>()

  /** Every candidate, before any predicate runs. */
  protected abstract getElements(): T[]

  /** The conditions this builder's assertion-less remedy should name, e.g. `'haveFields(...)'`. */
  protected abstract conditionExamples(): string

  /** The noun the rule description opens with — `schema that …`, `resolvers that …`. */
  protected abstract descriptionSubject(): string

  // --- Chain methods (readability markers; the phase is implicit) ---

  /** Begin the predicate phase. Purely a readability marker. */
  that(): this {
    return this
  }

  /** Add another predicate (AND). */
  and(): this {
    return this
  }

  /** Begin the condition phase. */
  should(): this {
    return this
  }

  /** Add another condition (AND). */
  andShould(): this {
    return this
  }

  // --- Evaluation ---

  /**
   * An independent copy, carrying both lists.
   *
   * These builders do not extend `RuleBuilder`, so they do not inherit that
   * class's override — and neither `that()` nor `should()` forked here at all,
   * which made the bug 0016 leak worse on this hierarchy than on the main one:
   * a held `schema()` selection accumulated every predicate and condition of
   * every rule derived from it. `docs/graphql.md` teaches exactly that shape.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._predicates = [...this._predicates]
    clone._conditions = [...this._conditions]
    return clone
  }

  /**
   * Whether this rule states an assertion at all — the assertion gate's question.
   *
   * True once a condition has been added.
   *
   * Overrides the `TerminalBuilder` default (`true`), whose JSDoc carries the
   * contract and the reason this is public rather than protected.
   */
  override assertsSomething(): boolean {
    return this._conditions.length > 0
  }

  /**
   * The remedy for this builder's assertion-less state, as one string.
   *
   * One channel, so `diagnose()`'s advice and the finding's own message cannot
   * disagree. Overrides `TerminalBuilder`'s generic text with wording specific to
   * what this builder is missing.
   */
  override assertionAdvice(): string {
    return (
      'this rule has no condition, so it asserts nothing and can never fail. Add a ' +
      `condition after .should(), e.g. ${this.conditionExamples()}.`
    )
  }

  /** Named by id or description, not 'unnamed' (plan 0070 §4). */
  override describeRule(): RuleDescription {
    return {
      ...super.describeRule(),
      rule: this._metadata?.id ?? this.buildRuleDescription(),
    }
  }

  /**
   * The set the conditions receive — plan 0096, and the ONE method every reader
   * calls: `collectViolations()`, `examinedUnits()` and `diagnose()`'s preview
   * all come through here, so none of them can answer "what did this rule look
   * at" differently from the others.
   */
  protected selected(): T[] {
    return this.selectionOf(this, () => matchingElements(this.getElements(), this._predicates))
  }

  /**
   * How many units this rule actually examined — ADR-010's evidence that a pass
   * was constructed rather than defaulted. The selection, not what precedes it.
   */
  examinedUnits(): number {
    return this.selected().length
  }

  protected collectViolations(): CollectResult {
    // The kernel's. The zero-evidence early exit and the `examined` count travel
    // with it, so they cannot be derived apart.
    return evaluateConditions(
      this.selected(),
      this._conditions,
      conditionContextFrom({
        metadata: this._metadata,
        reason: this._reason,
        rule: this.buildRuleDescription(),
      }),
    )
  }

  protected buildRuleDescription(): string {
    return ruleDescriptionOf(this._predicates, this._conditions, this.descriptionSubject())
  }
}
