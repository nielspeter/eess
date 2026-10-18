# Plan 0481: this repository dogfoods `notExist()`

## Status

- **State:** Draft — written 2026-10-18 at the maintainer's question ("are we dogfooding all these
  changes?"). Plan 0456 shipped `notExist()` on every eess-md builder and the kernel's
  broken-selector check, and nothing in this repository's own gates uses either: their only real
  use is `examples/md/unclaimed-and-double-claimed.test.ts`.
- **Priority:** Medium. The change is small, and until it lands the selector-fault check never runs
  on this repository's own globs.
- **Effort:** Small: one rule pair in `check:ledger`, the hand-written check it replaces kept or
  removed by measurement, one non-vacuity row.
- **Created:** 2026-10-18
- **Builds after:** plan 0469 (the maintainer's batch order), before the release.

## Problem

`check:ledger` checks that every directory under `work/` is claimed by a declared lane with a
hand-written walk, `findUncoveredLanes` (`scripts/lib/lane-coverage.mjs:76`). That is proposal 017's
block 6, "every document is claimed by one selection", written by hand. eess-md now states it in its
own blocks: two `notExist()` rules over the caller's selections (plan 0456's recipe). Using them here
puts `notExist()` and the kernel's `cardinalitySelectorFault()` in front of this repository's own
globs, which nothing does today.

## Design

- In `scripts/check-ledger.mjs`, over a corpus whose only root is `work/**`: one rule that no
  document is outside every lane's root (`docs(c).that().satisfy(not(or(...lanes)))
.should().notExist()`), and one that no document is in two (`or(and(a, b), …)`), with the lanes'
  roots from `scripts/lib/ledger-lanes.mjs`.
- Measure first whether `findUncoveredLanes` reports anything the two rules do not (it judges
  directories that "carry records", not documents). Keep it only for what the rules cannot state,
  and say which in the record.
- A non-vacuity row: a probe document under a `work/` folder no lane claims reds the first rule at
  its path.

## Test inventory

- The probe row above, and a sabotage row: the first rule's selection widened to everything stays
  quiet on the probe (the second rule reds it, as the recipe says).
- `check:ledger` green on this repository with both rules, its summary naming their counts.

## Out of scope

- Rebuilding `honestyAtClose` from public blocks (proposal 017, decision 1).

## Progress ledger

- [ ] The two rules in `check:ledger`, measured against `findUncoveredLanes`
- [ ] Non-vacuity and sabotage rows
- [ ] Close: this plan → `completed/`; boards

Deferred: none
