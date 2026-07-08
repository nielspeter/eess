# Plan 0067: Harness-Informed Roadmap

## Status

- **State:** Phase 1 done (quick wins landed with this plan); Phases 2–5 proposed
- **Priority:** P2 — sharpen eess as a reusable harness; no blockers
- **Effort:** Phase 1 ≈ 0.5 day (done); Phases 2–5 sized below
- **Created:** 2026-07-08

## Problem

Two public case studies — OpenAI's [Harness
engineering](https://openai.com/index/harness-engineering/) and Stripe's
[Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents)
— describe building, from scratch and per repo, the exact guardrail layer eess
packages: layered-architecture structural tests, doc-as-system-of-record with
mechanical consistency checks, remediation-in-lint-messages, promote-prose-to-code,
and continuous entropy cleanup. The positioning is written up in
[eess as a harness](../../docs/eess-as-a-harness.md).

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

## Phase 2 — Coverage grades over time (proposed)

OpenAI grade _each domain/layer_ in a `QUALITY_SCORE.md` and their background tasks
_"update quality grades."_ eess has `work/dogfood-coverage.md` — but as a snapshot,
not a graded, tracked-over-time view. This is the temporal version of eess's core
move ("make the unenforced surface queryable"): a per-tier / per-package coverage
grade, emitted by a gate and trended, so the enforced surface is visibly growing or
rotting. Sits naturally on `check:spec` (coverage = direction already exists from
plan 0061). **Effort: ~1 session.**

## Phase 3 — Broaden deterministic autofix (proposed)

Both shops lean on autofix (Stripe _auto-applies_ test autofixes). eess's `--fix`
(plan 0066) is link/pointer-only. Extend the `ArchFix` model to more rule classes
where the repair is provably unique (e.g. a missing `.because`, a sanctioned
`eess-exclude` with reason, an import moved to satisfy a layer). **Effort: ~2
sessions.** Continues plan 0066's fix-side-of-the-tier-model direction.

## Phase 4 — author → validate → fix loop (proposed)

OpenAI's _"Ralph Wiggum Loop"_ of agent reviewers until satisfied; Stripe's bounded
_two rounds_. eess ships the `eess-adr-author` and `eess-adr-validate` skills that
hand off, but no loop that runs author → validate → fix → re-validate until
green-or-escalate, with a bounded round count. Formalize it as a skill/workflow.
**Effort: ~1 session.**

## Phase 5 — Tier 2/3 mechanization (frontier)

The honest gap. eess mechanizes **Tier 1** (eess-ts) plus the md/crossval binding;
the manifesto _describes_ Tiers 2–5 but eess provides no mechanism for them — it
only resolves a cited behavioural test. OpenAI and Stripe verify Tier 2/3
(behavioural via bootable app + perf SLOs; operational via observability). A
Tier-2 binding (clause → contract/property test, beyond citation resolution) or a
Tier-3 policy-as-code hook would extend eess past the static tier. **Large scope;
own plan when scheduled.** Explicitly not attempted here.

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
