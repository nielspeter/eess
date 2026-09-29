# Bug 0357: `doctor` reports a healthy `.notExist()` ratchet as a dead glob, where `check` correctly stays green

## Status

- **State:** Fixed — one shared predicate, consumed by both tools, with a red-first test
  that asserts the AGREEMENT rather than either tool's output.
- **Severity:** Medium — **a false RED in the preview tool, not the gate.** `check`
  is correct; `doctor` tells an adopter that a rule which is working is broken. The
  cost is a reader deleting or "fixing" a ratchet that was doing its job.
- **Origin:** found while fixing
  [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md),
  whose ledger asks that `doctor` and `check` keep agreeing. They did not already,
  and 0355's fix reduced the disagreement rather than introducing it.
- **Reported:** 2026-09-29
- **Fixed:** 2026-09-29 (PR #156)

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
(`ts/src/core/diagnose.ts:492`) and **not** on its universe-based dead-glob
path (`ts/src/core/diagnose.ts:424`, where the guard now is). So a `.notExist()` rule whose selector matches nothing
— which is every healthy ratchet — takes the dead-glob branch before the exemption
is ever consulted.

The gate has the mirror of this and got it right: `deadSelectorFindings` exempts
cardinality outright (`ts/src/core/vacuity-diagnosis.ts:417`). 0355 then gave the gate's floor
the discriminator that tells a holding ratchet from a broken selector — the
filesystem, via `diskSet` — and `doctor` did not get it.

**The invariant this breaks is written down.** `vacuity-diagnosis.ts:253-255`:
"Exempt since 0.34.0, and `diagnose()` exempts it too — **the two must agree or
`doctor` and `check` disagree about a working rule**." That is exactly what happens.

## Fix

`absenceClaimIsContradicted(project, glob)` in `packages/ts/src/core/disk-set.ts` — **one**
predicate, applied by the gate's evidence floor and by `diagnose()`'s dead-glob path.

It lives in `disk-set.ts` rather than in either consumer, and beside the classification it
reads, because the open question this record raised — where the shared derivation goes — has
a precedent and a scar. `isFaultPosition` was two hand-maintained inverse lists in these same
two files; they disagreed about exactly `discovery`, so `doctor` reported a dead layer glob
and the build stayed green. Putting the policy in a third module both already import adds no
dependency edge and leaves one owner.

Only `holds-typescript` contradicts an absence claim. `absent` is the ratchet holding — the
common case, and it must stay silent. `no-typescript` means no modules are there, which is
what the rule asserts. `not-determined` means the walk could not answer, and blaming the
author for that is the confidently-wrong remedy `disk-set.ts` exists not to give.

## The sabotage matrix

Four rows and a clean control, literal edits, restores sha256-verified.

| row        | the edit                                                           | what reddened                                                  |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| R0 CONTROL | none                                                               | nothing — green                                                |
| R1         | `diagnose()` skips the new guard (the pre-fix code)                | `agree on all three cases`                                     |
| R2         | the shared predicate accepts everything                            | `agree on all three cases`, and 0355's ratchet-holding control |
| R3         | the shared predicate accepts nothing                               | `agree on all three cases`, and both of 0355's defect tests    |
| R4 REVERSE | drop the cardinality condition, so the guard applies to EVERY rule | `CONTROL: a non-cardinality rule is untouched in both tools`   |

**R2 and R3 red tests in the OTHER bug's file**, which is the point of a shared predicate: one
edit has to be visible from both sides, or the two tools have separate policies again.

**R4 first fired nothing, and the control was at fault rather than the guard.** It asserted
`doctor: true`, which stayed true when the guard applied to every rule — `diagnose()` simply
reported `zero-subjects` instead of `dead-glob`, and a boolean cannot tell those apart. The
control now asserts the finding KIND. Recorded because "a row that fires nothing" has two
causes and this was the second one, for the second time in this pair of bugs.

**Two rows also failed to apply before that**, because `prettier` reflowed the `if` onto one
line after the edit was written and the anchor stopped matching — a green that meant the
sabotage never ran. Worth the line: a matrix keyed on source text has to be re-anchored after
formatting, and a row reporting ALL GREEN is the same output either way.

## Related

- [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — the gate half, fixed. Its ruling and the measurement behind the disk
  discriminator are recorded there and are not repeated here.
- [0352](../0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)
  — the other place `disk-set`'s answer and the matcher's disagree.

## Verification

- [x] measured: the three-row table above, one fixture, both tools.
- [x] established that 0355's fix did not cause it — before that change `doctor` and `check`
      disagreed on rows one AND two; after it, only on row two; now on none.
- [x] a ruling on where the shared derivation lives — `disk-set.ts`, for the reason in the
      fix above, which is a scar rather than a preference.
- [x] a red-first test asserting `doctor` and `check` agree across all three rows:
      `packages/ts/tests/core/doctor-and-check-agree-about-a-ratchet.test.ts`. It asserts the
      AGREEMENT, not either tool's output — asserting `doctor`'s output would pass while
      `check` drifted away from it, which is the defect.
- [x] a sabotage matrix — 4 rows and a clean control, published above, including a reverse row
      and the two rows that red the other bug's tests.
- [x] a changeset — `doctor` output changes, which is adopter-visible.
- [x] `npm run validate` green.

Deferred: none.
