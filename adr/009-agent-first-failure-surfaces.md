# ADR-009: Agent-First Failure Surfaces

## Status

Accepted (2026-08-14). Implements plan
[0088](../work/plans/0088-fold-ts-archunit-into-eess.md). Ported from
`ts-archunit` [ADR-008](https://github.com/nielspeter/ts-archunit/blob/main/adr/008-agent-first-failure-surfaces.md)
(accepted there 2026-07-29) — the doctrine eess's own fork of that engine
predates. This is the "missing twin" `ts-archunit` ADR-010 names and eess never
wrote: eess ADR-008 is a different decision ("caller owns reporting"), so the
ported doctrine lands here, at ADR-009, not at a collided number.

## Context

eess's stated purpose is the same as the engine it forked: catch architectural
drift on the PR that introduces it, for a primary consumer that is an AI coding
agent — `explain --format agent`, `.rule({ imperative })`, and the
`agentGuardrails` preset all exist for that reader (ported from `ts-archunit` in
plan 0071). That consumer behaves differently from a human in two ways that
dictate how a check must be built:

1. **An agent does not read warnings. It reacts to failures.** A warning in a
   CI log is invisible: the build is green, the task is done, the agent moves
   on.
2. **An agent hitting a red build with no stated remedy invents one.** It is
   optimising for green, not for correctness. The invented remedy is reliably
   the cheapest path — delete the test, add a suppression, edit the
   expectation — and all of them are worse than the original defect, because
   they are silent.

Both properties have the same consequence:

> **A check that cannot fail is worth less than no check, because it is
> counted as coverage.**

A rule whose glob matches no files passes. A selector that narrows to nothing
passes — every condition is ∀ over an empty set, and ∀ over ∅ is true. The
suite reports a number, CI reports success, and the number is a lie: the
coverage is not thin, it is **absent**, and nothing says so.

**Why this lands now, and why it is inherited rather than independently
derived here.** Plan 0051 split `eess`'s dialect-independent kernel out of
`ts-archunit`'s engine at ~0.17 semantics — correct as a direction — and then
the fork froze while the ancestor surged to 0.61 (measured, plan 0088 Phase 1:
11,594 diff-lines across 118 shared files, 37 modules never received). This
doctrine is the single most valuable thing the ancestor became in that gap:
`ts-archunit` earned rules 1–6 below the hard way, across two separate bodies
of evidence — a defect recurring eight times in one plan's review, five of
those introduced by the fix for the row above it, then reproduced again by a
different reviewer against different code four months later. eess has not
independently rediscovered this; it is adopting a doctrine already paid for,
which is the honest framing and the reason this ADR cites its source rather
than re-deriving the evidence. What eess contributes is the drift measurement
above — proof the doctrine's absence is not hypothetical here, it is measured
against eess's own flagship dialect.

## Decision

**Every check we ship — and every check that guards a check — must be
reactable by an agent, and must be guarded by a derivation independent of the
one it protects.**

Six rules, all binding. Rules 1–5 say what a check must do; rule 6 says how
far to chase them.

### Rule 1 — Actionable findings fail; they never warn

**A finding whose remedy is not optional must fail the build.** No
`console.warn` as the primary signal for such a finding.

The discriminator is **whether the remedy is optional**, not whose check it
is. This keeps the rule consistent with [ADR-003](./003-fluent-builder-dsl.md),
which makes `.warn()` a first-class terminal, and with `eess-ts`'s own
`recommended` preset, which ships `no-silent-catch` and `no-empty-bodies` at
warn level **deliberately** — both have known, suppressible false positives,
so the user must judge each one. A finding the reader is expected to judge has
an optional remedy and **should** warn; failing the build on it would train
them to suppress the rule. A finding with one correct answer must fail.

Corollary — **a migration's measuring instrument cannot be a warning
either.** The obvious way to ship a gate that will fail existing code is "warn
in release N, fail in release N+1," and it does not work for the same reason
rule 1 exists: the release that only warns is the release nobody reads. If a
migration needs a measuring instrument, the honest version is an explicitly
invoked diagnostic (`eess-ts diagnose`, once ported — see Phase 4's
migration-rule note in plan 0088) that the consumer runs on the release before
the flip, not a warning hoped to be read.

Corollary — and the distinction matters: **an artifact that can ship while no
check ever fails is a false green**, and that is what this rule forbids. It is
_not_ the same as an artifact that ships before a check reports. If a later
gate reliably reds, the exposure window is a **cost to weigh**, not a
violation.

### Rule 2 — Every failure carries its own sanctioned remedy

The failure message states **what to do**, not only what is wrong. This is
what `.rule({ suggestion })` and `imperative`
(`packages/core/src/rule-metadata.ts`) already exist for; the rule makes it
non-optional for our own guards.

The remedy must be **real**. A message whose stated fix is impossible on the
path that produced it is worse than no message: the agent tries it, it fails,
and the agent then does the forbidden thing. If a check can fire for several
causes, the message must not name one cause's remedy as if it were universal.

Corollary: **a remedy read from a hand-written source is not derived.** A
convention-based tag or comment is not a guarantee; if a message's content
comes from prose, assert the prose.

Corollary — **a remedy is a claim, so rule 5 applies to it.** Asserting that a
message _contains_ the right words is a same-derivation check: the test and
the message are written from the same understanding, and they agree even when
the understanding is wrong. The independent derivation is
**behavioural — apply the stated fix and assert the finding clears.** A
remedy-contains test passes on a wrong message forever; a
remedy-remediates test fails on it immediately. Every message whose fix is
mechanical should have one.

### Rule 3 — Where there is deliberately no escape hatch, say so, and say what to do instead

Silence invites improvisation. A check with no exemption mechanism must state
that in the message, plus the sanctioned alternative — including "stop and ask
a human" when the check genuinely cannot decide.

Be honest about the strength of this: it is **advisory**. Nothing enforces a
message. The enforcement is code review, and the message's real audience is
often the reviewer reading the diff, not the agent.

Corollary: an escape hatch is not automatically safer than none. A marker an
agent can stamp on any file to go green is **worse** than no marker, because it
is a silent, one-line diff. Prefer exclusion **by construction** (structure the
scope so the exception cannot arise) over any list, marker, or flag.

### Rule 4 — No snapshot assertions in agent-consumed tests

`toMatchSnapshot()` / `toMatchInlineSnapshot()` are banned as pins. A CLI flag
regenerates them, and **an agent reaches for that flag before it reaches for
thought**. A pin that a tool flag erases is not a pin.

Narrow exception: where the artifact _is_ the output and the diff _is_ the
review unit (rendered CLI output, `explain --format agent`), a snapshot is
legitimate. Even then, prefer an explicit expectation over a snapshot — a
snapshot buys **identity**, and `expect(hits.length).toBe(25)` is not
equivalent to a 25-entry snapshot: a change that loses one hit and gains
another passes the first.

### Rule 5 — A derivation is unguarded until a _differently_-derived value disagrees with it

> **The question is never "does it derive?" It is: _what second, independent
> derivation disagrees with it?_**

Deriving a value from source and then "protecting" it with a check drawn from
the **same** source is not a guard. The error cancels on both sides.

What independence looks like: static analysis vs. the runtime module system;
a file's existence vs. a file's contents; identity vs. cardinality.

**Independence is not a licence to add an engine.** [ADR-002](./002-ts-morph-ast-engine.md)
stands: ts-morph remains this project's sole AST and type-checking engine
behind [ADR-007](./007-isolate-ast-engine-boundary.md)'s boundary, and
"cross-check it with a second parser" is **not** an available answer.
Independence is cheap and comes from a _different kind_ of evidence, not a
competing implementation of the same kind. If the only independence available
is a second engine, the honest answer is to **say so** (see Consequences).

Corollaries — the sabotage-matrix discipline (ported alongside the rule, per
plan 0088 Phase 2; a rule 5 that lives only in prose is not enforced):

- **Enumerate revert rows from the diff, not from memory.** "What would this
  test do if the thing it guards were completely broken?" presupposes a
  correct enumeration of "the thing" — that enumeration is itself a
  hand-maintained artifact rule 5 applies to. Derive the revert list
  mechanically from the change.
- **A diff cannot enumerate an omission.** When a bug report or plan names a
  case in prose and the fix claims to cover it, add that sentence to the
  sabotage matrix as its own row — it will never arrive from the diff.
- **Split any revert row that names two call sites.** A bundled row can score
  CAUGHT while one of its two halves is caught by nothing; the single test
  that fires may cover only one of them. A row touching more than one call
  site is at least two rows.
- **Assert a green baseline before the first patch, and hold the tree
  exclusively** (an isolated `git worktree`, or nobody else running). Read the
  verdict from the exit code, and prove the exit code means something before
  trusting it — a channel that reads its own result through a fragile filter
  (grepping ANSI-coded output, an unquoted shell variable, a shared checkout
  two agents sabotage at once) can report every row caught-by-nothing, or
  every row caught, for a reason that has nothing to do with the guard.
- **Counting is the shortcut.** Compare identities — sets of `file:line`, sets
  of names — not integers.
- **Every guard needs its own vacuity guard.** `expect(a).toBe(b)` passes
  trivially when both are empty or zero.
- **A test that restates the implementation is not a test of the
  implementation.** It catches typos and inverted conditions. It cannot catch
  the rule being wrong.

### Rule 6 — Recursion depth is proportional to blast radius

Rule 5 **has no fixed point.** Every guard is itself a derivation, so every
guard needs a guard — and nothing in rules 1–5 says when to stop.

So: **the depth you chase rule 5 to is a function of what breaks if you are
wrong.**

| Blast radius                                                          | Depth                                                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Published API — strangers depend on it, and we cannot fix it for them | Guard the guard. Adversarial review. Mutate.                                                   |
| A gate on an irreversible effect (publish, deploy, delete)            | Guard the guard. The remedy path matters as much as the check.                                 |
| An internal check over a corpus we control                            | Guard the check. Prove each detector fires **once**. Then stop.                                |
| A check with a scheduled expiry                                       | Discount everything by the time remaining. A guard that dies at 1.0 does not earn round three. |

This is not licence to ship the shapes rules 1–5 forbid — a vacuous guard is
worthless at every depth. It is licence to **stop at the floor** when the
blast radius is small, and to say so out loud rather than discovering it after
the fact.

### Enforcement methodology

Rules 1–4 and rule 6 are **review-enforced** — properties of prose and
structure that no static rule can check honestly, and a rule that could would
itself need a rule 5 guard.

Rule 5 is enforced by the reviewer question, cheap and mechanical: **"what
would this test do if the thing it guards were completely broken?"** If the
answer is "pass," the derivations are not independent. It has one
precondition: the question is only as good as the enumeration of "the thing" —
ask it against a list derived from the diff, per the corollaries above.

We deliberately do **not** dogfood these six rules as `eess-ts` rules against
this repo's own source — an unenforceable rule stated honestly beats an
enforced rule that is wrong, and these are properties of prose and review
judgment, not AST shape.

## Consequences

### Positive

- The failure surface becomes a contract rather than an accident, for the
  consumer this project actually ships to.
- Rule 5 gives review a single mechanical question that catches a defect class
  expert inspection alone misses (measured, on the source project: three
  review rounds, eight recurrences).
- Exclusion-by-construction (rule 3's corollary) removes maintained artifacts
  entirely rather than making them safer.

### Negative

- Rule 5 makes some guards genuinely harder to write; a second independent
  derivation is not always available. Where it is not, the honest move is to
  **state the gap**, not ship a same-derivation check that looks like a guard.
- Rule 2 lengthens messages. Put per-hit facts on the hit and the imperative
  on the assertion, or the remedy drowns in repetition.
- These are review-enforced, so they rot exactly like anything else
  review-enforced. Rule 5 applies to this ADR too: nothing here is derived
  fresh for eess. What it has instead is a doctrine proven against unrelated
  code, four months and two plans deep on the source project — weaker than a
  derivation, stronger than an argument.
- Rule 2's behavioural corollary makes remedy text a testable artifact, which
  is the point, but it means a message change is now a code change: it needs a
  fixture where the remedy is applied and the finding clears.

## Alternatives Considered

### Leave it as prose in plan 0088

Rejected. A completed plan moves to `work/plans/completed/`, so a binding
project-wide rule would be buried where nobody greps — the exact failure this
ADR describes. The rules already have real instances in this codebase
(`imperative`, `explain --format agent`, `.rule({ suggestion })`); that is ADR
material.

### Make the six rules `eess-ts` rules and dogfood them

Rejected for now — see Enforcement methodology. Worth revisiting if a
mechanical subset emerges (rule 4 is plausibly checkable: ban
`toMatchSnapshot` in `packages/*/tests`).

## Notes

Ported from `ts-archunit` ADR-008 (2026-07-29) rather than independently
re-derived — see Context. The source ADR's own Context section carries the
full evidence tables (specific bugs and plans on that project); they are not
reproduced here because they are not eess's history, and citing them as if
they were would misattribute the discovery. What is reproduced verbatim is the
doctrine itself — the six rules and their corollaries — which is the
transferable part.

## Enforcement

| Clause                                                                         | Tier                                                                     | Mechanism                                                                                                                                    | Status                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Every published check-constructor is provably non-vacuous (the vacuity matrix) | 2 (behavioral — the harness _executes_ constructors, not a static claim) | vacuity matrix over `package.json` exports → `dist` → namespace-object exports, built in plan 0088 Phase 4a; `check:nonvacuity` row per gate | `pending` (flips `gated` when Phase 4a lands)  |
| Remedies are stated and verified to remediate                                  | 2                                                                        | a committed violating fixture per remedy (apply the fix, assert the finding clears)                                                          | `pending` (plan 0088 Phase 5)                  |
| Review rule 5 (independence) in place                                          | 5                                                                        | reviewer question, review-enforced                                                                                                           | `manual`                                       |
| Retire the fork (this plan)                                                    | 5                                                                        | `ts-archunit` npm deprecated → `@nielspeter/eess-ts`, mechanically asserted                                                                  | `pending` (flips `gated` on plan 0100's close) |
