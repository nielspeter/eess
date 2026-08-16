/**
 * The narrowings this kernel needs at its JS-interop edges, in one place.
 *
 * ADR-005 forbids `as` and prescribes type guards. Before this module, the
 * guard existed but was written twice, verbatim, at two different JS-interop
 * boundaries in `packages/ts` — one bare `isRecord` predicate per site,
 * neither importing the other. A duplicated predicate is not a style
 * problem here: two copies are free to drift, and only one needs to drop a
 * clause (say, the `!Array.isArray` exclusion) for the two sites to start
 * disagreeing about what counts as a record.
 */

/**
 * A plain object, indexable by string.
 *
 * Excludes `null`, which `typeof` does not — and excludes **arrays**, which
 * is load-bearing rather than tidy: a caller deep-comparing config objects
 * or reading `tsconfig.json` fields must not have an array quietly accepted
 * as a record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * A value that can be called with no arguments.
 *
 * Narrower than it looks, and deliberately so: the return type is
 * `unknown`, so every caller has to establish what came back rather than
 * inheriting a claim.
 *
 * This exists because *removing* a cast is not automatically an
 * improvement. Dropping `(exported as () => unknown)()` after a
 * `typeof === 'function'` check leaves `exported` typed as `Function`,
 * which trades an ADR-005 violation for a `no-unsafe-call` lint error — the
 * same unchecked call, differently spelled. A predicate narrows to a
 * signature and satisfies both.
 */
export function isNullaryCallable(value: unknown): value is () => unknown {
  return typeof value === 'function'
}
