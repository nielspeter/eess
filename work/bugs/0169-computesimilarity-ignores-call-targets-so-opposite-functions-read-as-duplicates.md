# Bug 0169: `computeSimilarity` ignores call targets, so opposite functions read as duplicates

## Status

- **State:** Draft — **the symptom below is confirmed; the fix prescribed below was
  built, reviewed, measured wrong, and reverted.** See the correction at the end.
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

- [ ] Red first: two structurally isomorphic bodies with disjoint call targets
      score below the default threshold.
- [ ] `classContain` ~ `functionContain` — the pair `dogfood.test.ts:225` pins as
      the motivating genuine duplicate — is still reported.
- [ ] `watchAndRerun` (`packages/ts/src/cli/watch.ts` ~ `packages/mermaid/src/cli/watch.ts`),
      a literal copy-paste differing in two tokens, is still reported.
- [ ] A renamed-variable clone whose renamed variable IS a call receiver is still
      reported. The first attempt's guard used only bare-function calls, which
      made it a tautology (see the correction).
- [ ] Fixtures pin the rejected alternatives — product, arithmetic mean,
      last-segment normalisation — so a later refactor to any of them goes red.
- [ ] `npm run validate` — no new failures, measured with an instrument that can
      see file-level collection failures (see the correction).

## Out of scope

Whether `duplicateBodies` should ship at all, and the wider question of which of
eess's ported code-quality heuristics earn their place. Related but separate:
[bug 0167](./0167-method-size-rules-can-only-be-excluded-by-class.md) and
[bug 0168](./0168-no-unused-exports-misses-barrel-re-exports-and-inline-type-imports.md).

## Correction, 2026-08-19 — the first fix was wrong and is reverted

Commit `09cab55` weighted the structural score by call-target overlap
(`Math.min(structural, callOverlap)`). Six reviewers ran against it and three
findings killed it. Reverted in full; the symptom above stands unfixed.

**It broke this repo's own guard for the opposite direction.**
`packages/ts/tests/archunit/dogfood.test.ts:225` pins `classContain` ~
`functionContain` as "the motivating genuine duplicate — must survive". Measured
under the reverted fix:

```
structural  = 0.962
callsA = ["searchClassBody","violations.push","createViolation","getElementName"]
callsB = ["searchFunctionBody","violations.push","createFunctionViolation","fn.getName"]
callOverlap = 0.250   ->  min() = 0.250, below the 0.85 default: NOT REPORTED
```

Review measured 128 pairs lost in total, eleven of them cross-package — including
`watchAndRerun` (`ts` ~ `mermaid`) at 98% structural, which differs in two tokens
and is precisely the kernel-extraction target plan 0165 is chasing.

**The root cause is in `buildFingerprint`, not in the scoring.**
`Fingerprint.calls` is documented as "**Normalized** call targets" and nothing
normalises: `fingerprint.ts` pushes `node.getExpression().getText()`, the raw
source text of the callee. For an IIFE — `(async () => { … })()` — the callee IS
the arrow, so an entire multi-line function body is stored as one "call target".
Comparing those texts gave the second axis veto power over a score whose whole
purpose is text-immunity, so one identifier rename could cost two matches.

**The guard test could not fail.** `it('still scores a renamed-variable clone as
a duplicate')` renamed only variables that are never call receivers, so both
bodies called `lookupUser`/`buildWelcome`/`sendEmail` byte-for-byte,
`callOverlap` was 1.0 by construction, and `min` could never bite. It stayed
green under a full revert — a test written to catch an over-correction that was
structurally incapable of catching it.

**And the verification that cleared it was blind.** "No new test failures" was
measured by diffing failing-test _names_ out of vitest's `assertionResults`.
`dogfood.test.ts` and `arch-rules.test.ts` fail at COLLECTION in this tree —
they call `project('tsconfig.json')` and no root `tsconfig.json` exists — so they
emit zero assertion results and were invisible to that instrument in both runs.
A same-named test failing for a new reason was invisible to it too.

### What a real fix has to do

- Resolve callees to something stable before comparing — a symbol, or at minimum
  the callee's own identifier rather than the full expression text — so an IIFE
  body never becomes a "target".
- Not let the second axis veto a strong structural match outright. A floor, or
  normalising the overlap by the smaller call set, keeps `classContain` ~
  `functionContain` while still rejecting `check` ~ `warn` (0.5 overlap at 1.0
  structural). Both must be measured against the named pairs, not argued.
- Carry fixtures for every rejected alternative. The reverted version argued for
  `min` over product and mean in its docstring, citing exact numbers, with no
  test pinning any of them — all three sabotages stayed green.
