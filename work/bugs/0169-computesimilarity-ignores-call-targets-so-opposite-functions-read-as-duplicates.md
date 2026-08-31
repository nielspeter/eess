# Bug 0169: `computeSimilarity` ignores call targets, so opposite functions read as duplicates

## Status

- **State:** Draft — **the symptom below is confirmed; the fix prescribed below was
  built, reviewed, measured wrong, and reverted.** See the correction at the end,
  and then the 2026-08-31 addendum, which reports this reaching a real adopter and
  measures the obvious second attempt failing the same way as the first.
- **Found:** 2026-08-19, auditing the code-quality rules eess ships.
- **Confirmed externally:** 2026-08-31, by an adopter project (not this repo)
  whose team independently traced it to `computeSimilarity`.

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

## Addendum, 2026-08-31 — it reached an adopter, and the obvious fix fails too

### It is not a theoretical false positive any more

An adopter project hit this on two type guards for two different types with
different field sets, and their engineer traced it correctly and unaided — to
`computeSimilarity` being LCS over node kinds and `buildFingerprint`'s own
docstring promising to ignore identifiers. Their conclusion: _"detector precision
limitation, not real duplication... there is nothing to consolidate here."_

They were right, and they were also being generous. Their reading was that the
detector "cannot tell `fieldNameA` from `field_name_a`" — near-identical spellings.
It is worse: it cannot tell **any** two names apart. Reduced to a fixture with
deliberately disjoint vocabulary — two guards sharing not one field name:

```
vocabulary A: value, harbour, 'string', length, 0, lantern, meridian, quarry, tessellate
vocabulary B: value, cobblestone, 'string', length, 0, driftwood, ferrous, gantry, juniper
shared      : value, 'string', length, 0        <- only the scaffolding

structural similarity (what the rule uses):  1.00
vocabulary overlap (Jaccard, never read)  :  0.29
```

100%, on bodies with 29% vocabulary in common. The cost lands on the adopter as
an investigation: a senior engineer read both guards in full, reasoned about
their type contracts, and wrote up a defence — to dismiss a finding the tool
should not have made. That is the real price of a false positive in an
agent-facing tool, and it is why this is not merely cosmetic.

### The fix this record proposes cannot reach that case

Both bodies make **zero calls**:

```
calls in A: []
calls in B: []
```

Call-target overlap is undefined for them, so the pair falls back to the
structural score unchanged. This record's own Residual already says so — _"Six
pairs in this corpus make no calls at all and fall back to the structural score
unchanged"_ — but it files that as a rounding error. The adopter's case IS that
residual, and a type guard, a validator, a mapper, a reducer over property
accesses are all call-free by nature. The residual is a whole genre.

### The obvious alternative fails on the same rock

`buildFingerprint` builds a `Set` of distinct identifier/literal texts and keeps
only its `.size` (as `distinctVocabulary`, used as a floor). The set itself — the
body's actual vocabulary — is discarded. Comparing those sets is the natural
second axis for call-free bodies, so it was measured before being written down
here, against the pairs this record names, with the same `min(structural, second)`
shape the first attempt used:

| pair                                   | structural | vocab overlap | wanted             | got            |
| -------------------------------------- | ---------- | ------------- | ------------------ | -------------- |
| `classContain` ~ `functionContain`     | 0.962      | **0.500**     | must SURVIVE       | **eliminated** |
| `haveStereotype` ~ `notHaveStereotype` | 0.974      | **1.000**     | must be ELIMINATED | **survives**   |
| `watchAndRerun` (ts ~ mermaid)         | 0.979      | 0.891         | must survive       | survives       |
| `check` ~ `warn`                       | 1.000      | 0.833         | must be eliminated | eliminated     |
| `and` ~ `or`                           | 0.921      | 0.800         | must be eliminated | eliminated     |

Corpus-wide: 169 pairs at structural ≥ 0.85 become 40 under the conjunction.

**It fails in both directions, on two of the five named pairs.** It kills
`classContain` ~ `functionContain` — the pinned genuine duplicate — _exactly as
call-target overlap did_, for exactly the same reason: `min()` hands the second
axis a veto over a strong structural match. And it keeps
`haveStereotype` ~ `notHaveStereotype` at vocabulary 1.000, because logical
negations of one another share every identifier they use. Vocabulary cannot see a
`!`.

So this is a negative result, and it is the useful kind: **the shape is wrong, not
the axis.** Two different second axes, chosen for different reasons, both break the
same pinned pair the same way. Anyone reaching for a third axis under `min()`
should expect the same outcome.

### What this changes about the fix

Nothing in _"What a real fix has to do"_ below is retracted; the second bullet is
now measured rather than argued, and it is the binding one. Adding to it:

- **A call-free body is a first-class case, not a residual.** Any candidate must
  be measured against the guards fixture above, where every call-based signal is
  empty by construction.
- **`min()` is disqualified as the combining shape** — twice, independently.
  Whatever the second axis, it cannot hold a veto. A floor that only rejects when
  the structural score is _itself_ marginal, or a weighting that cannot pull a
  1.00 below threshold on its own, are the shapes left unmeasured.
