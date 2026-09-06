# Plan 0263: ADR-014's residual enforcement rows

## Status

- **State:** Draft — the named home for what
  [plan 0235](./completed/0235-the-emitter-takes-a-receipt.md) built the contract
  for and did not gate. Created at 0235's close so the deferral has somewhere to
  go: five `pending` rows in a binding ADR that named a plan about to become a
  completed one is the orphan shape `/close` exists to refuse.
- **Priority:** Medium — every clause here is already **true of the code**; what
  is missing is the mechanism that would notice if it stopped being true. That is
  a weaker emergency than a false green, and a real one:
  [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 1's whole thesis
  is that an unenforced clause decays to prose, and this ADR's own §2 refuses a
  registry precisely so the guarantee lives in mechanisms rather than lists.
- **Effort:** Low-to-medium — five rows, four of them one fixture or one rule
  each. The `throwIfViolations` row is the only one that moves a public surface,
  and it is a breaking change in two packages.
- **Created:** 2026-09-06
- **Inherits:** the five rows
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s
  Enforcement table still marks `pending` at 0235's close. No `**Implements:**`
  line — this builds no proposal; it finishes an ADR's table.

## Problem

Plan 0235 shipped ADR-014's contract and moved nine of the table's sixteen rows
to `gated`. Six stayed `pending`; one of those (`a terminal's verdict flows
through unchanged`) was measured and gated at 0235's close, leaving **five**.

The five are not oversights in the contract — the contract holds. They are
clauses whose _mechanism_ was scoped out, each for a stated reason, and the
honest consequence is that nothing would notice their regression:

| Row                                                                        | What is true today                                                                                                             | What would not be noticed                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `throwIfViolations` is not exported                                        | It **is** still exported from `packages/core/src/index.ts` and `packages/ts/src/index.ts` — the clause is simply not satisfied | n/a; this one is undone work, not unwatched work                                                                     |
| A rule file exporting an evidence-free builder reds the CLI and `checkAll` | It does — `checkAll` routes through the kernel merge and the CLI through the emitter                                           | a future refactor that hands the CLI a bare array again, which is exactly the shape 0206 had                         |
| The finding names its cause, and the remedy remediates                     | Each of the four causes has its own id and message                                                                             | a message edited into uselessness, or a remedy that does not clear the finding it is printed beside (ADR-009 rule 2) |
| No new kernel registry is added                                            | `packages/core/src/cardinality.ts` is still the only `WeakSet` home                                                            | a second registry added under `packages/core/src`, which is the device ADR-014 §2 chose the required field over      |
| Every hand-assembled check in this repo supplies evidence                  | `check:corpus` proves it end to end (`emitter/one-dead-check`)                                                                 | the same dead-check fail-open in `check:ledger` or `check:release`, neither of which has a break-the-loop fixture    |

The middle three share a shape worth naming: **the clause is enforced by a
mechanism that exists for another reason** (the type system, the suite), which is
why they were not urgent, and **not by anything that fails on their specific
regression**, which is why they are not `gated`. Calling that `gated` would be
the over-claim ADR-014's own table is supposed to make impossible.

## Phase 1 — the two fixtures (`check:nonvacuity`)

Both are break-the-loop fixtures in `scripts/check-nonvacuity.mjs`, the same
shape as the `emitter/one-dead-check` fixture 0235 shipped: plant the corruption
in the **production** script, assert the finding fires by id, and assert the
other checks still examined.

1. **`emitter/ledger-dead-check`** — plant a `continue` at the top of one of
   `scripts/check-ledger.mjs`'s per-check loops.
2. **`emitter/release-dead-check`** — the same in `scripts/check-release.mjs`,
   which has the extra wrinkle that its `noDiff` branch legitimately declares
   empty, so the fixture must plant its corruption on a path that is **not**
   `noDiff` or it proves nothing.

That second wrinkle is the whole reason this is a phase rather than a copy-paste:
a fixture that fires on the declared-empty path would be a fixture asserting the
declaration works, filed under a row about dead checks.

## Phase 2 — the rule-file fixture and `checkAll`

A non-vacuity fixture whose rule file exports a builder whose `violations()`
returns a bare `[]`, asserted to red `eess-ts check`; and a test that `checkAll`
over the same throws. Both are one file each, and the second is the regression
guard for bug 0206's exact shape at a different door.

## Phase 3 — the remedy-remediates fixtures

Four fixtures, one per cause (`no-receipt`, `sourceEmpty`, zero-examined,
expired declaration). Each asserts twice: the finding fires on the corrupt
input, **and** applying the remedy the message names clears it. That second
assertion is ADR-009 rule 2's behavioural corollary and is the half nobody
writes — a message can name a remedy that does not work, and only this shape
catches it.

## Phase 4 — the no-second-registry rule

One rule in `arch.internal.rules.ts`: no module under `packages/core/src` other
than `cardinality.ts` constructs a `WeakSet`. Tier 1, and it must declare a
non-zero denominator or the row is not `gated` — 0235's own success criterion.

## Phase 5 — `throwIfViolations` leaves the public surface

The only breaking change here. It is exported from two packages' roots; ADR-014
says it should not be. Removing it needs a changeset marking the break and naming
every dependent package (bug 0185's rule), and `check:surface` will want the root
export census re-derived.

Sequenced last deliberately: it is the only row whose fix an adopter can feel,
and the other four are pure gain.

## Files changed

- `scripts/check-nonvacuity.mjs` — four new fixtures (Phases 1 and 3)
- `packages/ts/tests/` — the `checkAll` bare-builder test (Phase 2)
- `arch.internal.rules.ts` — the registry rule (Phase 4)
- `packages/core/src/index.ts`, `packages/ts/src/index.ts` — the removal (Phase 5)
- `adr/014-the-emitter-refuses-a-verdict-without-evidence.md` — five rows to `gated`
- `.changeset/` — the Phase 5 break

## Out of scope

- **ADR-014's two stated residuals** — an adopter who sums by hand, and one who
  never calls an emitter. Those are
  [plan 0237](./0237-eess-runtime-use-only-in-rule-files.md)'s, and the ADR marks
  them `n/a` rather than `pending` for the reason it states: only a human reading
  the loop can judge a wrong `examined`.
- **[Bug 0262](../bugs/0262-an-adr-cannot-cite-a-kernel-test.md)** — the reason
  ADR-014's kernel rows cite file paths rather than `it('…')` titles. It is a
  gate-scope defect, not a row, and upgrading the citations is listed in its own
  verification ledger.

## Success

- Five rows move from `pending` to `gated`, and each one's mechanism has been
  **run red** before it is called gated.
- No row is marked `gated` whose mechanism examines nothing — the criterion 0235
  set for itself and the reason this plan exists as a separate item rather than a
  footnote in a closed one.

## Progress

- [ ] Phase 1 — the two dead-check fixtures
- [ ] Phase 2 — the rule-file fixture and the `checkAll` test
- [ ] Phase 3 — the four remedy-remediates fixtures
- [ ] Phase 4 — the no-second-registry rule
- [ ] Phase 5 — `throwIfViolations` removed, changeset naming the break
- [ ] `/close`

Deferred: none
