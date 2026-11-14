# Bug 0653: the merge drops the undecided count

## Status

- **State:** Draft — found 2026-11-14 while drafting
  [plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md), after
  [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s review (the architect
  lens) found one empty-source helper dropping it; no change yet.
- **Severity:** Low — no false green known. A merged receipt carries no `undecided` count, so a
  reader of the receipt (a gate's summary, the terminal's checks that read it) sees none.
- **Origin:** self-found · reading `mergeCollectResults` for [plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md), 2026-11-14.
- **Reported:** 2026-11-14

## Symptom

`collectResult` carries an `undecided` count (`packages/core/src/collect-result.ts:102-104`), which
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s builders set when a
subject could not be judged. `mergeCollectResults` (`packages/core/src/collect-result.ts:132-240`)
builds its result on every path from `examined`, `sourceEmpty` and `declaredEmpty` only, so a
member's `undecided` count never reaches the merged receipt.

Not yet measured: which merged receipts in the family carry an `undecided` member today, and
whether any reader acts on the merged count.

## Fix

Not designed. Summing `undecided` over the members, as `examined` is summed, is the obvious
candidate. [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7 lists the merge's rules, so the change is a stated addition to that list.

## Verification

- [ ] Red first: merging a member with `undecided: 1` and one with `examined: 2` keeps
      `undecided: 1`.
