# ADR-016: A bounded instrument limits knowledge, never the verdict

- **Status:** Accepted (2026-09-30)
- **Extends:** [ADR-009](./009-agent-first-failure-surfaces.md) · [ADR-010](./010-a-pass-is-constructed-from-evidence.md)
- **Context:** [bug 0359](../work/bugs/fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
  [bug 0355](../work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md),
  [spike 0367](../work/spikes/0367-must-the-disk-question-walk-the-whole-repo.md),
  [spike 0360](../work/spikes/0360-what-the-disk-walk-actually-costs.md)
- **Supersedes nothing.** Extends [ADR-009](./009-agent-first-failure-surfaces.md) and
  [ADR-010](./010-a-pass-is-constructed-from-evidence.md) to instruments that can run out.

## The question

Some instruments are unbounded in principle. A filesystem walk is the one this project
already ships: to know whether the code a `.notExist()` rule asserts is gone really is gone,
something has to look, and "look" has no natural end. So the walk carries a budget.

Bug 0355 then made that walk's answer **decide a verdict** — a cardinality rule reports only
when the filesystem contradicts the absence it asserts, because a holding ratchet and a
broken selector both match zero and only the disk can separate them. Bug 0359 is what that
composition produced: above the budget the walk answered "could not determine" for _every_
glob at once, memoized, and "could not determine" meant **green**. One repository over the
threshold silenced every cardinality rule in the run, for a reason unrelated to any of their
paths, and nothing said the walk had given up.

The question that kept being re-derived — in 0355's ruling, in 0359's Fix, in 0367's
conclusion — is **whether a verdict may depend on a bounded instrument at all.** Three bug
records argued it and none decided it, which is the shape
[bug 0354](../work/bugs/0354-the-glob-view-doctrine-is-settled-in-three-bug-records-and-no-adr.md)
already complains about for glob views.

## Decision

**It may — and only on one condition: the bound may cost knowledge, and may never decide
which way the build fails.**

Concretely, for any instrument that can stop short of a complete answer — an entry budget, a
timeout, a depth cap, a sample, a size limit:

1. **Running out is a finding, never a pass.** The instrument reports that it could not
   answer. Silence is forbidden, and so is any degraded answer that a caller can mistake for
   "nothing wrong here".
2. **That finding is unsuppressable.** It is a statement about the instrument, not a
   violation an author can accept, so no `.warn()`, `.excluding()`, comment, baseline or
   diff-aware mode removes it. It is the same class as an empty project.
3. **One finding per instrument-failure, not one per affected rule.** The identity of the
   fault is the instrument. N rules losing one walk is one thing to say, and ADR-009 rule 4
   forbids fanning one cause across many findings.
4. **The finding names what consumed the budget.** ADR-009 rule 2 requires a real remedy, and
   "your repository is too large" is not one — the adopter cannot act on it. What they can act
   on is a named directory.
5. **A bound is set from measurement, and changing it requires re-measuring what depends on
   it.** A bound may not be tightened on the belief that it costs only message quality.
6. **Prefer an instrument bounded by the question over one bounded by a budget.** Where the
   question admits an exact answer over a bounded input, take it; a budget is the fallback for
   questions that do not.
7. **A degraded instrument still answers honestly about what it cannot say.** The
   "could not determine" answer stays available and stays truthful; the report of the
   degradation travels **beside** it, never instead of it. A caller that only reads the
   classification must not be misled, and a caller that wants the reason must be able to find
   it. _Added after independent validation, which found the Enforcement table gating this
   property while the Decision never stated it — a table enforcing more than its own ADR
   decides is its own kind of drift._

## Why this, and not the alternatives

**"A verdict may not depend on a bounded instrument."** The principled position, and it was
the first one considered. Spike 0367 measured what it would cost: `classify(glob)` only ever
asks "does any path matching this glob hold TypeScript", so the hope was a walk bounded by the
glob's own text — no budget, nothing to run out. Measured, that is a 250–1000× win for a glob
with a literal prefix and a **2× loss** for one led by `**/`, which can prune nothing. And a
holding ratchet — the case the feature exists for — matches nothing by definition, so it can
never short-circuit and must exhaust the searchable space. The census decided it: **9 of 9
globs in this repository's own rule files are `**/`-led, zero anchored\*\*, and the convention is
load-bearing since bug 0348. So there is no bounded alternative to swap in. Rejecting bounded
instruments outright would mean deleting the discriminator that bug 0355 exists to provide,
and going back to a silent false green — strictly worse than a reported limit.

**"Report it as a warning, or a line in the gate summary."** Cheapest, and it fails ADR-009
rule 1: the primary consumer is an agent that does not read warnings. Adequate for "the walk
was slow", not for "a gate is off".

**"Raise the bound until nobody reaches it."** Necessary and insufficient, and this ADR is
careful not to let it masquerade as the fix. The old 50,000-entry budget fired after ~105 ms
of work while the comment justifying it cited a 5-second timeout — roughly 48× below its own
stated reason — so raising it was overdue. But a bound that is merely hard to reach is still a
bound, and this project's whole subject is what happens at the edge nobody tests. Raising is
mitigation; clause 1 is the decision.

## Consequences

**A reported limit is not a solved limit, and this ADR does not pretend otherwise.** An
adopter above the bound gets a hard, unsuppressable failure. That is the right direction to
fail — a gate that cannot answer must not claim a pass — but it is a wall, and if the
directories the finding names are not disposable the remedy runs out.
[Bug 0369](../work/bugs/0369-the-prune-list-has-no-extension-point.md) holds that gap
deliberately unresolved, including the option of leaving it unresolved: a walk an adopter can
narrow is a gate an adopter can silence, and that trade is not obviously worth making.

**Clause 5 has teeth in retrospect only.** No mechanism can check that someone measured before
changing a constant. What it does is make the docstring at the bound the place where the
justification lives, so the next person to touch it reads what depends on it first — which is
precisely what was missing when 0359's predecessor comment said exhaustion "costs message
quality and nothing else".

**The finding's attribution is coarse, and that is a known limit rather than an oversight.**
Consumers are attributed to the first path segment below the root, because the remedy is a
decision about a top-level tree. In a monorepo whose own `packages/` dominates the walk, the
message will name `packages` — true, and useless. The finding is still better than silence,
and it is not yet good enough for that case; no test covers it, and the remedy text says
plainly that such a gap is real rather than pretending otherwise.

**Clause 6 is a preference, not a gate.** It is stated so the next bounded instrument starts by
asking whether the question can bound itself, rather than reaching for a budget by reflex.

## Enforcement

**Scope, stated before the table because independent validation found the table over-claiming
without it.** Every gated row below is satisfied by **one** instrument, the filesystem walk in
`disk-set.ts`. The clauses are general; the evidence is not. A table that reads as though a
general rule were proven by a single instance is exactly the over-claim this project's gates
exist to catch, and no deterministic gate can catch this one — so it is named here.

The other bounds in the dialect, surveyed for this ADR:

| bound                                                      | bounds                                   | audited?                                                                            |
| ---------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `ENTRY_BUDGET` (`disk-set.ts`)                             | knowledge — what the walk saw            | **yes**, this ADR                                                                   |
| `MAX_OBJECT_LITERAL_DEPTH` (`object-literal-functions.ts`) | knowledge — which functions are SELECTED | **no** — [bug 0370](../work/bugs/0370-a-depth-capped-selection-narrows-silently.md) |
| `MAX_ALIGN` (`smells/variation.ts`)                        | presentation, for pairs already reported | out of scope — cannot change whether a finding occurs                               |
| `MAX_SHOWN`, `MAX_AXIS_TEXT`, `MAX_NAMED_CAUSES_PER_GROUP` | presentation — how much a message prints | out of scope, same reason                                                           |

The distinction that decides scope is **knowledge versus presentation**: a bound that changes
what the instrument can see falls under clause 1, and a bound that changes how much of a
finding is printed does not.

| Clause                                                                                  | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status  |
| --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **C1** — Running out is a finding, never a pass                                         | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('a rule silenced by exhaustion reports the exhaustion instead of going green')` — measured RED before the fix, with the rule green and nothing said. Sabotage S1 restores the pre-fix line and reds four assertions. **What falsifies this, precisely:** the vitest row above plus the seven-row sabotage matrix in 0359's record. There is deliberately NO `scripts/check-nonvacuity.mjs` fixture — that harness falsifies `check:*` GATES (arch, baseline, diagram, spec, crossval, release), and this is a dialect message, which every other producer in `packages/ts/tests/core/every-config-finding-is-classified.test.ts` also falsifies behaviourally. Stated because validation read `gated` as implying a fixture | gated   |
| **C2** — The finding is unsuppressable                                                  | 2    | The same test asserts `bypassFilters === true` on the emitted finding. **That is what is proven here, and it is less than the clause says**: the flag's effect is the kernel's contract — `packages/core/src/baseline.ts` refuses to write or match it, `packages/core/src/diff-aware.ts` and `packages/core/src/execute-rule.ts` honour it — and those paths are exercised by OTHER producers' tests, not with this finding. Tier corrected from 1 to 2 and this sentence added after independent validation; end-to-end suppression of THIS finding is untested                                                                                                                                                                                                                              | gated   |
| **C3** — One finding per instrument-failure **after the CLI dedupe**, not one per rule  | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('three rules that all lost the check collapse to one report')` — three before the collapse, one after, with the fan-out stated. Written because the claim had been asserted in a docstring and was **false**: a constant `rule` is not enough, since the dedupe key prefers the stamped `ruleId`. The collapse is `dedupeConfigFindings`, which runs in `packages/ts/src/core/check-all.ts` — a direct `violations()` consumer still receives one per rule, and that is correct, since each rule really did lose its floor                                                                                                                                                                                                  | gated   |
| **C4** — The finding names what consumed the budget — **for a dominated-subtree walk**  | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('the finding names what consumed the walk, not the size of the repository')`, and the remedy proven behaviourally by `it('the stated remedy, applied, clears the finding')` — ADR-009 rule 2's corollary, which `packages/ts/tests/core/every-config-finding-is-classified.test.ts` requires of every producer. **Qualified after validation.** The remediation is proven where the top consumer is a disposable directory; it is NOT proven where the consumer is code, which the remedy text concedes ("the gap is real") and no test covers. Attribution is by first path segment, so in a monorepo dominated by `packages/` the message names `packages`, which is honest and not actionable                            | gated   |
| **C7** — A degraded instrument still answers honestly about what it cannot say          | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('the exhaustion fact is on the DiskSet, so the classification is not the only signal')` — `classify` still answers `not-determined`, and the fact sits beside it rather than replacing it. Tier corrected from 1 after validation — the mechanism is behavioural, not static. Note what discriminates: the `classify` assertion alone would pass on the PRE-fix code, since the silent `UNDETERMINED` also answered `not-determined`; only the `.exhaustion` presence and the descending order separate the two                                                                                                                                                                                                             | gated   |
| **C7** — An instrument that cannot meaningfully run does not run                        | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('a project with no repository above it is not walked at all')` — found by this ADR's own fix: a tsconfig with nothing above it walked the entire filesystem, invisibly, because exhaustion was silent. It now spies on Node's `readdirSync` and asserts **zero** reads, because the earlier assertions could not tell "did not walk" from "walked and found nothing" — validation caught the title claiming more than the test checked. Covers one of `build()`'s three early returns; the other two (non-absolute path, missing root) are covered by `packages/ts/tests/core/disk-set.test.ts`                                                                                                                             | gated   |
| **C5** — A bound is set from measurement, and changing it requires re-measuring         | 5    | Ratification. No mechanism can check that someone measured before editing a constant. The `ENTRY_BUDGET` docstring carries the measured rationale and names what depends on it, so the justification sits where the edit happens — the absence of exactly that is what licensed bug 0359                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | manual  |
| **C6** — Prefer an instrument bounded by the question over one bounded by a budget      | 4    | Semantic, and no mechanism is possible for a preference about instruments not yet written. [Spike 0367](../work/spikes/0367-must-the-disk-question-walk-the-whole-repo.md) is the worked example: the alternative was measured, costed and rejected on evidence rather than taste                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | manual  |
| **C1** — Only a rule the disk DECIDES is blamed for the walk                            | 2    | `packages/ts/tests/core/a-walk-that-gave-up-says-so.test.ts` · `it('a rule with no path glob is neither walked for nor blamed')` — a name-selecting `.notExist()` must produce no exhaustion finding and must not trigger a walk at all (asserted by spying on Node's `readdirSync`). Added after validation found the lookup running for every zero-examined cardinality rule: a globless rule walked the whole repository and was then told its absence went unchecked, which was false. Measured red before the guard                                                                                                                                                                                                                                                                       | gated   |
| **C1** — Every knowledge-bounding instrument in the dialect complies, not only the walk | 2    | **No mechanism, and the clause is FALSE today.** `MAX_OBJECT_LITERAL_DEPTH` stops `functions()` collecting below depth 3 with no report, so a function nested deeper is never selected and a rule over it passes while the code violates it — clause 1's own break class, in a second instrument. Break class: _a function at object-literal depth 4 is unselected and its rule goes green_. [Bug 0370](../work/bugs/0370-a-depth-capped-selection-narrows-silently.md)                                                                                                                                                                                                                                                                                                                        | pending |
