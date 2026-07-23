# Plan 0073: Violation telemetry + rule staleness

## Status

- **State:** Draft — blocked on a real, actively-churning adopter codebase. A
  2026-07-23 build attempt used **ts-archunit** as a proxy corpus and **rejected
  it** (see _Build attempt & finding_): ~80% of its violations are deliberate
  test-fixture code, and its real source is thin and stable (well-maintained), so
  there is no decay/growth churn to analyse. Promote to Ready when a genuinely
  messy external repo's run history exists.
- **Priority:** P2 — answers the strongest external critique of eess (rules must
  retire; staleness), but still cannot be validated without real churning data.
- **Effort:** ~2 sessions once real data exists.
- **Created:** 2026-07-19
- **Adopter lead (2026-07-23):** a greenfield build driven _from_ an external spec
  corpus would churn violations red→green as it is built — a candidate churning
  adopter, _if_ such a build is ever run inside eess. A lead, not the resolution: a
  spec corpus at rest is static (same trap as ts-archunit if measured without an
  active build).

## Problem

eess accumulates enforcement **monotonically**. Every plan adds rules; nothing
ever retires one. The manifesto now says out loud that this is wrong ("Rules age
— enforcement is not monotone"), but says it as a _stance_, with no mechanism
behind it.

Two independent lines of evidence, both recorded in
[the external-signals research](../research-external-signals-2026-07.md):

- **§3a — staleness is the strongest counter-pressure.** Raised independently by
  four practitioners: rules must be retired when models outgrow them; "forgetting
  is intrinsic to a functioning memory store"; review the rules file at every
  model release; use ablation to decide.
- **§4 — the missing consumer of our own signal.** An eess rule already _is_ a
  high-signal binary evaluator. What eess lacks is the aggregated error-analysis
  pass over violation history — in the Langfuse framing, the single
  highest-value move, and the one thing we emit data for but never read.

Both questions are answered by the same data, from opposite ends:

| Question                                    | Direction |
| ------------------------------------------- | --------- |
| Which rules no longer earn their place?     | _decay_   |
| Is the enforced surface growing or rotting? | _growth_  |

The _growth_ half arrives here from [plan 0067](./completed/0067-harness-informed-roadmap.md)
Phase 2 (coverage grades over time), deliberately merged rather than planned
separately: two plans over one data source would be written twice.

## Build attempt & finding (2026-07-23) — ts-archunit rejected as corpus

The Phase-0 replay was built and run (a git-worktree replay of ts-archunit's
history through eess-ts's `recommended` preset; the mechanism works). Reading the
actual output rejected ts-archunit as the corpus:

- **~80% test-fixture noise.** Of 47 violations at HEAD, **38 are in
  `tests/fixtures/`** — code ts-archunit deliberately writes to _violate_ the
  rules, in order to test them. Counting it measures ts-archunit's test suite,
  not code decay. (The `**/src/**` glob catches `tests/fixtures/*/src/`.)
- **Thin, stable real signal.** In actual source: **9 violations, all
  `no-silent-catch`**, and zero of the other three floor rules. Well-maintained
  code (customer-zero-like) does not churn violations — so there is no
  decay/growth signal to analyse.

Conclusion: a well-maintained, fixture-heavy repo is a poor telemetry corpus.
ts-archunit gives neither the insight nor enough real churn to validate the
mechanism meaningfully. The plan is back to **blocked on a genuinely churning,
real adopter** — the stronger form of the caveat it already carried. (Meta: this
confirmed the plan's own thesis — telling real signal from noise, and from
vacuous measurement, is the hard part; the corpus hit both traps.)

The replay _mechanism_ (worktree + preset, no per-commit install) is sound and
can be revived when a real corpus exists; the half-built script was not kept
(derived, and not worth carrying against a rejected source).

## Approach (sketch — awaits a real corpus)

**Phase 0 — generate the corpus.** Replay a real, churning codebase's git history
through eess-ts's `recommended` (or a broader) preset — one detached worktree,
checked out per sampled commit, scanning **real source only** (exclude
`tests/fixtures/**` — the 2026-07-23 finding) with `node_modules` available so
type-aware rules resolve. Aggregate into a JSON time-series with a `filesScanned`
denominator per point (so a 0 is provably clean, not vacuous). The mechanism is
proven; the blocker is a source with real churn.

**Phase 1 — the run-corpus format.** `--format json` already emits
`file`/`line`/`ruleId`/`because`/`suggestion`/`docs` per violation. Define the
append-only run store (plus the existing baselines, already a frozen labelled
failure corpus): **opt-in, local-only, git-ignorable** — never leaving the
machine without explicit opt-in.

**Phase 2 — the decay signal.** Per rule: last-fired, fire count, files matched.
Surface "this rule has not fired in N months across all runs — retire, or keep
deliberately?" Only meaningful over a corpus that actually _churns_ (a never-firing
rule is credibly stale only if other rules fired and stopped) — which is exactly
what ts-archunit lacked. A rule that matches zero elements is already a
non-vacuity failure; this is the softer, temporal cousin.

**Phase 3 — the growth signal.** Per-tier / per-package coverage grades, trended,
computed **from `check:spec`'s coverage data** (the coverage = direction from
plan 0061) and reported as a **trend, not a new blocking gate**. The enforced
surface becomes visibly growing or rotting rather than a snapshot.

**Phase 4 — the analysis pass.** Dominating-pattern analysis over the corpus →
proposed imperative blocks / rule updates. **Human-ratified: the loop may
propose, adoption stays a human act (Tier 5).** This is the anti-Goodhart guard —
a gate that rewrites its own rules is not an external oracle.

## Out of scope

- Any telemetry that leaves the user's machine without explicit opt-in.
- Auto-retiring a rule. The signal is advisory; removal is a human decision with
  an ADR row behind it.
- LLM judgment anywhere in the decay path — the decision must stay defensible in
  an engineering review.
- **Ablation-based decay** (run with/without a rule to prove it is stale) — a
  future strengthening. v1's decay signal is fire-count + last-fired, which is
  defensible only over a corpus that genuinely churns (unlike a static green
  repo — or, per the 2026-07-23 finding, a well-maintained one like ts-archunit).

## Success definition

A rule that has stopped discriminating is _visible_ as such, and the ADR
Enforcement table can carry an honest `review-by` rather than an implicit
"forever". A green that can no longer fail is reported as suspicious, not as a
pass.

## Design decisions (some still open)

Settled (independent of the corpus source):

- **Corpus location & ownership** — local, **git-ignored derived data** (a
  `work/telemetry/`-style path); never committed (large + derived), never leaves
  the machine without explicit opt-in.
- **Growth-grade home** — computed **from `check:spec`'s coverage data** (the
  coverage = direction, plan 0061), reported as a **trend, not a separate blocking
  gate** — consistent with the signal-is-advisory stance.

Re-opened by the 2026-07-23 finding (these are the blocker):

- **Which corpus** — ts-archunit is rejected; the plan needs a real, churning
  codebase. Any candidate must be scanned **real-source only** (exclude
  test-fixtures) and must actually churn violations over time.
- **"Stale" vs "clean"** — fire-count + last-fired is only meaningful over a
  churning corpus; distinguishing "rule is stale" from "code is clean" over a
  well-maintained repo may still need the ablation trick. Unresolved until a
  corpus exists.
