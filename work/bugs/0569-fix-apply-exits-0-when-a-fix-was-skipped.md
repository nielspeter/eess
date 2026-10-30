# Bug 0569: `eess-ts check --fix --apply` exits 0 when a fix was skipped

## Status

- **State:** Draft — found by PR #283's testing review, 2026-10-30, by reading the code; no red
  test yet.
- **Severity:** Medium — an honesty gap: a violation whose fix was not applied leaves the run
  green; the skip is printed, but the exit code does not count it.
- **Origin:** self-found · PR #283's testing review.
- **Reported:** 2026-10-30

## Symptom

After applying fixes, `runFix` exits with the number of violations that carry no fix:
`const remaining = all.filter((v) => v.fix === undefined)` and `return Math.min(remaining.length,
255)` (`packages/ts/src/cli/commands/check.ts:471`, `:479`). A violation whose fix `applyFixes`
skipped as overlapping carries a fix, so it is not in `remaining`: the file still holds the
defect, the run prints `N fix(es) skipped (overlapping — resolve manually)`, and it exits 0.

## Fix

Count a violation whose fix was not applied (skipped, or every edit equal to it skipped) as
remaining, so the exit code is red until each finding is cured or fixed.

## Verification

- [ ] Red test written first: two overlapping, differing fixes under `--fix --apply` exit
      non-zero. Today the exit is 0.
- [ ] A run whose fixes all apply still exits 0.
- [ ] A changeset naming `@nielspeter/eess-ts`.
- [ ] `npm run validate` green.

Deferred: none
