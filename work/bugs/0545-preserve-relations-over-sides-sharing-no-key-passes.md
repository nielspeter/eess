# Bug 0545: `preserveRelations()` over two non-empty sides that share no key passes undeclared

## Status

- **State:** Draft — found 2026-10-22 by PR #258's enforcement review; no red test yet.
- **Severity:** Low — no code in this repo calls `preserveRelations()` outside tests, so nothing live
  is exposed. **A relation check whose keys drifted apart compares nothing and passes.**
- **Origin:** self-found, 2026-10-22, PR #258's enforcement review of
  [bug 0400](./fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md). Recorded rather
  than fixed there: narrowing an exemption amends ADR-010 §3, which is a decision, not part of
  correcting the count.
- **Reported:** 2026-10-22

## Symptom

Two sides that each hold elements but share no key. Bug 0400 made `preserveRelations()` count the
left elements it compared, which is none here, so it now reports `examined` 0 honestly. The zero is
then swallowed: `zeroExaminedFinding` (`packages/core/src/terminal-builder.ts`) returns no finding
when `assertsCardinality()` is true, and `preserveRelations()` is cardinality-exempt. Only
`.expectNonEmpty()` surfaces it, pinned in `packages/core/tests/correspondence.test.ts` (the
`preserveRelations()` tests that expect a `.expectNonEmpty()` message).

The exemption exists for "an empty input is correct". Here the inputs are not empty.

## Fix

Undecided, and it is a decision: either exempt only when the checked sides are empty and fail when
they are not (amends ADR-010 §3), or leave the exemption and say plainly in the docs that
`.expectNonEmpty()` is the only protection. Bug 0400's ADR-010 amendment already says it for one-way
`beComplete()`.

## Verification

- [ ] The decision, written into ADR-010 §3 or the docs.
- [ ] A red test: non-empty sides sharing no key, no declaration, is reported (if the exemption
      narrows).
