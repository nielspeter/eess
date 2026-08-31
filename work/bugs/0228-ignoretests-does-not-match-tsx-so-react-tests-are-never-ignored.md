# Bug 0228: `.ignoreTests()` never matches a `.tsx` test, so in a React codebase it ignores nothing

## Status

- **State:** Draft — measured against a real codebase; no fix attempted.
- **Severity:** Medium — nothing is missed, so this is not a fail-open. It is the
  opposite: a filter the caller explicitly asked for silently does nothing, and
  the findings they asked to exclude arrive anyway. In an agent-facing tool that
  is how a detector earns being switched off.
- **Origin:** self-found · re-running `smells.duplicateBodies()` over a
  ~5,600-file production monorepo after
  [0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md)'s
  reporting rework, with `.ignoreTests()` set.
- **Reported:** 2026-08-31

## Symptom

`.ignoreTests()` filters on three globs:

```ts
// packages/ts/src/smells/duplicate-bodies.ts:18
const TEST_PATTERNS = ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**']
```

No `.tsx`. In any React or JSX codebase — where `Foo.test.tsx` is the dominant
test-file spelling — the flag matches nothing outside `__tests__/`.

Measured on a real run with `.ignoreTests()` explicitly set: **6 findings came
from `.test.tsx` files**, including pairs whose element names make the origin
plain:

```
createDefaultAssetSidebarProps (…/components/asset/AssetSidebar.test.tsx:120)
  is 94% similar to
createDefaultEntrySidebarProps (…/components/entry/EntrySidebar.test.tsx:139)
  — 2 varying axes: asset -> entry, draftAsset -> draftEntry
```

Test-fixture builders are near-identical by nature, so they are exactly what
`.ignoreTests()` exists to suppress, and exactly what still comes through.

`.mts`, `.cts`, `.jsx` and `.js` have the same hole prospectively; `.tsx` is the
one with a measured consequence.

## Root cause

The glob list was written for a `.ts`-only corpus and never widened. The
detector itself does read `.tsx` — `project()` loads whatever the tsconfig
includes — so the collector and the ignore-filter disagree about what a source
file is.

**The same list is duplicated**, which is why a fix has two sites:

```
packages/ts/src/smells/duplicate-bodies.ts:18
packages/ts/src/smells/sibling-files.ts:10
```

Both spell it out identically. `smells.siblingFiles()` therefore has the same
hole, unmeasured.

## Fix

One shared constant, widened to the extensions the loader actually reads —
`**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}` plus `**/__tests__/**`. Both
call sites import it, so the duplication that made this a two-site fix stops
being one.

Worth checking while there: whether any other filter in `packages/ts/src`
enumerates source extensions and has drifted the same way.

## Verification

- [ ] Red first — a fixture with two near-identical bodies in `a.test.tsx` and
      `b.test.tsx`, asserting `.ignoreTests()` yields zero findings. It fails on
      the tree as it stands.
- [ ] The same for `smells.siblingFiles()`, which shares the defect.
- [ ] A test pinning that the two call sites read ONE constant, so the next
      widening cannot land on one and miss the other.
- [ ] Non-vacuity: the fixture must also show findings WITHOUT `.ignoreTests()`,
      or a filter that excludes everything would pass it.
- [ ] `npm run validate` green.

## Out of scope

- Whether `.ignoreTests()` should be the default. It is a caller's decision and
  this record is only that the decision is not honoured.
- The reporting rework that surfaced this —
  [0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md).
