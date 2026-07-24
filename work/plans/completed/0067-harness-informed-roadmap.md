# Plan 0067: Harness-Informed Roadmap

## Status

- **State:** Done — Phase 1 shipped with the plan on 2026-07-08 (`check:fast`
  plus the agent-actionable gate-output documentation). Closed 2026-07-19 at
  Phase 1, which is its honest delivery: Phases 2–5 were never scheduled work,
  they were a standing backlog wearing a plan's clothes. Each is re-homed to the
  board as a separately-schedulable item — see [Close-out](#close-out-2026-07-19).
  **Deferred: plans [0073](../0073-violation-telemetry-rule-staleness.md), [0076](../0076-broader-deterministic-autofix.md), [0077](./0077-author-validate-fix-loop.md), [0079](../0079-tier-2-3-mechanization.md) — all Draft.**
- **Priority:** P2 — sharpen eess as a reusable harness; no blockers
- **Effort:** Phase 1 ≈ 0.5 day (done); Phases 2–5 sized below, re-homed unbuilt
- **Created:** 2026-07-08
- **Closed:** 2026-07-19

## Problem

Two public case studies — OpenAI's [Harness
engineering](https://openai.com/index/harness-engineering/) and Stripe's
[Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents)
— describe building, from scratch and per repo, the exact guardrail layer eess
packages: layered-architecture structural tests, doc-as-system-of-record with
mechanical consistency checks, remediation-in-lint-messages, promote-prose-to-code,
and continuous entropy cleanup. The positioning is written up in
[eess as a harness](../../../docs/eess-as-a-harness.md).

Reading those write-ups against eess surfaces concrete, in-scope improvements — and
one honest frontier. eess is a **validation** framework (spec ↔ code, drift fails
the build), not an agent orchestrator, so orchestration concerns (devboxes, MCP
tool fleets, app-legibility infra, parallel agents) are deliberately out of scope.

## Phase 1 — Quick wins (done)

### 1a. Agent-actionable gate output — document what already exists

OpenAI: _"because the lints are custom, we write the error messages to inject
remediation instructions into agent context."_ eess already does this — the gap
was discoverability, not capability. Every `ArchViolation` carries `because`,
`suggestion`, `docs`, and `fix`, and all three formatters surface them
(`packages/core/src/format.ts` prints `Fix:` / `Docs:`; `format-json.ts` includes
`ruleId/because/suggestion/docs`; `format-github.ts` appends them). Phase 1
documents this for agents in `CLAUDE.md` so a failing gate is read as an
instruction, and `--format json` is the machine-readable stream.

### 1b. `check:fast` — shift feedback left

Stripe: local lints in _under five seconds_ before CI. eess has the primitives
(diff-aware `--changed`, `--watch`) but `npm run validate` runs the whole chain
(build + ~1900 tests + every gate). Phase 1 adds a `check:fast` script composing
just the spec/arch gates (corpus + spec + arch), skipping build, typecheck, lint,
tests, diagram, crossval, and non-vacuity — the pre-commit / on-save tier.

Caveat (documented): `check:fast` runs the installed/built CLI against current
source; it does not rebuild the engine, so if you change the engine itself, run a
full `validate`. In a consuming repo the CLI is installed, so this is moot.

## Phase 2 — Coverage grades over time (re-homed → plan 0073)

OpenAI grade _each domain/layer_ in a `QUALITY_SCORE.md` and their background tasks
_"update quality grades."_ eess has `work/dogfood-coverage.md` — but as a snapshot,
not a graded, tracked-over-time view. This is the temporal version of eess's core
move ("make the unenforced surface queryable"): a per-tier / per-package coverage
grade, emitted by a gate and trended, so the enforced surface is visibly growing or
rotting. Sits naturally on `check:spec` (coverage = direction already exists from
plan 0061). **Effort: ~1 session.**

**Re-homed** into [plan 0073](../0073-violation-telemetry-rule-staleness.md),
which measures rule _decay_ from the
same telemetry this measures _growth_ from — one mechanism, two questions
("which rules no longer earn their place" / "is the enforced surface growing or
rotting"). Two plans over one data source would have been written twice.

## Phase 3 — Broaden deterministic autofix (re-homed → plan 0076)

Both shops lean on autofix (Stripe _auto-applies_ test autofixes). eess's `--fix`
(plan 0066) is link/pointer-only. Extend the `ArchFix` model to more rule classes
where the repair is provably unique (e.g. a missing `.because`, a sanctioned
`eess-exclude` with reason, an import moved to satisfy a layer). **Effort: ~2
sessions.** Continues plan 0066's fix-side-of-the-tier-model direction.

**Re-homed** as [plan 0076](../0076-broader-deterministic-autofix.md) (Draft,
P2, unblocked) — where its scoping step promptly found that two of the repair
candidates named here are _not_ provably unique, so they are recorded as rejects
rather than inherited unexamined.

## Phase 4 — author → validate → fix loop (re-homed → plan 0077)

OpenAI's _"Ralph Wiggum Loop"_ of agent reviewers until satisfied; Stripe's bounded
_two rounds_. eess ships the `eess-adr-author` and `eess-adr-validate` skills that
hand off, but no loop that runs author → validate → fix → re-validate until
green-or-escalate, with a bounded round count. Formalize it as a skill/workflow.
**Effort: ~1 session.**

**Re-homed** as [plan 0077](./0077-author-validate-fix-loop.md) (Draft, P2, unblocked), and **smaller than
written**: plan 0068 shipped the working-method kit, so the lane discipline
(`/plan-*`, `/bug`, `/close`) now exists — what is still missing is only the
bounded re-validate round. Two constraints from
[the external-signals research](../../research-external-signals-2026-07.md) bind it:
the loop may _propose_ rule changes but adoption stays a human act (§4, the
anti-Goodhart guard, = Tier 5), and the verifier must be separated from the
author — fresh context, ideally a different model (§2).

## Phase 5 — Tier 2/3 mechanization (frontier; re-homed → plan 0079)

The honest gap. eess mechanizes **Tier 1** (eess-ts) plus the md/crossval binding;
the manifesto _describes_ Tiers 2–5 but eess provides no mechanism for them — it
only resolves a cited behavioural test. OpenAI and Stripe verify Tier 2/3
(behavioural via bootable app + perf SLOs; operational via observability). A
Tier-2 binding (clause → contract/property test, beyond citation resolution) or a
Tier-3 policy-as-code hook would extend eess past the static tier. **Large scope;
own plan when scheduled.** Explicitly not attempted here.

**Re-homed** as [plan 0079](../0079-tier-2-3-mechanization.md), Draft and
blocked on a mechanism rather than on scheduling —
no external source offers a mechanism to copy. The 2026-07 research sweep read 83
of 186 talks and produced nothing that closes it: its nearest candidate (§5 #4,
glob-scoped binary LLM verifiers) is **Tier 4**, a different gap. The closest
field evidence is §2's Bun Zig→Rust port, which drove adversarial review from
machine-readable spec files (`porting.mmd`, `lifetimes.tsv`) — the eess-mermaid
premise shipped in anger, but an existence proof, not a mechanism.

## Close-out (2026-07-19)

Closed at Phase 1 — what this plan actually delivered. The rest is re-homed, not
dropped:

- [x] **Phase 1** — `check:fast` (`package.json`) + agent-actionable gate output
      documented in `CLAUDE.md`. Shipped with the plan, 2026-07-08.
- [ ] **Phase 2** — coverage grades over time ·
      `deferred→plan 0073`, merged with its
      decay half: one telemetry mechanism, not two.
- [ ] **Phase 3** — broader deterministic autofix ·
      `deferred→plan 0076` (P2, unblocked),
      unchanged in scope.
- [ ] **Phase 4** — author → validate → fix loop ·
      `deferred→plan 0077` (P2, unblocked),
      narrowed: the kit (0068) already shipped the lane discipline; only the
      bounded re-validate round remains.
- [ ] **Phase 5** — Tier 2/3 mechanization ·
      `deferred→plan 0079`, kept as a frontier; it earns a
      plan when a mechanism (or a demanding adopter) exists.

**Deferred: plans 0073, 0076, 0077, 0079 — each a real Draft on the board, not a
reserved number.** Nothing dropped.

### Why this closed at Phase 1

This plan was the repo's only item that could not be closed: a `State:` line of
free prose ("Phase 1 done; Phases 2–5 proposed") that no terminal token fit, so
`check:ledger` correctly never looked at it. Meanwhile the work it had actually
delivered was complete on day one, and plans 0068–0072 shipped past it while it
kept reading as active.

The lesson is a working-method one, and it is now a guard in the `/plan` skill:
**a plan must be closable.** Phases are for slicing one coherent delivery, not
for parking a backlog — if a plan's later phases can outlive its close, it is
several items, and the board is where the unscheduled ones belong. Splitting them
here cost nothing; leaving them made a finished plan read as open work.

## Files Changed

- Phase 1: `package.json` (add `check:fast`), `CLAUDE.md` (agent-output note),
  `work/plans/ROADMAP.md` (link this plan). No product-code change — the
  remediation output already exists.

## Test inventory

- Phase 1 is script/doc only; `check:fast` is exercised by running it, and the
  corpus/spec/arch gates it composes are already covered by `check:nonvacuity`.
- Phases 2–4 add unit + integration tests with their implementation.

## Out of Scope

- Agent **orchestration** — devboxes / worktree isolation, MCP tool fleets,
  app-legibility infra, Chrome-DevTools wiring, parallel agent runs. eess is the
  guardrail layer an orchestrator runs against, not the orchestrator.
- Rewriting `CLAUDE.md` / skills into a "1,000-page manual" — OpenAI's _"give a
  map, not the encyclopedia"_ is a discipline to keep, not a feature to add.
