# Bug 0173: the line-index cache serves a stale measurement

## Status

- **State:** Draft — fix built and measured; ready to close with this PR.
- **Found:** 2026-08-20, review of the `linesOfCode` performance work
  ([bug 0170](./0170-linesofcode-counts-comments-so-documentation-reads-as-size.md)).
  Found independently by four reviewers.

## Symptom

`linesOfCode` cached its per-file line index in a `WeakMap` keyed on
`SourceFile`, with no invalidation. After any in-process edit it returned a
number that corresponds to **nothing**:

```
truth (fresh project)      5   8
via a reused project       5   6      <- second measurement wrong
```

The failure is not "returns the previous answer". Positions come from the AST
and stay fresh while the line table goes stale, so the two are read against each
other — the class above grew from 5 code lines to 8 and measured 6.

The shape that matters is `createSourceFile(path, text, { overwrite: true })` —
the fixture pattern this repo's own guidance prescribes ("Vitest for tests —
fixture-based"). Every case after the first measured the first case's file, and
a rule author tuning assertions against those numbers would be tuning against
garbage with nothing to tell them.

`linesOfCode` is public API (`packages/ts/src/index.ts`) and documented in
`docs/api-reference.md`, so this was consumer-facing, not internal.

## Root cause

Two failures, and the second is the one worth keeping.

**The mechanical one:** `WeakMap<SourceFile, …>` with no `onModified` listener
and no `registerCacheReset`, so `resetProjectCache()` — documented as the
consumer's escape hatch — silently stopped covering the size metric.

**The one that matters:** the docstring asserted the opposite of a fact this
repo had already measured and written down twice.

> Safe because eess only ever READS a project: ts-morph replaces node objects
> when a file's text changes, so a stale array cannot be reached through a live
> SourceFile.

`packages/ts/src/core/module-edges.ts` says, marked **measured**: "A
`SourceFile`'s identity SURVIVES an edit … A `SourceFile`-keyed cache without
invalidation serves pre-edit edges after an edit: ADR-008's false green,
manufactured by a cache." `descendant-cache.ts` calls it "the same trap plan
0076 found one level up with `SourceFile`". Two prior findings, both recorded;
the third instance was written as if reasoning.

## Fix

The index moves to `packages/ts/src/core/line-index.ts`, beside the three caches
that already do this correctly, and adopts their convention: `let` bindings
replaced by `registerCacheReset`, and one `onModified` listener per file that
drops both maps. Measured: `onModified` fires for `addMethod`,
`replaceWithText` **and** `createSourceFile(…, { overwrite: true })`.

Registration happens **once, at the single public entry**, not in each accessor.
Both maps drop on the same event, so a call in either accessor made the other's
redundant — and a redundant guard is an unprovable one: removing either alone
left the suite green. At the entry point, removing it reddens the tests.

## Verification

- [x] Red first: measure, mutate, re-measure returns the truth — `complexity.test.ts` ·
      `it('re-measures after a node is added to the file')`, red at `expected 6 to be 10`.
- [x] The fixture shape specifically — `it('re-measures when the same path is overwritten — the fixture pattern')`,
      red at `expected [ 5, 6 ] to deeply equal [ 5, 8 ]`.
- [x] Ground truth comes from a project that never saw the earlier text, so the
      test cannot be satisfied by the same cache it is checking.
- [x] Sabotage: removing the single `watchOnce` is CAUGHT; emptying the listener
      body is CAUGHT.
- [x] `npm run validate` — no new failures against the branch baseline.

## Out of scope, and owed

There is still **no census** requiring every module-level `WeakMap<SourceFile |
ArchProject, …>` to be reachable from `clearRegisteredCaches()`. Three caches
follow the convention by hand, this was the fourth and did not, and nothing
fired. Ask the reviewer's question of the existing per-cache tests — what would
they do if a new unregistered cache appeared? — and the answer is "pass". The
model to copy is `every-config-finding-is-classified.test.ts`, which the repo
already built for exactly this shape of registry.
