# Plan 0077: author → validate → fix loop

## Status

- **State:** Done — merged 2026-07-24 (PR #22). Built the `adr-enforce` workflow
  (author/verifier separation enforced structurally), dogfooded twice on ADR-007's
  confinement clause (FAITHFUL, non-vacuous, gates green), and applied a branch
  code-review (#1–#3). **Deferred: none; 1 validation-owed** — the fix/re-validate
  path is code-verified but never fired live (author faithful first-pass both runs).
- **Priority:** P2 — closes a loop whose two ends already exist.
- **Effort:** ~1 session.
- **Created:** 2026-07-19
- **Scope note:** this builds **harness/method** — a named workflow script under
  `.claude/workflows/` plus skill/agent config — **not** eess-package code. On-thesis
  with harness-scaling; called out so a reader does not expect a new dialect or gate.

## Problem

eess ships two skills that are designed to hand off — `eess-adr-author` writes an
enforcement mechanism for a clause, `eess-adr-validate` checks whether the
translation is faithful — and nothing connects them. The author skill's own last
step says it plainly: _you are the worst judge of whether your translation is
faithful._ Today that hand-off is a human remembering to make it.

What is missing is the **bounded loop**: author → validate → fix → re-validate,
until green or escalate, with a round cap.

Arriving from [plan 0067](./0067-harness-informed-roadmap.md) Phase 4,
and narrower than that phase assumed: 0067 was written before the working-method
kit existed, so it scoped building the loop machinery too. `/plan-*`, `/bug` and
`/close` now exist. Only the re-validate round is missing.

## The two constraints that bind this

Both from [the external-signals research](../../research-external-signals-2026-07.md):

1. **Adoption stays a human act (§4).** A loop may _propose_ a rule change; a
   human ratifies it. A gate that rewrites its own rules is not an external
   oracle — it is Goodhart's law with a CI badge. This is Tier 5, and it is not
   negotiable.
2. **The verifier is separated from the author (§2).** Fresh context, ideally a
   different model. The research's reward-hacking findings are blunt: models
   detect when they are being evaluated, and a model checking its own work
   optimises for looking correct. A loop that reuses the author's context is
   theatre.

Bounded rounds matter for the same reason — OpenAI's unbounded "Ralph Wiggum
Loop" versus Stripe's deliberate _two rounds_. Unbounded iteration against a
judge converges on satisfying the judge.

## Design decisions internalised at freeze (2026-07-23)

Verified against the harness (Claude Code) so the build does not have to re-discover it:

- **Both skills are inline today.** `eess-adr-author` and `eess-adr-validate` are
  `user-invocable` **inline** skills — invoking them loads instructions into the
  _current_ context. Run in one session, the validator sees the author's reasoning:
  the exact reward-hacking gap constraint 2 names. So the separation is not merely
  undone today — there is nothing between the two skills at all.
- **The separation is enforceable — structurally, via a Workflow.** A separate
  `agent()` call is a separate context window; it cannot read the parent's reasoning,
  only the files. That is enforced by the spawn boundary, not by discipline. The
  Workflow tool exists for exactly this: deterministic loops/conditionals over agents.
- **Model separation is a set knob.** `agent()` takes `model:` (opus/sonnet/haiku/fable),
  so "ideally a different model" is a parameter, not an aspiration. A `schema:` forces
  the validator to a structured `FAITHFUL | PARTIAL | DRIFTED` verdict.
- **Named-workflow invocation is the opt-in.** Workflows need explicit opt-in per run;
  a user invoking a named workflow on demand _is_ that opt-in, so shipping one is fine.

## Approach (frozen 2026-07-23)

**Phase 1 — the loop as a Workflow (not an inline skill).** A named workflow under
`.claude/workflows/` (e.g. `adr-enforce`) the user invokes on demand. The script:

- `author` = one `agent()` call carrying the `eess-adr-author` instructions →
  produces the rule + the Enforcement-table row;
- `validate` = a **separate** `agent()` call carrying `eess-adr-validate`, forced to
  a structured `FAITHFUL | PARTIAL | DRIFTED` verdict via `schema:`;
- `fix` → re-validate inside a bounded `while` (cap **2**, see _Resolved_) with
  green-or-escalate.

A Workflow, **not** an inline `/gate` skill, because only deterministic control flow
_enforces_ the separation and the round cap; an inline skill could merely instruct
the model to spawn a separate validator — bypassable. (Lighter fallback, if a full
workflow is overkill: a subagent-backed `eess-adr-validate` skill enforces context
separation but gives up the deterministic loop and cap.)

**Phase 2 — the separation is structural; set the model split.** Author and
validator are separate `agent()` calls — the validator runs in its own window and
**cannot see the author's reasoning**, enforced by the spawn boundary. Set the
validator's `model:` to a _different_ model from the author's, and record the split
and why, so a later merge of the two reads as a regression, not an optimisation.

**Phase 3 — dogfood.** Run the workflow on a real ADR clause in this repo and record
what the separated validator caught that a single author pass did not — round count
and any escalation visible.

## Out of scope

- Auto-committing or auto-merging anything the loop produces.
- Widening past ADR clauses (a general code-fix loop is a different animal).
- Replacing `/plan-*` or `/close` — this composes with the kit, it does not
  restructure it.

## Success definition

A clause goes in, a faithful enforcement mechanism plus its Enforcement row comes
out, and the round count and any escalation are visible. On a clause where the
rule is subtly wrong, the loop catches it — demonstrated, not asserted. **Scope: one
clause per run** — applying the loop across a whole corpus of clauses (the batch
dimension) is deliberately out of MVP; it is iteration over this, not new machinery.

## Resolved at freeze (2026-07-23)

- [x] **Round cap: one fix (two validation passes).** Stripe's deliberate two rounds
      over OpenAI's unbounded loop (constraints, above) — unbounded iteration against a
      judge converges on satisfying the judge. Validate → (if not `FAITHFUL`) one fix →
      re-validate → escalate. In code: `MAX_FIX_ROUNDS = 1` (reconciled with the code at
      review — the first cut allowed two fixes, review finding #3).
- [x] **Escalation = a `pending` Enforcement row + the last verdict surfaced, never
      a silent accept.** The loop writes the row as `pending` with the validator's
      `PARTIAL/DRIFTED` evidence attached; a human ratifies or rejects (Tier 5,
      constraint 1). Not a refusal (throws away the work), not a filed bug (too heavy
      for routine non-convergence).
- [x] **Separation is enforceable — via a Workflow** (separate `agent()` = separate
      context; `model:` = a different model). See _Design decisions internalised at
      freeze_. The Enforcement-row language can say "structurally separated" — now
      true, not aspirational.

## Build log (2026-07-23)

- [x] **Phase 1–2 built.** [`.claude/workflows/adr-enforce.mjs`](../../../.claude/workflows/adr-enforce.mjs)
      — the author→validate→fix loop as a Workflow. `author` = `agent(model: opus)`
      carrying eess-adr-author → writes the rule + a `pending` Enforcement row;
      `validate` = a **separate** `agent(model: sonnet)` carrying eess-adr-validate,
      forced to a `FAITHFUL | PARTIAL | DRIFTED` verdict via `schema:`; bounded `while`
      (cap 2) with green-or-escalate; escalation leaves the row `pending` for human
      ratification (Tier 5, never auto-gated). The separation is structural (separate
      agent = separate context) on a different model — the enforced form. Syntax
      verified (compiles as an async workflow body).
- [x] **Phase 3 dogfooded (2026-07-23).** Ran `adr-enforce` on ADR-007's Tier-1
      confinement clause. Two agents — author (opus), validator (sonnet, _separate
      context_) — 51 tool uses, ~9 min, 153k tokens. The author wrote
      [`adr007.rules.ts`](../../../adr007.rules.ts) (modules outside
      `packages/ts/src/core/engine/` must `notImportFrom` ts-morph) + updated the
      ADR-007 Enforcement row, honestly `pending` and deliberately un-gated so
      `check:arch` stays green. The validator returned **FAITHFUL** (round 0) with a
      real escape-hatch analysis (dynamic `import()` / `@ts-morph/common` slip past
      `notImportFrom`, but no such usage exists today). Verified independently: the
      rule is **non-vacuous — 60 violations** (`eess-ts check adr007.rules.ts`), and
      `check:corpus` / `check:arch` stay green.
- [x] **First launch caught a real bug** — `args` arrived as a JSON string, so
      `args.clause` was undefined and the workflow no-op'd. Fixed (the script now
      parses a string-or-object `args`). The dogfood earned its keep before it even
      ran the loop.
- [ ] **validation-owed — the fix path is not run-verified.** The author was faithful
      first-pass on both dogfood runs (rounds 0), so the `while` fix/re-validate branch
      is built and code-verified (syntax + readable deterministic logic) but **never
      fired by a live run**. Owed: a demonstration against a naturally-flawed clause —
      not contrived here, and not a blocker for the shipped mechanism. It surfaces the
      first time a real clause draws a `PARTIAL`/`DRIFTED` verdict.

## Review + re-dogfood (2026-07-24)

A branch code-review found four issues in the workflow; #1–#3 applied, #4 noted:

- [x] **#1 — the loop now verifies executability, not just faithfulness.** The
      validator runs `npx eess-ts check <rule>` first; a zero-selection (vacuous) rule
      → `DRIFTED`. Re-dogfooded on the same clause — the journal confirms the validator
      **ran** the rule (count line, 60 violations) and even ran `check:corpus` /
      `check:arch`. Vacuity is now caught deterministically, not by an LLM reading alone.
- [x] **#2 — a dedicated `fixPrompt`** that _updates_ the existing rule/row, replacing
      the reused author prompt whose "add the row" risked a duplicate on the fix path.
- [x] **#3 — `MAX_FIX_ROUNDS = 1`** (one fix, two validation passes), reconciling the
      code with the plan's "two rounds."
- [x] **#4 — noted:** the workflow mutates the tree in place; the header now says to run
      it on a branch.

Re-run result: fresh author → non-vacuous rule (60 violations) → **FAITHFUL** round 0,
gates green. The fix path (#2/#3) still did not fire (faithful first-pass), so the
_Honest limit_ above stands — those two are code-verified, not run-verified.
