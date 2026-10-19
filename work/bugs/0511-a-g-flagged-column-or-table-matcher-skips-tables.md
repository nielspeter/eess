# Bug 0511: a `g`- or `y`-flagged column or table matcher skips tables

## Status

- **State:** Draft — recorded 2026-10-19 during bug 0506's crossvalidate half; read from the code,
  not reproduced.
- **Severity:** Medium — bug 0506's class on other paths: a stateful `RegExp` drops tables in
  selector position, so a rule can be green on tables it never examined. It needs the caller to pass
  a `g` or `y` flag, which nothing refuses.
- **Origin:** self-found · bug 0506's build
- **Reported:** 2026-10-19

## Symptom

Each of these calls `.test()` on a caller's `RegExp` as given, across tables and documents:

- `packages/md/src/conditions/structure.ts:42`, a `haveTable({ columns })` column matcher;
- `packages/md/src/model/rows.ts:43` and `:52`, `rows()`'s column matchers;
- `packages/crossvalidate/src/md-ts.ts:61` and `:64`, `adrCitationsResolve`'s `mechanismColumn`;
- `packages/crossvalidate/src/md-mermaid-er.ts:138`, `:139`, `:152` and `:157`, the ER binding's
  table `section`, `name` and column matchers.

With `g` or `y`, a match moves `lastIndex`, and the next header or heading is tested from there, as
bug 0506 measured for section names.

## Root cause

Bug 0506's: the caller's `RegExp` is reused without removing `g` and `y`.

## Fix

Strip `g` and `y` once, where each option is read, from one owner shared with bug 0506's matcher
(plan 0496 makes md's non-global). Each path needs its red test first.

## Verification

- [ ] Red test written first, per path: a `g`-flagged matcher over tables in several documents
      examines every one.
- [ ] `npm run validate` green.

Deferred: none
