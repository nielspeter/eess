# Bug 0511: a `g`- or `y`-flagged column or table matcher skips tables

## Status

- **State:** Draft — recorded 2026-10-19 during [bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s crossvalidate half; read from the code,
  not reproduced.
- **Severity:** Medium — [bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s class on other paths: a stateful `RegExp` drops tables in
  selector position, so a rule can be green on tables it never examined. It needs the caller to pass
  a `g` or `y` flag, which nothing refuses.
- **Origin:** self-found · [bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s build
- **Reported:** 2026-10-19

## Symptom

Each of these calls `.test()` on a caller's `RegExp` as given, across tables and documents:

- `packages/md/src/conditions/structure.ts:42`, a `haveTable({ columns })` column matcher;
- `packages/md/src/model/rows.ts:43` and `:52`, `rows()`'s column matchers;
- `packages/crossvalidate/src/md-ts.ts:70` and `:73`, `adrCitationsResolve`'s `mechanismColumn`;
- `packages/crossvalidate/src/md-mermaid-er.ts:138`, `:139`, `:152` and `:157`, the ER binding's
  table `section`, `name` and column matchers.

With `g` or `y`, a match moves `lastIndex`, and the next header or heading is tested from there, as
[bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md) measured for section names.

One more, added 2026-10-19 from PR #251's architecture verify (M3): `terms()` already makes a
non-global copy of its `label` (`packages/md/src/builders/vocabulary.ts:126`), but strips only `g`
(`flags.replace(/g/g, '')`), so a `y`-flagged label stays stateful across lines. The shared helper
this bug owns strips both, and replaces that copy too.

## Root cause

[Bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s: the caller's `RegExp` is reused without removing `g` and `y`.

## Fix

Strip `g` and `y` once, where each option is read, through one shared non-global helper. This bug
owns that helper: one function on `@nielspeter/eess-md/internal` that every caller-supplied matcher
in eess-md and eess-crossvalidate is read through, replacing md's `matchName` copy ([plan 0496](../plans/completed/0496-sections-as-elements.md) makes
it non-global) and crossvalidate's `nonGlobal` ([bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s crossvalidate half). [Bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s "one
matcher for both packages" box is deferred here. Each path needs its red test first.

## Verification

- [ ] Red test written first, per path: a `g`-flagged matcher over tables in several documents
      examines every one.
- [ ] One shared non-global helper on `@nielspeter/eess-md/internal`; md's `matchName` and
      crossvalidate's `nonGlobal` read through it, closing [bug 0506](./fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s last box.
- [ ] `npm run validate` green.

Deferred: none
