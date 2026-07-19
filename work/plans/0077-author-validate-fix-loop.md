# Plan 0077: author → validate → fix loop

## Status

- **State:** Draft — unblocked; buildable now. Smaller than originally scoped:
  [plan 0068](./completed/0068-working-method-kit.md) already shipped the lane
  discipline this assumed it would have to build.
- **Priority:** P2 — closes a loop whose two ends already exist.
- **Effort:** ~1 session.
- **Created:** 2026-07-19

## Problem

eess ships two skills that are designed to hand off — `eess-adr-author` writes an
enforcement mechanism for a clause, `eess-adr-validate` checks whether the
translation is faithful — and nothing connects them. The author skill's own last
step says it plainly: _you are the worst judge of whether your translation is
faithful._ Today that hand-off is a human remembering to make it.

What is missing is the **bounded loop**: author → validate → fix → re-validate,
until green or escalate, with a round cap.

Arriving from [plan 0067](./completed/0067-harness-informed-roadmap.md) Phase 4,
and narrower than that phase assumed: 0067 was written before the working-method
kit existed, so it scoped building the loop machinery too. `/plan-*`, `/bug` and
`/close` now exist. Only the re-validate round is missing.

## The two constraints that bind this

Both from [the external-signals research](../research-external-signals-2026-07.md):

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

## Approach (sketch — a Draft, not a frozen floor)

**Phase 1 — the loop as a skill.** A `/gate` (name TBD) that runs author →
validate, applies the validator's findings, re-validates, and stops at a cap
(2–3 rounds) with green-or-escalate. Escalation surfaces what did not converge,
rather than silently accepting round N.

**Phase 2 — enforce the separation.** The validator runs with its own context;
if a model override is available, a different one. Document why, so a later
"optimisation" that merges them is recognisable as a regression.

**Phase 3 — dogfood.** Run it on a real ADR clause in this repo and record what
it caught that a single author pass did not.

## Out of scope

- Auto-committing or auto-merging anything the loop produces.
- Widening past ADR clauses (a general code-fix loop is a different animal).
- Replacing `/plan-*` or `/close` — this composes with the kit, it does not
  restructure it.

## Success definition

A clause goes in, a faithful enforcement mechanism plus its Enforcement row comes
out, and the round count and any escalation are visible. On a clause where the
rule is subtly wrong, the loop catches it — demonstrated, not asserted.

## Open questions (resolve before Ready)

- [ ] Round cap: 2 or 3? Stripe chose 2; is there evidence for either here?
- [ ] What does escalation look like — a refusal, a `pending` Enforcement row, or
      a filed bug?
- [ ] Is the separation enforceable, or only documented? (If only documented, say
      so on the row rather than implying a mechanism.)
