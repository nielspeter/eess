# Bug 0195: `crossProject` ships as a public API with no documentation

## Status

- **State:** Fixed — `docs/cross-project.md` ships, reachable from the sidebar, with
  compiled examples and a migration table; `crossLayer` carries an `@deprecated` tag
  naming the successor; and finding 3's open design question is settled by
  measurement.
- **Priority:** High. Raised from Medium on review of PR #74: this **blocks**
  [bug 0198](./0198-no-migration-path-from-ts-archunit.md), the release blocker
  for retiring `@nielspeter/ts-archunit`. The rename is the one API change a
  migrator must make, and finding 3 below — whether `crossProject` replaces
  `crossLayer` at all — must be settled before the migration page can be
  written honestly.
- **Deferred:** none
- **Found:** 2026-08-21, customer review of the `crossProject` rename.

## Symptom

`crossProject`, `CrossProjectBuilder`, `byName`, `byArg` and `byPropertyNames`
are all exported from `packages/ts/src/index.ts`. Across the whole `docs/` tree
they appeared in exactly one place: the deprecation callout at the top of
[`docs/cross-layer.md`](../../../docs/cross-layer.md) — the page for the API
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

### 3. "direct replacement" — SETTLED 2026-08-22, and this record had it wrong

`docs/cross-layer.md` says `crossProject(p)` "is the direct replacement for
`crossLayer()`". The first version of this finding said that was false, because
_"there is no `crossProject` equivalent for `haveConsistentExports`"_.

**Measured: there is.** `KeyFn` is
`(subject: T) => string | readonly string[]` — it may return an **array**, so one
file expands into one key per exported symbol, and the file pairing folds into the
key prefix:

```ts
const pairName = (base: string): string => base.replace(/-service\.ts$/, '')

crossProject(p)
  .side('services', modules(p).that().resideInFolder('src/services'), (m) =>
    m.getExportSymbols().map((s) => `${pairName(basename(m.getFilePath()))}::${s.getName()}`),
  )
  .side('domain', modules(p).that().resideInFolder('src/domain'), (m) =>
    m.getExportSymbols().map((s) => `${pairName(basename(m.getFilePath()))}::${s.getName()}`),
  )
  .haveNoOrphans()
```

Run against this repo's own fixtures it reports
`domain "domain.ts::User" has no matching services` — the same class of finding
`haveConsistentExports` produces.

**And then the correction over-corrected, which review caught.** Saying
`crossProject` replaces _every_ `crossLayer` use, with attribution as the only loss,
generalised one measurement of one shape. Three exceptions are real:

1. **`.mapping(fn)` is an arbitrary relation.** `computePairs` filters the full
   Cartesian product by the caller's predicate. A key join expresses only
   `key(a) === key(b)` with each key derived independently, so a non-separable
   relation — prefix matching, directory nesting, "imports its schema" — has **no
   key encoding at all**.
2. **`satisfyPairCondition` returns a fully-constructed `ArchViolation`**, so its
   author controls `severity`, `identity`, and `measured`/`metricUnit`.
   `crossProject` builds findings through `baseViolation` and exposes none of those:
   a pair condition emitting a metric finding, which feeds the baseline's numeric
   ratchet, has no equivalent. That is a **capability** gap, not attribution.
3. **Three or more layers.** `crossProject` takes exactly two sides; a chain becomes
   N−1 rules.

So the honest statement, and the one the page and the `@deprecated` tag now carry:
`crossProject` supersedes `crossLayer` **for pairings that are key equality**, which
is most of them — and `crossLayer` is retained for the rest.

**What genuinely degrades is attribution, and the migration page must say so.**
`haveConsistentExports` reports `element: pair.left.getBaseName()` with the message
_Symbol "X" in "a.ts" (left) has no counterpart in "b.ts" (right)_. The
`crossProject` form reports `element: 'SourceFile'` and puts the composite key in
the message. The information survives; the `element` field stops being useful, and
a reader scanning elements loses the file name.

It is a **rewrite, not a rename** — the pairing moves from `.mapping(fn)` into the
key function — but it is not a capability gap, and the page can carry a working
snippet rather than an apology.

## Why this is a bug and not a docs chore

Adding `@deprecated` to `crossLayer` is not free: `check:docs-code` runs
`@typescript-eslint/no-deprecated`, so the tag reds every doc fence and source
site still using `crossLayer` — which is the point, but it means the tag and the
migration guidance have to land together.

The tag also could not be written until finding 3 was settled, because it has to
name a successor. **That is now settled**: `crossProject` is the successor for
every `crossLayer` use, with an attribution caveat rather than a capability gap.

## Fix

The ordering the first version of this record set — settle 3, then 2, then 1 — was
right, and 3 is now settled. Remaining: the page (1) and the `@deprecated` tag (2),
which must land together with the migration snippet the tag points at.

## Verification

- [x] `docs/` carries `cross-project.md`, reachable from the sidebar (placed above
      the API it supersedes), with **three** worked examples that compile under
      `check:docs-code` — the fence count went 44 → 47.
- [x] `crossLayer` carries an `@deprecated` tag naming `crossProject` as the
      successor, warning that it is a rewrite rather than a rename, and pointing at
      the migration section. `check:docs-code` is green with it, and
      `npm run validate` exits 0 across 3557 tests.
- [x] `docs/cross-layer.md`'s callout no longer claims a _direct_ replacement. It
      says "replaces every `crossLayer()` use", calls it a rewrite, and links the
      migration table.
- [x] The rest of the exported surface this record's Symptom named — `byName`,
      `byArg`, `byPropertyNames`, `KeyFn`, `KeysSource` — is in
      `docs/api-reference.md`, under a `## Cross-Project Validation` section of its
      own rather than inside the deprecated API's. Caught on review: all four
      verification boxes were ticked while the Symptom's own list was undisposed,
      and `check:ledger` reads checkboxes, not the Symptom.
- [x] **The discovery paths, which are this record's actual Symptom.** The first fix
      added a page and stopped there, leaving three of the four doors pointing at the
      deprecated API: `api-reference.md` had `crossProject` inside a
      `## Cross-Layer Validation` section that closed by linking `/cross-layer`;
      `core-concepts.md`'s Entry Points table — the canonical list of what exists —
      had no row; and `what-to-check.md` taught `crossLayer` as _the_ way to do the
      same job with no note. All three now route to the current API.
- [x] Finding 3 settled by measurement rather than argument — see above. The claim
      that `haveConsistentExports` had no equivalent was **false**.

**What the `@deprecated` tag actually covers, stated because the green is narrower
than it looks.** `check:docs-code`'s `no-deprecated` pass only sees **import-bearing**
fences. Measured: six fences use `crossLayer(`, and five of them carry no
`@nielspeter` import — they are continuation fragments referencing an earlier
fence's imports — so the extractor never picks them up. The sixth is checked and
deliberately skip-directive'd, because `docs/cross-layer.md` documents the
deprecated API on purpose.

So the tag reds nothing in docs today, and that is correct behaviour rather than a
hole in this fix: sabotage-verified that the rule fires (a probe fence importing
`crossLayer` reddened the gate immediately). The residue worth knowing is that
`no-deprecated` coverage over `docs/` is bounded to 47 of ~350 fences by design.
