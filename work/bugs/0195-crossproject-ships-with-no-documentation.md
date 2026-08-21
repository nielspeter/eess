# Bug 0195: `crossProject` ships as a public API with no documentation

## Status

- **State:** Draft — found by the adopter-persona review of PR #73, verified from
  a packed install.
- **Deferred:** none
- **Found:** 2026-08-21, customer review of the `crossProject` rename.

## Symptom

`crossProject`, `CrossProjectBuilder`, `byName`, `byArg` and `byPropertyNames`
are all exported from `packages/ts/src/index.ts`. Across the whole `docs/` tree
they appeared in exactly one place: the deprecation callout at the top of
[`docs/cross-layer.md`](../../docs/cross-layer.md) — the page for the API
`crossProject` supersedes.

So the discovery path for an adopter was: read the API reference → find
`crossLayer` → follow the sidebar to "Cross-Layer Validation" → be told on
arrival that the thing you just looked up is deprecated and you should use
something the reference never mentioned.

**Partly closed in PR #73:** `docs/api-reference.md` now carries rows for
`crossProject` and `CrossProjectBuilder`. What remains is below.

## What remains

### 1. No page, no sidebar entry, no worked example

`crossLayer` has a full guide page. `crossProject` has two table rows. There is
no page teaching `.side(name, source, keyFn)` ×2 → `.beComplete()` /
`.haveNoOrphans()` / `.beBijective()`, and no sidebar entry to reach one.

### 2. `crossLayer` carries no `@deprecated` tag in source

Measured: `grep -rn '@deprecated' packages/ts/src/` lists tags on
`function-rule-builder.ts:411`, `type-rule-builder.ts:164`,
`module-rule-builder.ts:183,191` and `class-rule-builder.ts:273` — the
convention exists and is used. `crossLayer` is not among them, while
`docs/cross-layer.md` announces it as superseded.

Published `@nielspeter/ts-archunit@0.61.0` **did** carry one, reading
`@deprecated Superseded by the kernel correspondence() primitive` — which now
points at the wrong successor (the kernel's `correspondence` is a different API;
the successor is `crossProject`). So an adopter on the heritage package gets IDE
strikethrough naming the wrong replacement, and on upgrade to eess-ts the
strikethrough silently disappears while the docs still say deprecated.

`check:docs-code`'s `@typescript-eslint/no-deprecated` pass is green here
because the tag is absent, not because the API is current.

### 3. "direct replacement" is not accurate

`docs/cross-layer.md` says `crossProject(p)` "is the direct replacement for
`crossLayer()`". Reading both APIs:

- `crossLayer` pairs **files** by a mapping predicate, then runs **pair
  conditions** — `haveMatchingCounterpart`, `haveConsistentExports`,
  `satisfyPairCondition`.
- `crossProject` compares **key sets**; its terminals are `.beComplete()` /
  `.haveNoOrphans()` / `.beBijective()`.

There is no `crossProject` equivalent for `haveConsistentExports` (compare the
exported symbol names of two paired files). For a user on that condition,
`.layer(name, glob).mapping(fn).forEachPair()` → `.side(name, source, keyFn)
.beComplete()` is a rewrite, not a rename, and the page carries no migration
snippet.

## Why this is a bug and not a docs chore

Adding `@deprecated` to `crossLayer` is not free: `check:docs-code` runs
`@typescript-eslint/no-deprecated`, so the tag reds every doc fence and source
site still using `crossLayer` — which is the point, but it means the tag and the
migration guidance have to land together. And the tag cannot be written until
finding 3 is settled, because the tag has to name a successor and `crossProject`
is not a successor for every `crossLayer` use.

## Fix

Not decided. The ordering is forced by the above: settle 3, then 2, then 1.

## Verification

- [ ] `docs/` carries a `crossProject` page reachable from the sidebar, with a
      worked example that compiles under `check:docs-code`.
- [ ] `crossLayer` carries an `@deprecated` tag naming the correct successor,
      and `check:docs-code` is green with it — meaning every remaining use is
      either migrated or explicitly exempted.
- [ ] `docs/cross-layer.md` no longer claims a direct replacement for the
      `haveConsistentExports` path, or `crossProject` grows one.
