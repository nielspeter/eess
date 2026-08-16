import { registerCacheReset } from './cache-registry.js'

/**
 * Memoize a builder's materialized selection.
 *
 * ## Why this exists
 *
 * When more than one reader needs the same materialized element set (a
 * terminal's evidence gate and a diagnostic preview, say), two readers of
 * one computation means the walk runs twice per rule — on a large project
 * with many rules that adds up to real, avoidable latency. Memoizing keeps
 * both readers reading the same computation, once.
 *
 * ## Why a WeakMap and not an instance field
 *
 * Because a field would be **wrong**, not merely different. Rule builders
 * are copy-on-write: every chain method returns `this.copy()`, a shallow
 * clone (`Object.assign(clone, source)` over own enumerable properties). A
 * memo stored on the instance is therefore copied onto a builder that has
 * just been given a **different predicate**, and the clone answers with its
 * parent's selection — a stale-evidence bug that is easy to miss, since the
 * number stays plausible and only a test that narrows *after* materializing
 * would catch it.
 *
 * A `WeakMap` keyed on the builder has no such hazard by construction. A
 * clone is a different object, so a different key, so no entry. Nothing to
 * clear on copy, and the entry is collected with the builder.
 *
 * ## Why a factory rather than one shared map
 *
 * So the element type survives without an assertion. One `WeakMap<object,
 * unknown[]>` shared by every family would need a cast on the way out,
 * which ADR-005 forbids — and the honest alternatives (a `filter` with an
 * always-true type predicate) are worse: they compile, allocate, and lie.
 *
 * @example
 * const selectionOf = selectionMemo<ArchFunction>()
 *
 * private selected(): ArchFunction[] {
 *   return selectionOf(this, () =>
 *     this.getElements().filter((e) => this._predicates.every((p) => p.test(e))),
 *   )
 * }
 */
export function selectionMemo<T>(): (owner: object, compute: () => T[]) => T[] {
  let cache = new WeakMap<object, T[]>()
  // A consumer holding a builder across a mutation of the underlying engine
  // state gets the pre-mutation selection back, since identity has not
  // changed — the same staleness profile every other project-keyed cache in
  // this kernel accepts, closed the same way: a dialect's project-reset
  // function drops every registered cache via `clearRegisteredCaches()`.
  registerCacheReset(() => {
    cache = new WeakMap<object, T[]>()
  })
  return (owner, compute) => {
    const cached = cache.get(owner)
    if (cached !== undefined) return cached
    const computed = compute()
    cache.set(owner, computed)
    return computed
  }
}
