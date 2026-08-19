# Bug 0169: `computeSimilarity` ignores call targets, so opposite functions read as duplicates

## Status

- **State:** Draft — fix built and measured; ready to close with this PR.
- **Found:** 2026-08-19, auditing the code-quality rules eess ships.

## Symptom

`smells.duplicateBodies()` at its documented defaults reports **218 findings**
against eess's own source. A sample of what it calls duplicates:

| Pair                                             | Reported |
| ------------------------------------------------ | -------- |
| `TerminalBuilder.check` ~ `TerminalBuilder.warn` | **100%** |
| `haveStereotype` ~ `notHaveStereotype`           | 97%      |
| `haveStereotype` ~ `dependOn`                    | 97%      |
| `and` ~ `or`                                     | 92%      |
| `mustMatchName` ~ `mustNotEndWith`               | 91%      |

`check` throws and `warn` does not. `haveStereotype` and `notHaveStereotype` are
logical negations of one another. These are not duplicates under any reading —
the remedy the finding suggests (consolidate them) would be a defect.

## Root cause

`buildFingerprint` collects call targets into `Fingerprint.calls`, and
`computeSimilarity` **never reads them**. Measured: `.calls` has no reader
anywhere in `packages/ts/src`. The score is an LCS over the `SyntaxKind`
sequence alone, so it measures _punctuation shape_ and nothing else.

In a codebase built on a fluent DSL — where every condition is
`{ description, evaluate(elements, ctx) { … } }` and every violation
constructor has one shape — near-total structural similarity is the _design_,
not a smell. The detector is reporting stylistic consistency as duplication.

Demonstration, three functions sharing nothing but punctuation:

```ts
function onboard(user) {
  const record = lookupUser(user)
  return record.sendWelcomeEmail()
}
function cancel(sub) {
  const account = findBilling(sub)
  return account.issueRefund()
}
function purge(path) {
  const handle = openFile(path)
  return handle.unlinkSync()
}
```

`computeSimilarity` returns **1.000** for every pair.

## Fix

Weight the structural score by call-target overlap, which is the signal already
collected and discarded. Call targets are the right discriminator specifically
because they survive the rename that defines a real type-2 clone: a
copy-pasted body with renamed variables still calls the same functions, while
two unrelated bodies with the same skeleton do not.

Measured over this repo (same filters: minLines 5, minDistinctVocabulary 8,
similarity 0.85):

- **164 pairs → 48** (116 eliminated).
- Every pair in the table above is eliminated.
- What survives is dominated by the genuine kernel/dialect duplication that
  plan 0165 created — `assertHomogeneous`, `isExcludedByComment`, `viewsFor`,
  `validateOverrides`, `RuleBuilder.select` — the same function present in both
  `packages/core/src` and `packages/ts/src`. Those are real and worth acting on.

## Residual, stated honestly

This narrows the class; it does not close it. Two bodies that share a skeleton
**and** their call targets still score high — the `TerminalBuilder.*Violation`
family is the local example, and those are arguably genuine near-duplicates
worth parameterising. Six pairs in this corpus make no calls at all and fall
back to the structural score unchanged. `duplicateBodies` remains a `.warn()`
detector, not a gate, and that is the right weight for it.

## Verification

- [x] Red first: two structurally isomorphic bodies with disjoint call targets
      score below the default threshold — failing before the fix. Confirmed red
      (scored 1.000), then green — `fingerprint.test.ts` ·
      `it('scores two isomorphic bodies low when they call nothing in common')`.
- [x] A renamed-variable clone (same calls, different identifiers) still scores
      above the threshold, so the fix does not disarm type-2 clone detection —
      `it('still scores a renamed-variable clone as a duplicate')`, scores 1.0.
- [x] The existing `fingerprint.test.ts` pins still hold: near-clone > 0.75,
      unrelated < 0.5, self-comparison exactly 1.0, empty-pair cases unchanged.
      All 11 pass; the near-clone fixture pair has identical call sets, so the
      second axis does not move it (0.927).
- [x] `npm run validate` — no new failures (39 before, 39 after — all
      pre-existing), every `check:*` gate, typecheck, lint and format green, and
      `check:nonvacuity` still reds when the detector is emptied.

## Outcome, measured

218 findings on this repo's own source become **70**, and every pair in the
symptom table above is gone. What remains is dominated by the genuine
kernel/dialect duplication plan 0165 created — `assertHomogeneous`,
`parseRuleIdsAndReason`, `isExcludedByComment`, `viewsFor`, `validateOverrides`,
`RuleBuilder.select` — the same function present in both `packages/core/src`
and `packages/ts/src`.

`min` was chosen over a product and a geometric mean by measurement, not taste:
a product loses `and`~`and` across the kernel/dialect split (0.775, under the
default), and a geometric mean keeps `haveStereotype`~`notHaveStereotype` at
0.855, over it. Normalising call targets to their trailing member name was also
measured and rejected — it returns that same negation pair to 0.974.

## Out of scope

Whether `duplicateBodies` should ship at all, and the wider question of which of
eess's ported code-quality heuristics earn their place. Related but separate:
[bug 0167](./0167-method-size-rules-can-only-be-excluded-by-class.md) and
[bug 0168](./0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md).
