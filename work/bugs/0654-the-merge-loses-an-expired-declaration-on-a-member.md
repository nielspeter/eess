# Bug 0654: the merge loses an expired declaration on a member

## Status

- **State:** Draft — found 2026-11-14 by the enforcement lens at
  [plan 0652](../plans/completed/0652-the-empty-source-helper-moves-into-the-kernel.md)'s build
  review, outside that plan's scope; no change yet.
- **Severity:** Low — no vacuous pass: the member that declared itself empty examined something. A
  stale declaration's own signal is lost.
- **Origin:** self-found · [plan 0652](../plans/completed/0652-the-empty-source-helper-moves-into-the-kernel.md)'s build review, 2026-11-14.
- **Reported:** 2026-11-14

## Symptom

A receipt that declares itself legitimately empty (`declaredEmpty`) but examined something has
outlived its declaration; on its own, the gate reports `emitter/expired-declaration`. Merged beside
another member, `mergeCollectResults([{ examined: 3, declaredEmpty: true }, { examined: 5 }])` passes
the gate with no finding (measured by the enforcement lens): the merge keeps `declaredEmpty` only
when the whole examined nothing (`packages/core/src/collect-result.ts:225-238`), and nothing else
carries the member's expiry.

Not yet measured: which merged receipts in the family can carry such a member today.

## Fix

Not designed. The merge could report a member whose `declaredEmpty` sits beside a non-zero
`examined`, as it reports a contradictory `notRun` member, which
[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7 would list.

## Verification

- [ ] Red first: the merge above reports the member's expired declaration.
