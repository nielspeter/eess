/**
 * The cardinality exemption, keyed so that only this module can set it.
 *
 * ADR-010 part 3: `.expectEmpty()` is a rule-level declaration a caller
 * writes to say "this stays empty." Cardinality is different — a condition
 * like `notExist()` is satisfied BY emptiness, as a matter of what it means,
 * not as a caller's exemption. `Condition` is a public export and
 * `defineCondition` is its sanctioned constructor; if the exemption were
 * expressible as a plain property, it would be a one-line silent opt-out on
 * any user condition — exactly the `.allowEmpty()` shape ADR-010 rejects,
 * relocated onto the condition object.
 *
 * Ported from `ts-archunit`'s `cardinality.ts` (plan 0088 Phase 1 merge
 * hazard 2) — including the `WeakSet`-vs-symbol choice. A `unique symbol`
 * version was forged in one line through `Object.getOwnPropertySymbols`:
 * `notExist()` is publicly exported, so any caller holding one could recover
 * and replant the symbol on a forged condition. A module-private `WeakSet`
 * membership cannot be read off an object, copied, or forged — a caller would
 * need this module's own binding, which is never exported.
 */
const CARDINALITY_ASSERTERS = new WeakSet<object>()

/**
 * Declare that this condition is satisfied by an empty selection. Called by
 * a dialect's own sanctioned condition constructors (`notExist()` et al.) —
 * never intended for a caller to apply to their own `defineCondition`.
 *
 * **Honest weakening from the ported design, named rather than hidden.**
 * `ts-archunit`'s original never re-exported this from its single package's
 * public surface, so a `unique symbol` (then a `WeakSet`, after the symbol
 * was itself forged) closed the hole completely: no import path existed to
 * name the key. eess's kernel/dialect split breaks that — `notExist()` lives
 * in `@nielspeter/eess-ts`, a separate package from this kernel module, so
 * this function MUST be exported from `@nielspeter/eess`'s public surface for
 * a dialect to call it at all. A determined caller could therefore import
 * this and mark their own custom `defineCondition` as cardinality-exempt.
 * The blast radius stays narrow — it only lets someone exempt a condition
 * *they wrote* from the empty-selection gate on *their own* rule, the same
 * self-harm `.expectEmpty()` already permits by design, not a way to forge
 * exemption onto a rule they don't control. `WeakSet`, not `Map`/`Set`: a
 * condition object is not retained after its rule is discarded.
 */
export function marksAssertsCardinality<T extends object>(condition: T): T {
  CARDINALITY_ASSERTERS.add(condition)
  return condition
}

/** Is this condition satisfied by an empty selection? */
export function assertsCardinality(condition: object): boolean {
  return CARDINALITY_ASSERTERS.has(condition)
}
