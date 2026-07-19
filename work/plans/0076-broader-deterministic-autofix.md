# Plan 0076: Broader deterministic autofix

## Status

- **State:** Draft — unblocked; buildable now. Nothing external is waited on.
  Needs a scoping decision (which repair classes qualify) before Ready.
- **Priority:** P2 — direct continuation of shipped work, no new concepts.
- **Effort:** ~2 sessions.
- **Created:** 2026-07-19

## Problem

[Plan 0066](./completed/0066-eess-deterministic-autofix.md) shipped the `ArchFix`
model and `--fix`, but only eess-md populates it, and only for link and pointer
resolutions. Every other gate reports a violation and stops — the agent or human
re-derives the repair by hand, every time.

The repair for several rule classes is **provably unique**, which is the bar 0066
set: a fix is offered only when there is exactly one correct answer, so applying
it can never be a guess. Those classes are currently left on the table.

Arriving from [plan 0067](./completed/0067-harness-informed-roadmap.md) Phase 3.
Both harness write-ups that plan drew on lean hard on autofix — Stripe
_auto-applies_ its test fixes — and the
[external-signals research](../research-external-signals-2026-07.md) §1 records
the same loop across seven independent talks: every agent mistake becomes a
permanent check, and the cheaper the repair, the more checks survive contact with
a real team.

## Candidate repair classes (the scoping decision)

| Candidate                                                     | Unique? | Note                                                      |
| ------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| A rule missing `.because`                                     | no      | the _text_ is a judgment; can only scaffold a placeholder |
| A sanctioned `eess-exclude` needing a written reason          | no      | same — the reason is the point                            |
| An `ArchViolation` whose element moved (stale path in a rule) | yes     | if exactly one candidate path matches                     |
| A missing ADR Enforcement row for a known clause              | partial | row shape is derivable; Tier and Status are judgment      |
| An import that violates a layer, with one legal re-export     | yes     | only when a single sanctioned path exists                 |

The honest read: two of the five originally-named candidates (`.because`,
`eess-exclude` reasons) are **not** provably unique — scaffolding a placeholder
`because: 'TODO'` would manufacture exactly the vacuous-but-green artifact eess
exists to prevent. Phase 0 is deciding which candidates survive that test.

## Approach (sketch — a Draft, not a frozen floor)

**Phase 0 — scope.** Apply the uniqueness test to each candidate; keep only those
where the repair is derivable, not invented. Record the rejects and _why_.

**Phase 1 — widen the model if needed.** `ArchFix` was designed for text edits at
a location; confirm it covers multi-location and cross-file repairs, or extend it.

**Phase 2 — populate fixes in a second dialect.** eess-ts is the natural target,
since it produces the most violations in practice.

**Phase 3 — dogfood.** Break something in this repo on purpose, `--fix --apply`,
confirm the gate goes green _and_ that `check:nonvacuity` still fails on planted
violations (a fixer that silences a rule is worse than no fixer).

## Out of scope

- Any fix requiring judgment. If two repairs are defensible, eess reports and
  stops. This is the line 0066 drew and it does not move.
- LLM-generated fixes. The `Fix:` line already carries remediation text for an
  agent to act on; that is a different mechanism and it already ships.

## Success definition

A second dialect populates `ArchFix`, `--fix --apply` repairs real violations in
this repo, and non-vacuity still proves every affected gate fails on planted bad
input after the fixer exists.

## Open questions (resolve before Ready)

- [ ] Which candidates survive Phase 0's uniqueness test? (The table above is a
      first pass, not a verdict.)
- [ ] Does a fixer need to re-run the gate to prove convergence, or is one pass
      the contract?
