# Bug 0627: a state under another label beside a read one is never compared

## Status

- **State:** Draft — measured 2026-11-06 by the enforcement review of
  [bug 0623](./fixed/0623-the-ledger-reads-the-first-of-two-states.md)'s fix, on
  `fix/0623-two-states` (eess-md 0.14.0 plus that fix); no red test yet.
- **Severity:** High — a false green: `honestyAtClose` passes a live record that also says it is done,
  under a label the preset does not read.
- **Origin:** self-found · the enforcement review of
  [bug 0623](./fixed/0623-the-ledger-reads-the-first-of-two-states.md)'s fix, 2026-11-06.
- **Reported:** 2026-11-06

## Symptom

A live plan with the default labels (`State`):

```markdown
# Plan 9

**State:** Draft

## Status: Done

## Tasks

- [ ] an open box
```

`honestyAtClose` returns no finding: the record is read as a live draft by its `State:` line, and the
`## Status: Done` heading, a state word under a label the preset does not read, is never looked at.
Without the `State:` line, the same heading is reported as `ledger/state-under-another-label`
([bug 0444](./fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md),
[bug 0476](./fixed/0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md)).
It predates [bug 0623](./fixed/0623-the-ledger-reads-the-first-of-two-states.md)'s fix and is the same false-green class under another label.

## Root cause

`stateUnderAnotherLabel` runs only when no state line under the labels in force was read
(`packages/md/src/rules/ledger.ts:741`), so a record that has one is never checked for a state word
written under another label.

## Fix

Not designed. A state word under another label beside a read state that disagrees with it is a
finding, as two disagreeing lines under one label are since [bug 0623](./fixed/0623-the-ledger-reads-the-first-of-two-states.md); one that agrees, or a value
that is not a state word, is not. The fix measures a corpus that writes `Status:` deliberately beside
`State:` (two fields, two meanings), where this must stay quiet unless the values are state words that
disagree.

## Verification

- [ ] Red first: the record above is reported.
- [ ] `**State:** Done` beside `## Status: Done` is not.
- [ ] A `Status:` value that is no state word is not.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
