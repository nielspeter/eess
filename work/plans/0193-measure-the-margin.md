# Plan 0193: Measure the margin

## Status

- **State:** Draft — **rewritten 2026-08-21** after a six-persona review found
  three Critical defects in the first version. The problem is unchanged and real;
  the design, the metric, the population and every cost figure are different.
- **Priority:** High — this is the number that would have caught most of what
  PR #72's review rounds found, before a human had to.
- **Effort:** Medium. The measurement works; making it honest and affordable is
  the work.
- **Tier:** 2 (behavioral) — the harness _executes_ the suite. It does not
  inspect source shape.
- **Created:** 2026-08-21

## Problem

**Margin** is how far a primitive is from being unfalsifiable: mutate it so it
stops discriminating, and count what notices. Margin 0 means nothing notices —
a check that cannot fail, ADR-009's object.

Nothing computes it. Six primitives were found at margin 0 by hand
([0186](../bugs/fixed/0186-two-security-rules-cannot-fail.md),
[0187](../bugs/fixed/0187-four-visibility-and-async-predicates-cannot-fail.md)),
in a sweep that took two hours and whose result exists nowhere in the repo.

**Every gate the repo has answers a different question.** `check:nonvacuity`
proves a _gate_ fails on a violating fixture. `check:vacuity` proves a published
_constructor_ is not fail-open. Neither asks how much would have to be deleted
before a primitive stopped being checked. Both went blind at some point during
the fold (PR #72), which is the argument for a number computed rather than
asserted.

## What the first version of this plan got wrong

Recorded rather than quietly fixed, because the errors are the same class the
plan is about.

**The population was hand-derived, and contradicted a guarded one.** It claimed
"183 primitives across `src/rules/`, `src/conditions/`, `src/predicates/` and
`src/presets/`" while its own distribution table summed to 181.
`packages/ts/tests/tools/scan-enforceable-primitives.ts` already derives this
mechanically and exists _because_ the count was previously reported as 166, 185,
187, 231 and 150 — "a recollection with a method attached". ADR-009's own context
table carries the row `A hand-typed measurement in a plan | Already wrong`. This
plan produced the sixth number, by the method named as the cause of the first
five.

**The metric counted the wrong unit.** `noConsole`'s margin of 4 is five `it`
blocks inside one `describe`, in one file — one `describe` deletion from ≤1, one
file deletion from 0. Counting tests overstates robustness in the **fail-open**
direction, and is trivially inflatable: `it` → `it.each` with five rows moves
margin 1 → 5 with no new evidence.

**The gate could not fire on its own break class.** Phase 2 triggered on changed
primitive _sources_; the Success clause's sabotage was "gut a primitive's only
test". Gutting a test changes no source. Bug 0187 — a motivating bug — had no
source-side defect at all.

**The mutation operator was never defined, and the acceptance values encoded an
unstated choice.** Measured on `noJsonParse`:

| operator                                        | margin |
| ----------------------------------------------- | ------ |
| `{ description: 'GUTTED', evaluate: () => [] }` | 2      |
| description preserved, `evaluate: () => []`     | **1**  |

Both readings are available in the old text. Under the second, `noJsonParse` is
at margin 1 — so "42 at margin 1" was an artefact of an unstated operator, and an
undercount.

**Three claims did not survive re-measurement**: the full-suite baseline (33s
stated, 58.9s measured, and the repo's own config records ~2min in CI); "0–1
primitives per commit" (right as a median over 138 commits on `main`, but this
branch touches 38 primitive-bearing files carrying **161** primitives ≈ 43
minutes); and "the 4 seconds buys correctness" — dist-touchers cannot observe a
`src` mutation at all without a rebuild, which nothing in a vitest run does.

## Design

### The population is the committed one

`scanEnforceablePrimitives()` — **181 primitives**, measured 2026-08-21:

|                   |     |
| ----------------- | --- |
| `src/conditions/` | 66  |
| `src/predicates/` | 51  |
| `src/rules/`      | 51  |
| `src/graphql/`    | 8   |
| `src/core/`       | 3   |
| kernel            | 2   |

It defines a primitive by **return type**, not folder, and **excludes presets
deliberately** (`scan-enforceable-primitives.test.ts`: _"A preset is
heterogeneous but is NOT a primitive"_). If margin should cover presets, that is
a change to the shared rule with the census's own floor as its guard — not a
second private population.

Consequence: the derivation lives in `packages/ts/tests/tools/`, test-only and
eess-ts-local. It needs a shared home (`scripts/lib/`) before it has two
consumers, or margin forks the count a seventh time.

### The metric is failing FILES, with the test count reported alongside

`margin = |distinct test files that fail|`, computed as an **identity diff**, not
a count: record the failing `fullName` set on a clean run over the covering set
(must be empty), run mutated, report `mutated \ baseline`. Cardinality is what
produced this repo's own off-by-one; identities are what ADR-009 rule 4 asks for.

File granularity is immune to `it.each` inflation — but **not** to the symmetric
cheat: splitting one test file into five yields margin 5 with no new evidence.
And `|files|` is itself a cardinality, which sits awkwardly beside this plan's own
"cardinality is what produced the off-by-one" — the identity diff is what
answers that, not the unit. The test count is reported because it is
informative, and not gated on because it is not.

#### THREE units are in play, and the anchors were recorded in the third

Measured independently by two reviewers in separate worktrees, and reproduced:

| primitive     | record's operator, **tests** (what 0186/0187 recorded) | this plan's operator, **tests** | this plan's operator, **files** (the gated metric) |
| ------------- | ------------------------------------------------------ | ------------------------------- | -------------------------------------------------- |
| `noConsole`   | 4                                                      | 3                               | 1                                                  |
| `noJsonParse` | 2                                                      | 1                               | 1                                                  |
| `arePublic`   | 3                                                      | 2                               | 1                                                  |
| `areNotAsync` | 2                                                      | 1                               | 1                                                  |

Every anchor drops by exactly one between column 1 and column 2, because in each
case one failing row is a **description assertion** (`noConsole() describes
itself by its matcher`, `describe themselves by their scope`, and so on) — which
this plan's `Condition` operator deliberately preserves.

Two consequences, both of which Phase 1's acceptance clause got wrong:

- **0186/0187's headline numbers are NOT this gate's acceptance values.** They
  are column 1. Acceptance is stated in column 3, the gated metric's own unit.
- **In file units all six repaired primitives sit at 1**, the minimum non-zero
  value — every covering test for them lives in a single file. That is fine for
  ADR-009's binary question (`0` vs `≥1`) and this gate only asks the binary
  question. But it must be said out loud: **for this repo's coverage shape the
  file metric is effectively `0 | ≥1`**, not a gradient.

`areAsync` is the one anchor with a margin large enough to distinguish the file
metric from the test metric, and it is the one nobody has a number for (0187
records "~9", honestly labelled as not re-measured). Phase 1 should measure it
first — it is the only case that tests the metric rather than the plumbing.

### The mutation operator, per kind — pinned in the script

| kind            | operator                                     | why not the alternative                                                                                                                                                                        |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Condition`     | preserve `description`, `evaluate: () => []` | replacing the description also breaks identity assertions, which are a real but _different_ guard. Report both numbers where they differ.                                                      |
| `Predicate`     | preserve `description`, `test: () => true`   | `test: () => false` selects nothing, trips ADR-010's zero-examined floor, and reddens every rule using it — measuring the **evidence gate**, not the predicate. Uniformly inflated, fail-open. |
| `PairCondition` | preserve `description`, `evaluate: () => []` | same shape as `Condition`; stated because it is a third type.                                                                                                                                  |

**Every row states the `description` disposition, and that is not cosmetic.** The
first version of this table left it unstated on the `Predicate` row while
deliberating it at length on the `Condition` row — worth exactly ±1 per
predicate, which is the same "artefact of an unstated operator" this plan
diagnoses elsewhere. 0187's own repro was `{ description: 'MUTATED', test: () =>
true }`; this gate preserves it, so the gate does not see what those description
assertions protect. That is a deliberate trade (identity assertions are a real
but different guard) and it is recorded here as a decision, not assumed.
| preset | n/a | not in the population. |

### The trigger is both sides of the edge

`(primitives whose source changed) ∪ (primitives whose covering set contains a
changed test file)`. The second half is the inverse of the index Phase 1 already
builds, and it is the half that would have caught bug 0187.

### The covering set has four channels, and the completeness claim is dropped

1. import-graph reachable;
2. tests that read `src/` as text (`readFileSync`);
3. tests that touch `dist/` — **and the harness must rebuild** (measured: 1.3s)
   or these are inert cost, not correctness;
4. tests that build a ts-morph `Project` over `src/` — `dogfood.test.ts` and
   `arch-rules.test.ts` observe every file with no import edge and no
   `readFileSync`.

**Not complete, and the plan says so.** Nested vitest subprocesses, `bash -c`
spawns and computed `await import(path.join(...))` are real channels that are not
statically detectable. The error direction is fail-closed — a missed observer
under-reports margin, producing a false red — so the gate must explain a red well
enough that a false one is recognisable, and Phase 1 owns the detection rules as
tested code rather than prose counts.

### Cost, re-derived — and what happens when it is too much

|                                      |                                              |
| ------------------------------------ | -------------------------------------------- |
| per primitive, narrowed, local       | ~16s                                         |
| the same, CI-scaled                  | ~30–35s                                      |
| median commit on `main` (126 of 138) | **0 primitives — no cost**                   |
| this branch vs `main`                | 38 files → **161 primitives ≈ 43 min local** |

The median is free and the tail is unaffordable, so the gate needs a policy, not
an average. **Cap at N primitives and report every one skipped by name.** A
silent truncation here would be the same defect as a silent margin.

**The overflow is disclosed-and-dropped, not deferred.** An earlier version of
this paragraph handed the remainder to "the periodic sweep" — grep says no such
thing exists: no phase, no file, no schedule, and `.github/workflows/` holds only
`ci.yml` and `publish.yml`. Deferring to a mechanism that does not exist is the
wrong-home defect this corpus keeps catching, and it mattered most precisely
here: the plan's own cost table says the tail case is a wholesale fold like the
one that INTRODUCED bugs 0186/0187, so the cap would have deferred almost
everything on the one commit where it counted. Until a sweep is actually filed,
the capped remainder is unchecked and the gate says so by name on every run.

## Implementation phases

### Phase 0 (FIRST) — the ADR-009 amendment, which owns the definitions

**Re-ordered from last to first, and the reason is binding, not stylistic.**

ADR-009 records _"We deliberately do **not** dogfood these six rules"_, carries
rule 5 (independence) as `manual`, and lists under Alternatives Considered that
this is _"worth revisiting if a mechanical subset emerges"_. Margin **is** that
subset — rule 5's reviewer question (`adr/009-agent-first-failure-surfaces.md:288-291`:
_"what would this test do if the thing it guards were completely broken?" If the
answer is "pass," the derivations are not independent_) computed instead of asked.

**The metric definition and the mutation-operator table move into the ADR.** They
do not stay here. This plan's Design section pins four things everything
downstream depends on — `margin = |distinct failing test FILES|` as an identity
diff, the per-kind operator table, `unmeasurable` fails, and the cap policy — and
the plan itself measures that the operator choice alone moves `noJsonParse`
between 2 and 1. A `check:margin` citation from the ADR's Enforcement table means
only what the operator table says, and **this plan closes to
`work/plans/completed/`**. ADR-009 rejects exactly that, verbatim, in its own
Alternatives Considered:

> Rejected. A completed plan moves to `work/plans/completed/`, so a binding
> project-wide rule would be buried where nobody greps — the exact failure this
> ADR describes.

Building the mechanism first and amending after would open a window in which a
binding ADR says no mechanism is possible while one ships — the drift
`check:corpus` exists to catch, scheduled deliberately. Decision before work.

**The rule-5 row is SPLIT, not flipped.** Flipping it wholesale would over-claim:
rule 5 covers every derivation in this repo — including the census's own
166/185/187/231/150 history and the ADR enforcement convention — while
`check:margin` sees 181 eess-ts primitives and nothing else. Claiming mechanical
coverage of the remainder is "an enforced rule that is wrong" over "an
unenforceable rule stated honestly", the inversion `adr/009-agent-first-failure-surfaces.md:292-295`
warns against. Two rows:

| clause                                                      | tier | mechanism                          | status   |
| ----------------------------------------------------------- | ---- | ---------------------------------- | -------- |
| Rule 5 (independence) over `eess-ts` enforceable primitives | 2    | `scripts/check-margin.mjs`         | `gated`  |
| Rule 5 (independence) everywhere else                       | 5    | reviewer question, review-enforced | `manual` |

If Phase 1's measurement does not hold up, the honest outcome is the second row
alone plus a recorded refusal in the ADR — not a `gated` row over a mechanism
that does not work.

### Phase 1 — `scripts/margin.mjs`, and its guards

_Runs after Phase 0: the ADR amendment is the decision this builds against._

The measurement, consuming the shared census. Its guards are the deliverable as
much as the number is:

- **green baseline over the identical file set** before the gut — any
  pre-existing failure is `unmeasurable`, never subtracted. This is the hole that
  produced the corrected margins in 0186/0187 (a stale `dist` failing one
  unrelated test in every run); it parses cleanly and has no timeout, so neither
  of the first version's guards saw it.
- **the mutated run's file and test counts must equal the baseline's.** A
  zero-file-match run exits cleanly, parses, and yields margin 0 — i.e. reports a
  healthy primitive as unfalsifiable. Hit first-hand by a reviewer.
- **assert the mutation applied non-trivially.** A no-op edit yields margin 0 and
  a false "unfalsifiable" — the fail-open direction.
- `unmeasurable` on an unparseable summary or a timeout.
- **attribute every counted failure to the mutation.** This guard was missing
  from the first version and it is the fail-OPEN one — the other four protect
  against a false red. Measured by two reviewers independently: a mutated run
  carried 3 extra failures in `scan-enforceable-primitives.test.ts` that fail on
  a **clean, unmutated tree** ([bug 0196](../bugs/0196-the-census-test-has-an-undeclared-build-dependency.md)),
  and under a bare `mutated \ baseline` identity diff those 3 become margin.
  Noise only ever ADDS failing files, so it lifts a genuine **0** — the gate's
  only red state — to 1 and silently clears it. Two mechanisms, both required:
  re-run the failing set unmutated and keep only failures that clear, **and**
  require each counted failure's file to be in that primitive's covering set.
- **hold the tree exclusively.** ADR-009 states both halves and the first version
  of this plan ported one: _"Assert a green baseline before the first patch, **and
  hold the tree exclusively** (an isolated git worktree, or nobody else running)"_
  (`adr/009-agent-first-failure-surfaces.md:247-253`). This is a guard the script
  asserts — own worktree, fresh build, no concurrent build — not prose, because
  the cost model puts this gate in CI and in a repo where `npm run validate` runs
  beside agents.

**Acceptance:** re-derive the anchors **in the gated metric's own unit** —
column 3 of the three-units table above, not the headline numbers in 0186/0187,
which are column 1. Concretely: `noConsole` · `noJsonParse` · `arePublic` ·
`areNotAsync` each report margin **1 file**, and the script's reported test
counts match column 2 (3 · 1 · 2 · 1). If the script disagrees with either
column, that is a script bug; if a reviewer disagrees with the columns, re-measure
before editing them. Measure `areAsync` first — it is the only anchor whose file
and test margins differ, so it is the only one that tests the metric rather than
the plumbing.

**A builder of this phase should not have to distinguish a script bug from a spec
conflict**, which is exactly what the first version of this clause forced: it
asked for "the four anchors" against an operator that produces different numbers
than the four anchors were recorded under.

**Files:** `scripts/margin.mjs`, `scripts/lib/primitives.mjs` (the census),
`scripts/lib/primitives.d.mts`, `packages/ts/tests/tools/scan-enforceable-primitives.ts`.

**The census move is a port, not bookkeeping — three things this must settle.**
Placement is right: the census derives its population from `packages/ts/package.json`'s
`exports` map, it is a repo dogfood tool (a `margin` CLI command is out of scope
below), and `scripts/lib/` is where this repo already puts one source shared by a
gate and a test — `packages/ts/tests/standalone-surface.test.ts:10` imports
`scripts/lib/kernel-surface.mjs` today. But:

- **The guard must move WITH the census, and its slack must be re-set.**
  `packages/ts/tests/tools/scan-enforceable-primitives.test.ts:57` sets
  `POPULATION_FLOOR = 150` against a real population of **181** — 31 primitives,
  a 17% collapse, before anything reds. Once this census is margin's _scope_, a
  shrinking population is a cheaper and quieter green: fewer primitives measured,
  same exit 0. The file-set guard ("no FILE has left the population") and the
  floor both live in the **test**, which the first version of this Files line did
  not mention at all — so say explicitly that both move with the derivation and
  that margin's scope inherits them, and raise the floor to something that
  actually binds.
- **It leaves ADR-005's perimeter.** `eslint.config.ts:26-34` scopes
  `no-explicit-any` and friends to `packages/*/src/**` and `packages/*/tests/**`.
  Moving a 332-line ts-morph derivation to `scripts/**.mjs` moves it out of that
  block, and the precedent's cost is visible: `scripts/lib/kernel-surface.d.mts`
  is four hand-written `Set<string>` lines. A hand-maintained `.d.mts` for a
  derivation this size is a real drift surface — either extend the ESLint block to
  cover `scripts/lib/**` or say why the `.d.mts` is acceptable here.
- **One implementation, not two.** A `.mjs` script cannot import the `.ts`, so the
  derivation moves and `scan-enforceable-primitives.ts` becomes a shim — which
  means the existing 462-line guard test then tests _through_ a shim into untyped
  JS. Name which file holds the implementation before writing either.
- **Effort.** This is a TS→JS port of 332 lines of ts-morph plus its guard. The
  first version of this line booked it as "moved to a shared home"; it is not.

**Tests:** covering-set computation against a fixture package with a known import
shape — one test reaching the target only through a barrel re-export (channel 1),
one only by reading it as text (channel 2), one that cannot reach it and must be
excluded; a mutation-applied assertion per kind; an `unmeasurable` case per
guard; and an **attribution** case — a fixture whose baseline is dirty in a file
outside the covering set, which must not count toward margin.

**Channels 3 and 4 need fixtures too, and channel 4 is the consequential one.**
The first version of this list covered 1 and 2 and stopped. `dogfood.test.ts` and
`arch-rules.test.ts` build a ts-morph `Project` over `src/`, so they cover
**every** primitive with no import edge — get channel-4 detection wrong
fail-open and covering sets narrow to nothing and every margin is under-reported;
wrong the other way and every covering set is the whole suite and the cost model
collapses. Fixture: a `Project`-building test that reaches a target no import
edge and no `readFileSync` reaches. Channel 3 needs one test touching `dist/`
with the rebuild asserted.

### Phase 2 — `check:margin`, diff-aware, fails on zero

Trigger as above. **`unmeasurable` fails the gate**, with one bounded retry _of
the identical file set_ — never a retry that changes the set. If it passed, the
cheapest route to green on a red primitive would be to make its run unparseable.

Prints its denominator on success: how many primitives were in scope, each
covering-set size, and every primitive skipped by the cap. "0 in scope" must be
distinguishable from "0 because the walk broke" — and per
[bug 0174](../bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) no
existing gate does this, so a new one has no excuse.

**Three break classes**, all needing fixtures:

1. a primitive whose only covering test is gutted reds the gate and names it;
2. a broken summary parse reds as `unmeasurable` rather than exiting 0;
3. **a diff that touches a primitive, with the covering-set index deliberately
   emptied, must red.** This third one was missing and it is the one the gate's
   own cost table argues for: **126 of 138 commits have 0 primitives in scope**,
   so a zero denominator is the gate's ordinary state and a broken index or walk
   is indistinguishable from the 91% normal path. Without this fixture the
   cheapest route to green on a red primitive is to make the trigger miss it —
   and "0 in scope" vs "0 because the walk broke" is a distinction Phase 2
   already promises to print but nothing would enforce.

**Files:** `scripts/check-margin.mjs`, `package.json`,
`.github/workflows/ci.yml`, `scripts/check-nonvacuity.mjs`,
`scripts/nonvacuity/bad-margin.mjs`.

**Open, and Phase 2 must settle it:** the non-vacuity fixture would be the first
that writes to the tree it validates and runs the suite as a subprocess. A
miniature fixture package with its own tiny suite is the only shape that fits the
existing fixtures — and it changes what `margin.mjs` is parameterised over (a
package root, not a hardcoded `packages/ts`).

## Out of scope

- **The ratchet** — gating on a _drop_ rather than on zero. Split to
  [plan 0194](./0194-the-margin-ratchet.md) on this plan's own logic: if
  fail-on-zero is an acceptable terminal state, it is a shippable thing, and a
  checked-in file of accepted numbers is a separate bet on an open question. The
  trigger fix above also shrinks it — a zero-only gate catches every 1→0 slide at
  no extra cost, so the ratchet is only needed for drops that never reach zero.
- **A real mutation score.** One operator per kind is not a mutation score. It
  answers "can this fail at all", which is ADR-009's question, and is not more.
- **Plan 0188 Phase 3** (anti-re-fork) and
  [bug 0192](../bugs/0192-nothing-detects-a-dialect-shadowing-a-kernel-name.md)
  (name shadowing) — three distinct gates, none subsuming another.
- **The other four dialects.** Measured on eess-ts only; the covering sets may
  not narrow at all elsewhere.
- **Adopter-facing use.** Margin measures eess's tests against eess's primitives.
  An adopter's analogue is ADR-010's evidence gate and `eess-ts doctor`. No
  `margin` command is planned, and `docs/dogfooding.md` should scope any row it
  gains to eess-ts.

## Success definition

- Reports a number or `unmeasurable` — **never a zero it did not measure**.
- Fails on margin 0, sabotage-proven **on a test-only diff**, which is the input
  the first version's trigger was blind to.
- Fails on `unmeasurable`, sabotage-proven by breaking the summary parse.
- Both break classes registered in `scripts/check-nonvacuity.mjs`.
- Prints its denominator, including every primitive the cap skipped.
- The four anchors reproduce under the committed operator.
- Median-commit cost is zero; the tail is capped and the cap is reported.

## Progress ledger

- [ ] Phase 0 — ADR-009 amended FIRST: the metric definition and operator table
      land in the ADR, and rule 5's row is split (Tier 2 `gated` over eess-ts
      primitives + Tier 5 `manual` elsewhere), or the refusal is recorded there
- [ ] Phase 1 — `scripts/margin.mjs` + census port + guards, anchors reproduced
- [ ] Phase 2 — `check:margin`, both break classes fixtured, denominator printed

Deferred: the ratchet → [plan 0194](./0194-the-margin-ratchet.md).
