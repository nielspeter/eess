# Bug 0479: a merge repeats an empty source its member already reported

## Status

- **State:** Draft — recorded 2026-10-18 while building plan 0456.
- **Severity:** Low — no verdict changes colour; one cause is reported twice, so a reader counts two
  faults where there is one.
- **Origin:** self-found · plan 0456's build, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`mergeCollectResults` adds `emitter/source-empty` when any member has `sourceEmpty` and examined zero
(`packages/core/src/collect-result.ts:175`), even when that member already carries the terminal's
own finding for it ("this rule's source loaded zero units", `zeroLoadedSourceViolation`). The
emitter's gate does not: it returns at `violations.length > 0`
(`packages/core/src/report.ts:157`) before its `sourceEmpty` branch, and the comment there says the
branch exists for a hand-assembled receipt, because a terminal that loaded nothing already reports
it. The two seams disagree about the same receipt.

Measured on plan 0456's branch, before `honestyAtClose` was changed to return early on an empty
corpus: over a corpus whose roots match nothing, the preset's three rules each reported the empty
source, and the merge added a fourth finding, `emitter/source-empty`. Four findings, one cause.

## Fix

The merge adds `emitter/source-empty` only when no member that is source-empty already carries a
finding, mirroring the gate. To be measured against the gate's own tests, which pin the
hand-assembled receipt.

## Verification

- [ ] Red first: a merge of two terminal receipts over an empty source, each carrying the
      terminal's finding, yields exactly those two findings and no `emitter/source-empty`
- [ ] Green: a hand-assembled `{ examined: 0, sourceEmpty: true }` member with no finding still
      reds with `emitter/source-empty` through the merge

Deferred: none
