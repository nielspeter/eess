# Bug 0476: `honestyAtClose` reads no heading-form state, and says nothing when other records are readable

## Status

- **State:** Fixed — 2026-10-18, in the batch-2 pull request.
- **Severity:** Medium — a silent pass. Adopter 3 writes most of its records with a `## Status:`
  heading, and about 1,000 of them get no state read and no finding.
- **Origin:** self-found · PR #236's verification, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`honestyAtClose` reads a state line in the label grammar (`**State:**`, `State:`, a bullet), never a
heading such as `## Status: Done`. Bug 0444's two new findings cover a state the preset cannot read:

- `ledger/no-readable-state` fires only when no record in the call has a state line;
- `ledger/state-under-another-label` looks at labels, not headings.

So in a call where some records are readable and others write a heading, the heading records get no
placement check and nothing says so. Passing `label: 'Status'` does not help, because the heading form
is not a label form.

## Fix

Either read the heading form as a caller-named form, which is the shape plan 0468 plans for
`fields()` (`heading`), or report a record whose header has a `## <label>: <vocabulary value>`
heading and no readable state, as `ledger/state-under-another-label` does for labels. The preset's
rebuild on public blocks (proposal 017, the second Review's decision 1) is the natural home.

## Resolution

The heading form is read. A record whose first section's heading is its state, such as
`## Status: Done`, is read under the labels in force, as a label line is. One adopter writes most of
its records this way, so it passes `label: 'Status'` and they are checked. Only a value from the
vocabulary counts, so `## Status at a glance` and `## State: of the art` stay headings. A heading under
a label not in force is reported as `ledger/state-under-another-label`, like a wrapped or plain
label.

The read covers the first section's heading, which is the header region the preset already reads.
A heading-form state further down a record is still not read.

## Verification

- [x] Red first: a call with one `State:` record and a `## Status: Done` record gave no finding on the second (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`, the heading rows).
- [x] Green: with `label: 'Status'` the heading record is read and its folder checked; with defaults it is reported. A sabotage row that switches off the heading read turns its row red.

Deferred: none
