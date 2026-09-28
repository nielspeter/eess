# Bug 0353: PathUniverse and viewsFor are one dialect's vocabulary in the kernel, and every new view costs six package bumps

## Status

- **State:** Draft — measured, with the release cost of two comparable changes as
  the evidence.
- **Severity:** Medium — **no defect in behaviour.** It is a placement cost, paid
  in adopter-visible releases and in a kernel that names a TypeScript build file in
  its public type.
- **Origin:** architecture and product review of
  [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md),
  found independently by two lenses.
- **Reported:** 2026-09-28

## Symptom

The cost, measured against the directly comparable predecessor — same defect class,
one path view added:

|                           | 0339              | 0348  |
| ------------------------- | ----------------- | ----- |
| packages in the changeset | **1** (`eess-ts`) | **6** |

The whole difference is where the type lives. An `eess-md` adopter takes a minor
bump and a CHANGELOG entry about tsconfig roots and picomatch's `dot: false`, for a
type they cannot reach.

## Root cause

`PathUniverse` is a kernel public type (`packages/core/src/index.ts:37`),
materialized in exactly one dialect (`packages/ts/src/core/path-universe.ts`) and
read by exactly one caller (`packages/ts/src/core/glob-evaluator.ts`). Measured:
`PathUniverse`, `viewsFor`, `isDeadSite` and `GlobSite` have **zero** hits across
`packages/{md,mermaid,gherkin,crossvalidate}/src`.

Its field names are eess-ts vocabulary: `tsconfigRelative*`, and since 0348
`repoRelative*`. `viewsFor` is a short array-literal dispatch that now also takes
the dialect's policy answer as a required boolean.

The placement is justified at `packages/core/src/index.ts:33-36` as ADR-011's
requirement that a public signature be nameable without reaching into family
plumbing — but `eess-ts` already re-exports the type. It declared its own copy until
plan 0188 measured a 100%-identical pair; the right resolution of a 100%-identical
pair with one consumer is arguably to delete the unused copy, not to promote it.

## Fix

Not decided. Two shapes, and the choice is a product decision about where the family
line sits:

1. **Make the kernel stop naming roots.** `PathUniverse` holds
   `fileViews: readonly (readonly string[])[]` and `parentDirViews`, in the
   matcher's own precedence order, assembled by the dialect. `viewsFor` degenerates
   to "is this a path kind". Adding a fourth view then costs zero kernel files.
2. **Move `PathUniverse` and `viewsFor` to `eess-ts`,** where their only consumer is.

The type is already asking for the first. `packages/core/tests/path-universe.test.ts`
· `it('every declared view of a kind is returned, so a new one cannot be forgotten')`
checks completeness by introspecting field **names** by substring — a test that has
to do that is the interface saying it wants to be a list. (It also fails open: name
the next field `repoRelativeSourcePaths` and the guard silently stops guarding.)

## Related

- [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — the change that produced the six-package changeset.
- [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) — the clause the
  current placement appeals to.

## Verification

- [x] measured: zero `PathUniverse`/`viewsFor` hits outside `core` and `ts`; the
      one-versus-six changeset comparison.
- [ ] a ruling on which shape, taken as a product decision
- [ ] the move or the reshape, with the kernel break declared
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
