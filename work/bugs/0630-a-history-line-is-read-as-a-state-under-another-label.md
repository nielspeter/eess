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

`stateUnderAnotherLabel` (`packages/md/src/rules/ledger.ts:321`) reads a plain `Label:` on any line
of the header, indented or not (`PLAIN_LABEL` allows leading whitespace). The fix of
[bug 0627](./fixed/0627-a-state-under-another-label-beside-a-read-one-is-never-compared.md) skips
such a continuation line when it compares a second label with a read state; the path that runs when
no state is read still takes it.

## Fix

Not designed. Skip a plain label on an indented line that is no list item in this path too, as the
comparison does, and say what the record lacks (no state line) without naming the prose line as its
state.

## Verification

- [ ] Red first: the record above is reported as having no state line, not as a state under
      `Previously read:`.
- [ ] A plain `Status: Done` at the start of a line, or as its own list item, is still reported.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
