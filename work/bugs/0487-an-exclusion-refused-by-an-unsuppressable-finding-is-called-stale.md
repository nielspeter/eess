# Bug 0487: an exclusion refused by an unsuppressable finding is called stale

## Status

- **State:** Draft — recorded 2026-10-18 from PR #243's enforcement review; not yet reproduced.
- **Severity:** Low — the finding still fails the build; the warning beside it sends the author the
  wrong way.
- **Origin:** self-found · PR #243's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`.excluding('<pattern>')` that names a finding carrying `bypassFilters` is refused, correctly, but the
rule also prints `[eess] Unused exclusion '<pattern>' … It matched zero violations — it may be stale
after a rename.` (`packages/core/src/execute-rule.ts:89`, and its eess-ts copy at
`packages/ts/src/core/execute-rule.ts:214`). The exclusion did match; it was refused. An author told
it is stale renames or deletes it and learns nothing about why the finding stays.

## Fix

Count a pattern that matched a `bypassFilters` finding as matched-and-refused, and say that instead:
the finding cannot be suppressed (`UNSUPPRESSABLE`).

## Verification

- [ ] Red first: an exclusion naming an unsuppressable finding prints the "stale" warning
- [ ] Green: it prints that the exclusion was refused, in both copies

Deferred: none
