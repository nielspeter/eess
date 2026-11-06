# Bug 0627: a state under another label beside a read one is never compared

## Status

- **State:** Fixed — 2026-11-06 on `fix/0627-state-under-another-label`. A state word under another
  label in the header that disagrees with the read state is `ledger/states-disagree`, naming both
  lines. Measured 2026-11-06 by the enforcement review of
  [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix, on `fix/0623-two-states`
  (eess-md 0.14.0 plus that fix).
- **Severity:** High — a false green: `honestyAtClose` passes a live record that also says it is done,
  under a label the preset does not read.
- **Origin:** self-found · the enforcement review of
  [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix, 2026-11-06.
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
([bug 0444](./0444-honesty-at-close-reads-state-only-and-says-nothing.md),
[bug 0476](./0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md)).
It predates [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md)'s fix and is the same false-green class under another label.

## Root cause

`stateUnderAnotherLabel` runs only when no state line under the labels in force was read
(`packages/md/src/rules/ledger.ts:785`, after the fix), so a record that has one is never checked for a state word
written under another label.

## Fix

A state word under another label beside a read state that disagrees with it is a finding, as two
disagreeing lines under one label are since [bug 0623](./0623-the-ledger-reads-the-first-of-two-states.md); one that agrees, or a value
that is not a state word, is not.

`headerStateViolation` (`packages/md/src/rules/ledger.ts:569`) reads every state word under another
label in the header (`statesUnderAnotherLabel`, which now collects them all, where
`stateUnderAnotherLabel` kept the first) and reports the first that disagrees with the read state as
`ledger/states-disagree`, at that line, after the unknown-state check and before the folder check.
The message names both lines; the remedy is to keep one if the other label is the state (aliasing
it), or to reword the line if it is not.

Measured on this repo's own corpus (558 records): the first version reported three closed records,
each a dated history line continuing the State bullet (`  Previously read: Ready — frozen …`), a
plain label on an indented line that is no list item. Those are prose, so the comparison skips them;
headings, wrapped labels, and a plain label at the start of a line or as its own list item still
count. After that, 0 findings. The path that runs when no state is read reads such a continuation
line too; that is [bug 0630](../0630-a-history-line-is-read-as-a-state-under-another-label.md),
recorded, not fixed here.

## Verification

- [x] Red first: the record above is reported
      (`packages/md/tests/rules/ledger-state-beside-another-label.test.ts`; 4 of 10 red before the
      fix, the 6 quiet ones already quiet).
- [x] `**State:** Done` beside `## Status: Done` is not.
- [x] A `Status:` value that is no state word is not.
- [x] A history line continuing the State bullet is not; a plain label opening a line or a list item
      is.
- [x] A changeset naming `@nielspeter/eess-md`, the break marked.
- [x] `npm run validate` green.

Deferred: none
