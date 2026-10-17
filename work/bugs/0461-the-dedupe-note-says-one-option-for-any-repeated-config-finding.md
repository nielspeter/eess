# Bug 0461: the dedupe note says "one option" for any repeated configuration finding

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's reviews (architect, product, enforcement).
- **Severity:** Low — the finding is right; the sentence appended to it describes a different cause.
- **Origin:** self-found · PR #235's reviews, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`dedupeConfigFindings` (`packages/core/src/dedupe-config-findings.ts:69`) collapses repeated
configuration findings and appends `affectedNote` (`dedupe-config-findings.ts:56`): "This one option
generated N rules that cannot enforce anything; they are not listed separately because they are one
edit." That wording is written for a preset's fan-out. eess-md's code-block instrument finding
(`packages/md/src/builders/code-blocks.ts:119`, `bypassFilters: true`) is deduplicated the same way
when several rules read one failed parse, and so, read from the source and not yet reproduced, gets
the same note, which then names an option nobody set. Plan 0454's undeclared-box-mark finding would be the third case.

## Fix

The note states what was collapsed in terms that hold for every caller (N rules reported this same
finding), or takes its wording from the finding. Kept out of plan 0454, which stays eess-md only.

## Verification

- [ ] Red first: two `codeBlocks()` rules over one failed parse, deduplicated, carry "This one option
      generated 2 rules"
- [ ] Green: the deduplicated finding's note names what was collapsed (two rules reporting one finding)
      and no option

Deferred: none
