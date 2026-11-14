# Bug 0653: the merge drops the undecided count

## Status

- **State:** Draft — found 2026-11-14 while drafting
  [plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md), after
  [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s review (the architect
  lens) found one empty-source helper dropping it; no change yet.
- **Severity:** Low — no false green. A merged receipt reports nothing undecided while its own
  violations include the undecided findings. No reader in the repository acts on a merged count
  today: the terminal reads a rule's own receipt before any merge
  (`packages/core/src/terminal-builder.ts:269`), and `check-corpus.mjs` reads one member
  (`scripts/check-corpus.mjs:1806`). Both measured by
  [plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md)'s review.
- **Origin:** self-found · reading `mergeCollectResults` for [plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md), 2026-11-14.
- **Reported:** 2026-11-14

## Symptom

`collectResult` carries an `undecided` count (`packages/core/src/collect-result.ts:102-104`), which
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s builders set when a
subject could not be judged. `mergeCollectResults` (`packages/core/src/collect-result.ts:132-240`)
builds its result on every path from `examined`, `sourceEmpty` and `declaredEmpty` only, so a
member's `undecided` count never reaches the merged receipt.

A second place drops it on the preset path: `finishPreset`'s `expectEmpty` rewrite and
`withEvidenceGate` rebuild the receipt without it (`packages/core/src/report.ts:114-178`, `:296-303`),
measured by the same review's enforcement lens. [Plan 0652](../plans/0652-the-empty-source-helper-moves-into-the-kernel.md)'s helper keeps the count where nothing was
examined and adds nothing to the merge, so this bug owns the merge for every caller.

## Fix

Not designed. Summing `undecided` over the members, as `examined` is summed, is the obvious
candidate. [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7 lists the merge's rules, so the change is a stated addition to that list.

## Verification

- [ ] Red first: merging a member with `undecided: 1` and one with `examined: 2` keeps
      `undecided: 1`.
