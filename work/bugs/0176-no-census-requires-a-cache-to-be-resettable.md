# Bug 0176: no census requires a cache to be resettable

## Status

- **State:** Draft — the gap is demonstrated by a defect that already shipped.
- **Found:** 2026-08-20, re-homed from
  [bug 0173](./fixed/0173-the-line-index-cache-serves-a-stale-measurement.md)'s
  "Out of scope, and owed" section at close, rather than left as a footnote in a
  finished record.

## Symptom

`resetProjectCache()` is documented as the consumer's escape hatch: call it and
every cached derivation is dropped. Whether that is TRUE depends on each cache
author remembering to call `registerCacheReset` and to attach an `onModified`
listener. Nothing checks that they did.

Four module-level caches key on `SourceFile` or `ArchProject`:

- `packages/ts/src/core/element-cache.ts`
- `packages/ts/src/core/descendant-cache.ts`
- `packages/ts/src/core/module-edges.ts`
- `packages/ts/src/core/line-index.ts`

Three followed the convention by hand. The fourth did not, and the result was a
public metric returning a number corresponding to nothing after any in-process
edit (bug 0173). Nothing in the suite or the gate chain fired.

## Root cause

The convention is carried in prose and by imitation. Ask the reviewer's question
of the existing per-cache tests — _what would they do if a new unregistered cache
appeared?_ — and the answer is "pass". They each test their own cache's
behaviour; none asserts anything about the SET of caches.

This is the same defect class as
[bug 0175](./0175-kernel-configuration-findings-sit-outside-every-census.md) and
the same one `every-config-finding-is-classified.test.ts` was built to close for
configuration findings: a registry whose membership is maintained by memory.

## Fix

Not built. The model to copy is `every-config-finding-is-classified.test.ts` —
derive the set of caches from source rather than listing them, and fail when one
is not reachable from `clearRegisteredCaches()`.

The scan has to answer one design question first: what syntactically IS a cache
here? `new WeakMap<SourceFile, …>` and `new WeakMap<ArchProject, …>` at module
scope covers all four of today's, but a `Map` keyed on a file path would be the
same defect and would not match. Decide whether the census keys on the shape or
on a declared marker, and say why in the test.

## Verification

- [ ] Every module-scope cache keyed on a `SourceFile`/`ArchProject` is
      reachable from `clearRegisteredCaches()`.
- [ ] Adding an unregistered cache fails the census. (Sabotage row: delete the
      `registerCacheReset` call from `line-index.ts` and watch it red — that is
      the exact instance this bug is named after.)
- [ ] The census fails when a registered cache is deleted (the stale direction).
- [ ] A vacuity row asserts the scan found caches, with a floor above zero.
