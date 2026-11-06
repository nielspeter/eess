# Bug 0629: a non-vacuity row blames its rule when the CLI is missing

## Status

- **State:** Draft — read from the source 2026-11-06 by the enforcement re-check of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build, and seen the
  same day when `node_modules/.bin/eess-mermaid` was missing from a local install; no red test yet.
- **Severity:** Low — fails closed: the row reports FAILED. But its message sends the reader to the
  rule, not to the install.
- **Origin:** self-found · the enforcement re-check of
  [plan 0624](../plans/completed/0624-md-one-documents-field-value-public.md)'s build, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

`sh()` (`scripts/check-nonvacuity.mjs:482`) returns `{ code: 2, out: <the spawn error> }` when the
binary it starts does not exist, for example `node_modules/.bin/eess-ts`
(`scripts/check-nonvacuity.mjs:264`) after an install that did not link the workspace bins. A row
such as `arch/md-one-field-reading` then checks `code === 1` and whether its rule fired, sees
neither, and prints `FAILED (did not fail on violating input) · … did not fire`. The spawn error,
which names the missing file, is not printed.

## Root cause

The rows read only the exit code and the findings; a harness error (code 2 from a spawn failure) is
not told apart from a rule that stayed green.

## Fix

Not designed. One place, in `sh()` or where a row's result is printed, that reports a spawn
failure as a harness error naming the missing binary and the remedy (`npm ci` after a build, so the
workspace bins link), not as the rule's failure.

## Verification

- [ ] Red first: with the `eess-ts` path pointing at a missing file, a row's output names the
      missing binary.
- [ ] A row whose rule genuinely stays green still says "did not fire".
- [ ] `npm run validate` green.

Deferred: none
