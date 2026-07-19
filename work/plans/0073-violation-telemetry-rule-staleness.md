# Plan 0073: Violation telemetry + rule staleness

## Status

- **State:** Draft — waiting on real adopter usage. The mechanism is designable
  today; the _input_ is not. Aggregating violation history across one repo that
  is already green tells us nothing. Promote to Ready when there is a corpus of
  runs from at least one repo that is not this one.
- **Priority:** P2 — answers the strongest external critique of eess, but
  cannot be validated without data.
- **Effort:** ~2 sessions once data exists.
- **Created:** 2026-07-19

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

## Approach (sketch — a Draft, not a frozen floor)

**Phase 1 — a run corpus.** `--format json` already emits
`file`/`line`/`ruleId`/`because`/`suggestion`/`docs` per violation. Append runs
to a local, git-ignorable store (plus the existing baselines, which are already a
frozen labelled failure corpus). Decide: opt-in or default; local-only or
shareable.

**Phase 2 — the decay signal.** Per rule: last-fired, fire count, files matched.
Surface "this rule has not fired in N months across all runs — retire, or keep
deliberately?" A rule that matches zero elements is already a non-vacuity
failure; this is the softer, temporal cousin.

**Phase 3 — the growth signal.** Per-tier / per-package coverage grades, trended,
sitting on `check:spec` (the coverage = direction from plan 0061). The enforced
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

## Success definition

A rule that has stopped discriminating is _visible_ as such, and the ADR
Enforcement table can carry an honest `review-by` rather than an implicit
"forever". A green that can no longer fail is reported as suspicious, not as a
pass.

## Open questions (resolve before Ready)

- [ ] Where does the run corpus live, and who owns it — repo, user home, CI artifact?
- [ ] Is "hasn't fired in N months" meaningful in a repo that is simply _correct_?
      Distinguishing "rule is stale" from "code is clean" may need the ablation
      trick (run with/without) rather than fire counts alone.
- [ ] Does the growth grade belong on `check:spec`, or is it its own gate?
