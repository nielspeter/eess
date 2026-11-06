# Bug 0630: a history line is read as a state under another label

## Status

- **State:** Draft — measured 2026-11-06 against `packages/md/dist` built from
  `fix/0627-state-under-another-label`; no red test yet.
- **Severity:** Low — fails closed: the record is reported either way, because it has no state line.
  But the finding names a line of prose as the record's state, so its remedy (alias that label) is
  wrong.
- **Origin:** self-found · building the fix of
  [bug 0627](./fixed/0627-a-state-under-another-label-beside-a-read-one-is-never-compared.md),
  2026-11-06.
- **Reported:** 2026-11-06

## Symptom

A live plan with the default labels and no `State:` line:

```markdown
# Plan 9

## Status

- **Owner:** Ann — took it over.
  Previously read: Done — closed early.

- [ ] open
```

`honestyAtClose` reports `ledger/state-under-another-label` at line 6: "its header's `Previously
read:` holds Done, a state from the vocabulary". Line 6 continues the Owner bullet; it is history
written as prose, not a field, and the suggestion to pass `aliases: ['Previously read']` would make
it one.

## Root cause

The no-state path reads `statesUnderAnotherLabel`'s `state` fact
(`packages/md/src/rules/ledger.ts:393`): a value that starts with a state word, on any line of the
header, indented or not (`PLAIN_LABEL` allows leading whitespace). The comparison that
[bug 0627](./fixed/0627-a-state-under-another-label-beside-a-read-one-is-never-compared.md) added reads the same scanner's `whole` and `continuesItem` facts and skips a
plain label continuing a list item; this path does not.

## Fix

Not designed. Filter this path by the scanner's `continuesItem` too, as the comparison does, and say
what the record lacks (no state line) without naming the prose line as its state. Keep this path's
prefix reading: here a value read wide errs toward a finding (`**Status:** Done (merged)` on a record
with no state line is reported today, and a whole-value reading would pass it).

## Verification

- [ ] Red first: the record above is reported as having no state line, not as a state under
      `Previously read:`.
- [ ] A plain `Status: Done` at the start of a line, or as its own list item, is still reported.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
