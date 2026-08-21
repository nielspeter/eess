# Plan 0194: The margin ratchet

## Status

- **State:** Draft — blocked on [plan 0193](./0193-measure-the-margin.md)
  Phases 1–2, and on an open question this plan exists to answer rather than
  assume.
- **Priority:** Low — most of what a ratchet was wanted for is covered without
  one. See "What 0193 already catches".
- **Effort:** Unknown, and that is the finding. The mechanism is a stored file;
  the work is making it trustworthy.
- **Created:** 2026-08-21

## Problem

`check:margin` (0193 Phase 2) fails on **margin 0**. It does not notice a
primitive sliding from 5 to 1 — still non-zero, still green, one deletion from
unfalsifiable.

Closing that needs a stored per-primitive margin to compare against. **That file
is the hazard.**

## Why this is a separate record

Split from 0193 during its review, on 0193's own reasoning: if fail-on-zero is an
acceptable terminal state — and the review agreed it is — then fail-on-zero is a
shippable thing, and this is a separate bet.

The failure mode if it had stayed a phase: Phases 1–2 land green, PR pressure
arrives, and Phase 3 closes as a "reasoned refusal" written in ten minutes.
`check:ledger` cannot tell that from a real one —
[`docs/working-method.md`](../../docs/working-method.md) says so outright
(_"whether a disposition is truthful stays with the reviewer"_). The precedent is
on the board: plan 0089's Phase 2 was never attempted and was split to 0153,
because building it _"with less rigor than Phase 1 just required would have been
the wrong tradeoff"_.

## What 0193 already catches without a ratchet

Recorded because it changes this plan's priority from High to Low.

0193's trigger is `(changed primitive sources) ∪ (primitives whose covering set
contains a changed test file)`. A zero-only gate on that trigger catches **every**
1 → 0 slide, at no extra cost, because the PR that deletes the last covering test
is a PR the gate now looks at.

So the ratchet is only needed for drops that **never reach zero** — 5 → 1, 3 → 2.
Those are real (a primitive at 1 is one PR from unfalsifiable, and nothing warns
on the way down) but they are strictly less urgent than the class 0193 closes.

## The open question this plan must answer first

**Can a checked-in file of accepted numbers carry its own non-vacuity guard?**

The repo has two worked examples of the answer being _no_ until someone noticed:

- `KNOWN_FAIL_OPEN` in `scripts/vacuity-matrix.mjs` was emptied to `[]`, and
  three of its failure branches — `checkExpiry()` and both stale-entry findings —
  became unreachable. No input in the repo reaches them, no test covers them, no
  fixture fires them.
- The same file's preset probes were given `report: 'throw'` explicitly _because_
  the bare call scored `fail-open`. The gate was right; the probe was changed
  until it stopped asking, and plan 0165 booked the silencing as the fix.

A margin ratchet is the same shape with a bigger surface: 181 numbers, each of
which can be lowered by one line, in a file whose whole purpose is to be edited
when the numbers legitimately change.

**Answer it before building.** Candidate guards, none yet evaluated:

- every entry carries a date and expires, so a lowered number must be re-argued
  rather than merely re-typed;
- lowering an entry requires a co-located reason string, checked non-empty and
  distinct from its neighbours;
- the ratchet file is derived and committed by a periodic job, so a hand edit is
  visible as a diff against the next regeneration;
- a meta-fixture: lower an entry with no other change, the gate must red.

If none of these makes the file trustworthy, **the honest outcome is to close
this plan `Won't-do` and record why** — leaving 0193's zero-only gate as the
terminal state. That is a real possible ending, not a failure of this plan.

## Implementation phases

### Phase 1 — answer the question

Prototype the strongest candidate guard against a deliberately-lowered entry.
Decide, in this record, whether a ratchet can be made non-vacuous here.

**If no:** State `Won't-do`, say why, and note in 0193 that fail-on-zero is
terminal by decision rather than by omission.

### Phase 2 — build it, only if Phase 1 says yes

The stored margins, the comparison, the guard from Phase 1, and a fixture that
reds when an entry is lowered without cause.

## The file metric weakens this plan's premise further — measured

This plan is premised on catching margin **drops** — "5 → 1, 3 → 2". Those are
**test-count** drops. [Plan 0193](./0193-measure-the-margin.md) gates on failing
**files**, and measured, all six of the primitives that motivated the margin work
sit at **file margin 1** — every covering test for each lives in a single file.

So in the gated unit almost every primitive sits at 1 or 2, and a ratchet has
nearly no range to ratchet over. That does not make this plan wrong; it makes its
**Low** priority better-argued than the reasoning originally given here. If this
is ever picked up, the first question is not "what is the ratchet policy" but
"**is there a unit in which a ratchet has range**" — and if the honest answer is
no, `Won't-do` is the outcome this plan already pre-authorises.

## Out of scope

- Everything in [0193](./0193-measure-the-margin.md). This plan adds a
  comparison to a measurement that must already exist and be trusted.
- Deciding what a _legitimate_ margin drop looks like (a test correctly deleted
  with a rule it covered). That is a policy question and belongs with Phase 1's
  answer, not before it.

## Success definition

Either:

- a ratchet exists, and lowering an entry without cause reds a fixture; or
- this record is `Won't-do` with the reason written down, and 0193's Success
  definition is amended to say fail-on-zero is the decided terminal state.

**Both are acceptable outcomes. A ratchet that ships without an answer to the
open question is not.**

## Progress ledger

- [ ] Phase 1 — the open question answered, either way, in this record
- [ ] Phase 2 — built, with its guard and its fixture (only if Phase 1 says yes)

Deferred: none.
