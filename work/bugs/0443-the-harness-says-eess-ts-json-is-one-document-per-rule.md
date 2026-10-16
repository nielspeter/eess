# Bug 0443: the non-vacuity harness says `eess-ts check --format json` prints one document per rule

## Status

- **State:** Draft — recorded 2026-10-16 from the method review of PR #227 (bugs 0441 and 0442).
- **Severity:** Low — comment drift with no runtime effect: the reader it describes accepts one
  document as well as several.
- **Origin:** self-found · PR review, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

The doc comment on `violationsOf` (`scripts/check-nonvacuity.mjs:458`) says `eess-ts check --format
json` "emits ONE pretty-printed document per failing rule, concatenated". It emits one document
however many rules fail: `packages/ts/src/cli/commands/check.ts:256` ("json always emits one
document"), and PR #227's method review measured two failing rules in one document that
`JSON.parse` accepts. A reader who trusts the comment takes several documents for the family's
convention, which is how bug 0441's first draft came to recommend it.

## Fix

Correct the comment, and say why the reader still accepts a stream (other gates' outputs, such as
bug 0441's, may print more than one).

## Verification

- [ ] Comment corrected

Deferred: none