- **`haveStereotype` ~ `notHaveStereotype` needs an axis that can see negation.**
  Neither calls nor vocabulary can. That may mean the honest answer for this pair
  is that no cheap fingerprint distinguishes it, and the detector should say so.

Nothing was changed in `packages/ts/src` for this addendum. The record stays
Draft, the symptom stays unfixed, and the measurement scripts were throwaway.

## Correction, 2026-08-31 (same day, later) — I read the bodies, and the premise is wrong

The addendum above is sound where it measures the ALGORITHM (disjoint vocabulary
scores 1.00; `min()` is disqualified as a combining shape; a call-free body is a
genre). It is wrong where it accepts this record's framing of what the findings
MEAN, and so is this record's opening claim. Both were reached by reading
function **names** and inferring; neither had read the bodies.

Read, five of them:

**`check` ~ `warn`, 100%** — this record calls it the headline false positive:
_"`check` throws and `warn` does not... not duplicates under any reading — the
remedy the finding suggests (consolidate them) would be a defect."_ The bodies:

```ts
check(options?: CheckOptions): void {
  executeCheck(this.evidencedViolations(), { reason: …, metadata: …, exclusions: …, silentIndices: … }, options)
}
warn(options?: CheckOptions): void {
  executeWarn (this.evidencedViolations(), { reason: …, metadata: …, exclusions: …, silentIndices: … }, options)
}
```

Byte-identical but for one call target. Their kind histograms are **identical** —
measured, zero differing kinds. This is a textbook type-2 clone and consolidating
it (one private `run(mode, options)`) is a strict improvement, not a defect.
`check` does not throw; `executeCheck` does. The record read the method names and
attributed the callee's behaviour to the caller.

**The `evaluate` family, 33 pairs — the class dismissed as "the DSL's shape".**
`maxCyclomaticComplexity` ~ `maxParameters` in `packages/ts/src/rules/metrics.ts`
are the same loop over the same members pushing the same `metricViolation`,
differing in the measure (`cyclomaticComplexity(member.getBody())` vs
`member.getParameters().length`), one metric name and one message. That is
parameterisable duplication, not an interface obligation.

**`functionContain` ~ `mustMatchName`, 88%** — the least duplicate-looking pair in
a random sample of eight: different files, different names, different element
types. Still the same `Condition<T>` body — accumulate, loop, negated test, push a
constructed violation. Weaker: consolidating costs generics over three axes, so
reasonable people differ. Borderline, not false.

**`isExcludedByComment` core ~ ts, 100%** — literal duplication, and following it
found [bug 0227](./0227-eess-ts-is-silent-on-a-malformed-exclusion-start.md), a
live defect nine days old. A true positive that paid for itself.

### What this changes

**The score is largely right; the triage was wrong.** These findings are real
structural duplication, on a spectrum from "obviously extract this" (`check` ~
`warn`, one axis) to "you could, but the abstraction may cost more than it saves"
(`functionContain` ~ `mustMatchName`, three axes). That is not a precision
problem. The detector reports _structural duplication_; the reader wants
_actionable duplication_; only the second is a judgement call, and the tool has
never been asked for it.

An earlier version of this addendum put the corpus at "~15% precision, 85%
noise". **Retracted** — it was computed by bucketing on function names, and every
body it bucketed as noise and then actually read turned out to be duplicated.

**One genuine algorithm defect survives the correction.**
`haveStereotype` ~ `notHaveStereotype` at 0.974 is real: a `!` is one token that
INVERTS the meaning, while an identifier rename is zero tokens, so LCS ranks the
negation as more similar than the rename. Measured fix — reject a pair whose
counts of polarity-inverting kinds differ:

```
haveStereotype ~ notHaveStereotype   0.974  rejected  (not: 1 v 0)
classContain ~ functionContain       0.962  reported  (no difference)
```

The pinned genuine duplicate survives, which neither call-overlap nor
vocabulary-overlap managed. **But the veto set must be polarity only.** Tested
with a wider signature including comparison operators, `watchAndRerun` (ts ~
mermaid, a literal copy-paste) was rejected on `strictEq: 1 v 0` — the veto
problem again, one rung down. `===` is what a copy-paste legitimately tweaks; `!`
is not.

### The fix that follows

Not a better score. **Report the axes of variation, not just the percentage.**
The tool already computes enough to say _what differs_ — `check` ~ `warn` differ
in one call target; the adopter's two guards differ in five property names; the
metrics pair differs in a measure, a name and a message. Those three are the same
number on screen today and three different verdicts in a reader's head.

That is also precisely the cost the adopter paid: a senior engineer read both
functions to discover the variation was a field list. The finding was not wrong —
it was unactionable, and being unactionable is what taught them to distrust it.

Concretely, and still unbuilt:

1. Add the polarity veto (measured above; needs the fixtures this record's
   correction demands, including one pinning that comparison operators must NOT
   veto).
2. Emit the varying axes in the message.
3. Leave the score alone.
4. Keep it `.warn()`.
