# Bug 0488: a finding about a record's content is labelled `configuration`

## Status

- **State:** Draft — recorded 2026-10-18 from PR #243's architecture review.
- **Severity:** Low — the build fails either way; the label sends an agent to edit the rule when the
  fix is in a record.
- **Origin:** self-found · PR #243's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`--format json` derives `kind: 'configuration'` from `bypassFilters`
(`packages/core/src/format-json.ts:55`), whose documented meaning is "the rule enforces nothing, so
editing the code cannot clear it". [Plan 0454](../plans/completed/0454-box-marks-are-the-callers.md)'s unread box mark and [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s undecided subject are
unsuppressable for a different reason: they are about what the instrument could not read in a
record, and the fix is in the record. Both are labelled `configuration`.

## Fix

A third value, or a separate field, for an unsuppressable finding whose remedy is in the data.
`kind`'s own comment already says an unrecognised value is read as `'violation'`, so widening it is
additive.

## Verification

- [ ] Red first: an undecided finding and an unread-box finding come out as `kind: 'configuration'`
- [ ] Green: each carries the new value; configuration findings are unchanged

Deferred: none
