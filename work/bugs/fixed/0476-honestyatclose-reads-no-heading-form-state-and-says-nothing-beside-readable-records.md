# Bug 0476: `honestyAtClose` reads no heading-form state, and says nothing when other records are readable

## Status

- **State:** Fixed — 2026-10-18, in the batch-2 pull request.
- **Severity:** Medium — a silent pass. Adopter 3 writes most of its records with a `## Status:`
  heading, and about 1,000 of them get no state read and no finding.
- **Origin:** self-found · PR #236's verification, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`honestyAtClose` reads a state line in the label grammar (`**State:**`, `State:`, a bullet), never a
heading such as `## Status: Done`. [Bug 0444](./0444-honesty-at-close-reads-state-only-and-says-nothing.md)'s two new findings cover a state the preset cannot read:

- `ledger/no-readable-state` fires only when no record in the call has a state line;
- `ledger/state-under-another-label` looks at labels, not headings.

So in a call where some records are readable and others write a heading, the heading records get no
placement check and nothing says so. Passing `label: 'Status'` does not help, because the heading form
is not a label form.

## Fix

Either read the heading form as a caller-named form, which is the shape [plan 0468](../../plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md) plans for
`fields()` (`heading`), or report a record whose header has a `## <label>: <vocabulary value>`
heading and no readable state, as `ledger/state-under-another-label` does for labels. The preset's
rebuild on public blocks ([proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md), the second Review's decision 1) is the natural home.

## Resolution

A state written as a heading is read. `## Status: Done` in a record's header is read under the labels
in force, as a label line is, and a value outside the vocabulary (`## Status: Shipped`) is reported
as an unknown state, as a label line's is. The header follows [plan 0468](../../plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md)'s rule: a `## Label: value`
heading continues it rather than ending it, so `## Severity: High` followed by `## Status: Done` is
read. Only `##` headings count.

A `## Label: value` heading under a label not in force is reported as
`ledger/state-under-another-label`, but only when its whole value is a state word. `## Status: Done`
is reported. `## Background: Open questions` is not, because a heading shaped like a field is common
prose.

A field-shaped heading continues the header only before the first plain section heading. After it,
`## Option A: Keep` is body, so a state under it is an option's, not the record's.

Under a label in force, a heading's value is matched from its start, as a label line's is:
`## Status: Done (2026-10-01)` reads `Done`. `## State: of the art` now reports an unknown state where
it used to be skipped as a heading. That fails closed.

Not measured: how many of the adopter's heading-form records this reads. That is the adopter's to
run on upgrade.

## Verification

- [x] Red first: a call with one `State:` record and a `## Status: Done` record gave no finding on the second (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`, the heading rows).
- [x] Green: with `label: 'Status'` the heading record is read and checked; a heading after `## Severity:` is read; an out-of-vocabulary heading is reported; with defaults a state heading under another label is reported and a prose heading is not. Switching off the heading read turned its row red (measured by hand, 2026-10-18).

Deferred: none
