# Bug 0179: adopted doc tests resolve the repo root one level short

## Status

- **State:** Draft — reproduced; blocks `npm run validate` on this branch.
- **Found:** 2026-08-20, running the full gate chain during the fold-audit
  review. Both enforcement reviewers observed the failures and classified them as
  "pre-existing", which is true of the branch but not of `main`.
- **Severity:** **merge blocker.** `npm run validate` is red.

## Symptom

27 tests across 12 files fail, every one of them because the repository root is
resolved from a single-package layout that this monorepo does not have.

```
$ npm run validate
 Test Files  12 failed | 253 passed (265)
      Tests  27 failed | 3499 passed (3526)
```

```
Error: ENOENT: no such file or directory, open
  '/…/eess/packages/ts/docs/upgrading.md'
     22| const repoRoot = path.resolve(import.meta.dirname, '../..')
```

`docs/` is at the monorepo root. From `packages/ts/tests/docs/`, `'../..'` is
`packages/ts`.

## Not pre-existing on `main`

```
$ git ls-tree --name-only main packages/ts/tests/docs/ | wc -l
0
```

None of these files exists on `main`. They arrived with this branch's
ts-archunit corpus adoption, which is the branch's declared purpose — so this is
the adoption half-landed, not inherited debt. `main` is green; this branch is not.

## Root cause

The tests come from `ts-archunit`, a single-package repository where
`tests/<area>/../..` **was** the repo root. Under `packages/ts/` it is the
package root, one level short.

It is not a uniform off-by-one, which is why this needs doing rather than
sed-ing. Each file wants a different real root:

| file                                                                                                            | resolves to                   | wants                                   |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| `docs/upgrading.test.ts`                                                                                        | `packages/ts`                 | repo root                               |
| `docs/cross-document-links-resolve.test.ts`                                                                     | `packages/ts`                 | repo root                               |
| `docs/preset-ids-in-docs-exist.test.ts`                                                                         | `packages/ts`                 | repo root                               |
| `docs/upgrade-rows-name-their-presets.test.ts`                                                                  | `packages/ts`                 | repo root                               |
| `docs/shipped-links.test.ts`                                                                                    | `packages/ts`                 | **package root — may already be right** |
| `docs/doc-globs-are-anchored.test.ts`                                                                           | `packages/ts/docs`            | `docs/`                                 |
| `docs/doctor-is-not-experimental.test.ts`                                                                       | `packages/ts/docs`            | `docs/`                                 |
| `docs/completed-plans-are-marked-done.test.ts`                                                                  | `packages/ts/plans/completed` | `work/plans/completed`                  |
| `docs/every-plan-declares-its-blast-radius.test.ts`                                                             | `packages/ts/plans`           | `work/plans`                            |
| `docs/deprecation.test.ts` · `tools/scan-cardinality-assertions.test.ts` · `release/version-bump-guard.test.ts` | mixed                         | —                                       |

`docs/jsdoc-blocks-are-intact.test.ts` uses `'../../src'`, which IS
`packages/ts/src` and correct — evidence that the right answer is per-file.

## The part that is not bookkeeping

These are **corpus gates**: "every released version has an upgrade row", "no
living doc teaches deprecated API", "every plan declares its blast radius". Once
they can see the real corpus they will assert against 122 documents instead of
zero, and some of them will legitimately go red on genuine drift. Budget for
that: repointing the root is the first half of the job, and the findings it
surfaces are the second.

Until then each one is a gate that **cannot pass**, which is the mirror of the
failure mode this repo exists to prevent — not a false green, but a false red
that trains everyone to ignore the suite.

## Fix

Not built. Repoint each file at its real root, then triage what turns red.

Consider a shared `tests/repo-root.ts` helper rather than 12 hand-written
`path.resolve` calls: the defect is that the root is restated per file, so
restating it correctly 12 times preserves the shape that broke.

## Verification

- [ ] `npm run validate` is green.
- [ ] Each repointed test asserts against a non-zero denominator — a doc gate
      that reads zero documents passes vacuously, which is worse than the
      current honest failure.
- [ ] Anything that turns red for a REAL reason is fixed or filed, not
      re-pointed away.
- [ ] `git ls-tree main` no longer differs — i.e. these ship green.
