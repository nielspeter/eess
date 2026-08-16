/**
 * Where invalidatable caches register themselves.
 *
 * A dialect's project-reset function (e.g. eess-ts's `resetProjectCache()`)
 * calls {@link clearRegisteredCaches} and never learns what is in it — a
 * memoized selection (`selectionMemo`) or any other per-project cache
 * registers its own reset closure here at module scope instead of the reset
 * function importing every cache module directly, which would risk an
 * import cycle between the cache and the project module it needs to key on.
 *
 * A `WeakMap` cannot be enumerated, so "clear" means "replace the map". Each
 * cache contributes the closure that replaces its own.
 */
const resets: (() => void)[] = []

/** Register a cache's reset. Call once, at module scope. */
export function registerCacheReset(reset: () => void): void {
  resets.push(reset)
}

/**
 * Drop every registered cache.
 *
 * Caches are keyed on object identity, so a caller who obtains projects
 * through a dialect's own loader (which hands back a cached, stable object)
 * is already covered. This is the escape hatch for a consumer holding a
 * project object **they** built across a mutation of the underlying engine
 * state, where identity does not change and a cached population would
 * otherwise be frozen.
 */
export function clearRegisteredCaches(): void {
  for (const reset of resets) reset()
}
