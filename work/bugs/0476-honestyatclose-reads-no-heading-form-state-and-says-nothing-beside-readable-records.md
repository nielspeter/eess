# Bug 0476: `honestyAtClose` reads no heading-form state, and says nothing when other records are readable

## Status

- **State:** Draft — recorded 2026-10-18 from PR #236's verification (product). Measured on the PR's
  build; no red test yet.
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

## Verification

- [ ] Red first: a call with one `State:` record and one `## Status: Done` record in a live folder says nothing about the second
- [ ] Green: the second record is read or reported

Deferred: none
