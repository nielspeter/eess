# Bug 0357: `doctor` reports a healthy `.notExist()` ratchet as a dead glob, where `check` correctly stays green

## Status

- **State:** Draft — measured in both tools, on one fixture, three globs.
- **Severity:** Medium — **a false RED in the preview tool, not the gate.** `check`
  is correct; `doctor` tells an adopter that a rule which is working is broken. The
  cost is a reader deleting or "fixing" a ratchet that was doing its job.
- **Origin:** found while fixing
  [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md),
  whose ledger asks that `doctor` and `check` keep agreeing. They did not already,
  and 0355's fix reduced the disagreement rather than introducing it.
- **Reported:** 2026-09-29

## Symptom

One fixture, one `.notExist()` rule, three selectors. `doctor` is `diagnose()`,
`check` is `.violations()`:

| selector                        | on disk?           | `doctor`    | `check`              |                    |
| ------------------------------- | ------------------ | ----------- | -------------------- | ------------------ |
| `'**/apps/legacy/**'`           | `holds-typescript` | `dead-glob` | reports the selector | agree (since 0355) |
| `'**/apps/deleted-long-ago/**'` | `absent`           | `dead-glob` | **nothing — green**  | **disagree**       |
| `'**/apps/api/src/**'`          | in the project     | nothing     | reports the subject  | agree              |

Row two is the defect. The path is genuinely gone, which is the ratchet **holding** —
`check` is right to stay green, and `doctor` says the glob is dead.

## Root cause

`diagnose()` exempts cardinality rules in `zeroSubjectsFinding`
(`packages/ts/src/core/diagnose.ts:484`) and **not** on its universe-based dead-glob
path (`diagnose.ts:415-418`). So a `.notExist()` rule whose selector matches nothing
— which is every healthy ratchet — takes the dead-glob branch before the exemption
is ever consulted.

The gate has the mirror of this and got it right: `deadSelectorFindings` exempts
cardinality outright (`vacuity-diagnosis.ts:382`). 0355 then gave the gate's floor
the discriminator that tells a holding ratchet from a broken selector — the
filesystem, via `diskSet` — and `doctor` did not get it.

**The invariant this breaks is written down.** `vacuity-diagnosis.ts:253-255`:
"Exempt since 0.34.0, and `diagnose()` exempts it too — **the two must agree or
`doctor` and `check` disagree about a working rule**." That is exactly what happens.

## Fix

Give `diagnose()`'s dead-glob path the same discriminator 0355 gave the floor: for a
rule that asserts cardinality, report a dead selector only when the glob classifies
`holds-typescript` on disk. The helper already exists in shape —
`cardinalitySelectorMissedDisk` in `vacuity-diagnosis.ts` — and the two should share
one derivation rather than grow a second, which is the failure mode this pair has
already had once (`isFaultPosition` was two hand-maintained inverse lists that
disagreed about `discovery`).

**The open question is where the shared derivation lives.** `diagnose()` is the
preview and `vacuity-diagnosis` is the gate; they already share `isFaultPosition`,
`isDeadSite` and `syntacticFault`. This would be the fourth, and it is the first that
needs an `ArchProject` to answer.

## Related

- [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — the gate half, fixed. Its ruling and the measurement behind the disk
  discriminator are recorded there and are not repeated here.
- [0352](./0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)
  — the other place `disk-set`'s answer and the matcher's disagree.

## Verification

- [x] measured: the three-row table above, one fixture, both tools.
- [x] established that 0355's fix did not cause it — before that change `doctor` and
      `check` disagreed on rows one AND two; now only on row two.
- [ ] a ruling on where the shared derivation lives
- [ ] a red-first test asserting `doctor` and `check` agree across all three rows
- [ ] a changeset — `doctor` output changes, which is adopter-visible
- [ ] `npm run validate` green.

Deferred: none.
