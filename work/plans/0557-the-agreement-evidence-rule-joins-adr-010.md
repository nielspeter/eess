# Plan 0557: the agreement evidence rule joins [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)

## Status

- **State:** Draft — recorded 2026-10-29 by [plan 0556](./completed/0556-a-value-agrees-with-the-documents-own-path.md)'s review (enforcement I5, architect M5), not
  scheduled. Not a release blocker.
- **Priority:** Low — the rule holds in both conditions that follow it; what is missing is its home.
- **Effort:** Small for the ADR amendment; the kernel channel is a decision first.
- **Created:** 2026-10-29

## Problem

A condition that reads a value out of each document and judges some of them (block 5's
`agreeWithFolder`, block 16's `agreeWithPath`) has two counts: the documents selected and the
documents it gave a verdict. [Plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s batch review settled which one is the evidence ("Decision
D1, rebuilt"): the kernel's `examined`, the selection, stands, and "judged none" over a non-empty
selection is the condition's own finding, unsuppressable. The first design, `examined` as the
documents judged, hid three greens: `.expectEmpty()` over a rule that judged none, a broken
agreement beside another condition, and beside a second agreement.

That rule now has two users and lives only in [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md)'s build notes. [Plan 0556](./completed/0556-a-value-agrees-with-the-documents-own-path.md)'s first draft
re-specified the deleted design, and two reviews caught it; the next condition of this kind would be
written from the same place.

A related shape repeats too: three conditions hand-roll a "judged none" finding (md's
`agreeWithFolder` and `agreeWithPath`, and eess-ts's cross-layer condition,
`packages/ts/src/conditions/cross-layer.ts`), because the kernel's `Condition` has no channel to say
how many elements it gave a verdict.

## Phases

1. **The rule in [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md).** An amendment, or a short ADR extending it, stating that a condition's
   evidence is the kernel's selection and that a condition which judged none of a non-empty
   selection reports it as its own unsuppressable finding; its Enforcement row cites both
   conditions' `.expectEmpty()` rows (Tier 2, `gated`).
2. **The kernel channel, decided.** Whether `Condition` gains a way to report the elements it judged,
   so the kernel raises "judged none" once for every dialect: a decision first (a spike or a
   proposal), then a plan of its own if it is taken.

## Out of scope

- Changing either condition's behaviour: both already follow the rule.
