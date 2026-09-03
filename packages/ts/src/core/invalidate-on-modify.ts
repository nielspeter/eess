import type { SourceFile } from 'ts-morph'

/**
 * Drop a file's cached derivations the first time it is modified, registering
 * the listener exactly once.
 *
 * `descendant-cache.ts` and `line-index.ts` each carried this. They are the two
 * per-file memo caches in this package, so they need the same invalidation and
 * had the same code for it — `no-copy-paste` reported it at 100%.
 *
 * **`invalidate` is a callback rather than the caches themselves, and that is
 * not a style choice.** Both modules RESET by reassigning their `WeakMap`s
 * (`byFile = new WeakMap(...)`), so a listener holding the map objects would go
 * on deleting from the map that was replaced, leaving the live one stale. A
 * callback reads the module's current bindings at the moment it fires.
 *
 * `watched` stays the caller's, because it is reset alongside the caches it
 * guards.
 */
export function invalidateOnModify(
  sourceFile: SourceFile,
  watched: WeakSet<SourceFile>,
  invalidate: (file: SourceFile) => void,
): void {
  if (watched.has(sourceFile)) return
  watched.add(sourceFile)
  sourceFile.onModified(() => {
    invalidate(sourceFile)
  })
}
