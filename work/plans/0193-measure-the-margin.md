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

File granularity is immune to `it.each` inflation. The test count is reported
because it is informative, and gated on because it is not.

### The mutation operator, per kind — pinned in the script

| kind            | operator                                     | why not the alternative                                                                                                                                                                        |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Condition`     | preserve `description`, `evaluate: () => []` | replacing the description also breaks identity assertions, which are a real but _different_ guard. Report both numbers where they differ.                                                      |
| `Predicate`     | `test: () => true`                           | `test: () => false` selects nothing, trips ADR-010's zero-examined floor, and reddens every rule using it — measuring the **evidence gate**, not the predicate. Uniformly inflated, fail-open. |
| `PairCondition` | `evaluate: () => []`                         | same shape as `Condition`; stated because it is a third type.                                                                                                                                  |
| preset          | n/a                                          | not in the population.                                                                                                                                                                         |

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
an average. **Cap at N primitives, report every one skipped by name, and hand the
remainder to the periodic sweep.** A silent truncation here would be the same
defect as a silent margin.

## Implementation phases

### Phase 1 — `scripts/margin.mjs`, and its guards

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

**Acceptance:** re-derive the four anchors under the committed operator rather
than trusting the hand numbers. Both operators' values are recorded above; the
script's output must match the one it declares.

**Files:** `scripts/margin.mjs`, `scripts/lib/primitives.mjs` (the census, moved
to a shared home), `packages/ts/tests/tools/scan-enforceable-primitives.ts`
(import path only).

**Tests:** covering-set computation against a fixture package with a known import
shape — one test reaching the target only through a barrel re-export, one only by
reading it as text, one that cannot reach it and must be excluded; a
mutation-applied assertion per kind; an `unmeasurable` case per guard.

### Phase 2 — `check:margin`, diff-aware, fails on zero

Trigger as above. **`unmeasurable` fails the gate**, with one bounded retry _of
the identical file set_ — never a retry that changes the set. If it passed, the
cheapest route to green on a red primitive would be to make its run unparseable.

Prints its denominator on success: how many primitives were in scope, each
covering-set size, and every primitive skipped by the cap. "0 in scope" must be
distinguishable from "0 because the walk broke" — and per
[bug 0174](../bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) no
existing gate does this, so a new one has no excuse.

**Two break classes**, both needing fixtures: a primitive whose only covering
test is gutted reds the gate and names it; and a broken summary parse reds as
`unmeasurable` rather than exiting 0.

**Files:** `scripts/check-margin.mjs`, `package.json`,
`.github/workflows/ci.yml`, `scripts/check-nonvacuity.mjs`,
`scripts/nonvacuity/bad-margin.mjs`.

**Open, and Phase 2 must settle it:** the non-vacuity fixture would be the first
that writes to the tree it validates and runs the suite as a subprocess. A
miniature fixture package with its own tiny suite is the only shape that fits the
existing fixtures — and it changes what `margin.mjs` is parameterised over (a
package root, not a hardcoded `packages/ts`).

### Phase 3 — the ADR-009 amendment

ADR-009 records _"We deliberately do **not** dogfood these six rules"_, carries
rule 5 (independence) as `manual`, and lists under Alternatives Considered that
this is _"worth revisiting if a mechanical subset emerges"_. Margin **is** that
subset — rule 5's reviewer question computed instead of asked.

Either flip that row to a Tier-2 mechanism citing `check:margin`, or record in the
ADR why margin does not discharge rule 5. Shipping the mechanism while a binding
ADR says none is possible is the drift `check:corpus` exists to catch.

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

- [ ] Phase 1 — `scripts/margin.mjs` + shared census + guards, anchors reproduced
- [ ] Phase 2 — `check:margin`, both break classes fixtured, denominator printed
- [ ] Phase 3 — ADR-009's rule-5 row amended, or the refusal recorded there

Deferred: the ratchet → [plan 0194](./0194-the-margin-ratchet.md).
