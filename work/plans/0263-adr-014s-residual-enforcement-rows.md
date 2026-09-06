# Plan 0263: ADR-014's residual enforcement rows

## Status

- **State:** Ready — frozen 2026-09-06. **The freeze found two things, one a
  false premise this plan inherited from ADR-014's own table and repeated
  without measuring** — written the day before, by me, which is the mistake this
  ADR is about, made about the ADR:
  1. **Phase 4's premise was wrong.** `cardinality.ts` is not the sole `WeakSet`
     registry home; `owns-empty-discovery.ts` is a second, and says so in its own
     comment. The rule as written would have reddened on legitimate kernel code
     on first run. Corrected here and in the ADR row.
  2. **Phase 2 is bigger than "write a fixture".** `checkAll` aggregates with
     `flatMap` and delivers through `writeReport`, so it never reaches the
     evidence gate — the receipt's `examined` is discarded at that seam. The
     phase now names the wiring and the two contracts that constrain it.

  Verified and holding: `throwIfViolations` still exported from both roots; all
  five `pending` rows name this plan; `emitter/one-dead-check` exists while
  `check:ledger` and `check:release` have no counterpart; `check-release.mjs`'s
  `noDiff` branch is real. Originally: the named home for what
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
| No new kernel registry is added                                            | **TWO** `WeakSet` registries exist, not one — see Phase 4's freeze correction                                                  | a second registry added under `packages/core/src`, which is the device ADR-014 §2 chose the required field over      |
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

**Measured at the freeze: `checkAll` is not merely unfixtured, it is outside the
contract.** `packages/ts/src/core/check-all.ts` aggregates with
`dedupeConfigFindings(rules.flatMap((rule) => rule.violations()))` and delivers
through `writeReport`, never `finishPreset` or `reportViolations`. A `flatMap`
over receipts produces a bare array — every `examined` on the floor — so the
evidence gate is never reached, and a rule file exporting an evidence-free
builder passes through `checkAll` silently today. That is why the row is
`pending` rather than `warn`, and it makes this phase a wiring job, not only a
fixture:

1. Route `checkAll`'s aggregation through `mergeCollectResults` so the receipt
   survives, and its delivery through the gate. The severity split at the bottom
   (`ridesTheThrow`) and bug 0203's suppression contract must both survive the
   change — they are why this was not done inside 0235.
2. A non-vacuity fixture whose rule file exports a builder whose `violations()`
   returns a bare `[]`, asserted to red `eess-ts check` by rule id.
3. A test that `checkAll` over the same throws — the regression guard for bug
   0206's shape at a different door.

## Phase 3 — the remedy-remediates fixtures

Four fixtures, one per cause (`no-receipt`, `sourceEmpty`, zero-examined,
expired declaration). Each asserts twice: the finding fires on the corrupt
input, **and** applying the remedy the message names clears it. That second
assertion is ADR-009 rule 2's behavioural corollary and is the half nobody
writes — a message can name a remedy that does not work, and only this shape
catches it.

## Phase 4 — the no-third-registry rule

**Corrected at the freeze, 2026-09-06, and this is the phase's whole lesson.**
This plan said "no module under `packages/core/src` other than `cardinality.ts`
constructs a `WeakSet`", inherited verbatim from ADR-014's row, which said
`cardinality.ts` was "the sole home". Measured, it is not:

| file                                        | registry                | audience                             |
| ------------------------------------------- | ----------------------- | ------------------------------------ |
| `packages/core/src/cardinality.ts`          | `CARDINALITY_ASSERTERS` | conditions that assert cardinality   |
| `packages/core/src/owns-empty-discovery.ts` | `OWNERS`                | conditions reporting their own empty |

`owns-empty-discovery.ts`'s own comment says it outright — _"the two markers
share it"_ — so the fact was documented in the code the whole time and wrong in
the ADR. **The rule as originally written would have reddened on legitimate
existing kernel code on its first run**, and the author would have weakened it or
exempted it: a mechanism that fires on the thing it protects teaches people to
switch it off (ADR-009 rule 1).

So: one rule in `arch.internal.rules.ts` asserting that no module under
`packages/core/src` **other than those two** constructs a `WeakSet`. ADR-010 §2's
clause is "nothing may add a fourth"; this rule is what makes it enforceable
rather than prose.

**Scoped to `WeakSet` deliberately.** `packages/core/src/selection-memo.ts`
constructs two `WeakMap`s, and they are a memo cache, not a suppression registry.
The rule must not catch them, and this sentence exists so nobody later "fixes"
the rule to include `WeakMap` and reds the cache.

Tier 1, and it must declare a non-zero denominator or the row is not `gated` —
0235's own success criterion.

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
