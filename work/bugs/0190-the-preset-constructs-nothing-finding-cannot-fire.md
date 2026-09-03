# Bug 0190: the preset-constructs-nothing finding cannot fire

## Status

- **State:** Draft — measured unreachable; needs a decision, not just a test.
- **Severity:** High — **raised from Medium on 2026-09-03** (see Escalation
  below). Filed as an unreachable configuration finding that reads as coverage —
  ADR-009 rule 1's object, sibling of
  [bug 0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md). What changed is
  not the analysis but the evidence: the runtime path this record calls "the
  uncovered one" has now been measured firing in a consuming project, with a cost.
  An unreachable finding that reads as coverage is a Medium; the same finding once
  the case it cannot catch is known to be shipping silently is not.
- **Origin:** self-found · auditing the eight upstream `completed/` plans that
  reference ADR-009 (the evidence-and-vacuity body of work) for mechanisms that
  are present but not connected
- **Reported:** 2026-08-21

## Symptom

`presetConstructsNothingViolation`
([`packages/core/src/preset-dispatch.ts:106`](../../packages/core/src/preset-dispatch.ts))
cannot be produced by anything this repo ships. An adopter whose preset
constructs zero rules gets no finding.

## Reproduction

Every reference to the symbol, across `packages/` and `scripts/`, excluding
build output:

| site                                                             | kind                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `packages/core/src/preset-dispatch.ts:106`                       | the definition                                   |
| `packages/core/src/index.ts:52` · `packages/ts/src/index.ts:508` | barrel re-exports                                |
| `packages/core/src/preset-dispatch.ts:58`                        | a comment naming it as an example                |
| `packages/core/tests/preset-dispatch.test.ts:68`                 | a comment naming it as an example                |
| `packages/ts/tests/matrix/vacuity-classification.ts:262`         | a `NOT_CHECKS` entry                             |
| `scripts/vacuity-matrix.mjs:214`                                 | a comment saying the case "must stay detectable" |

**No call site.** Nothing constructs it, so nothing can report it.

## Root cause

Structural, not an oversight in wiring. `finishPreset`
([`packages/core/src/report.ts:58`](../../packages/core/src/report.ts)) has this
signature:

```ts
export function finishPreset(
  violations: ArchViolation[],
  options: PresetReportOptions = {},
): ArchViolation[]
```

It receives **violations**, never the builder list. "This preset constructed zero
rules" is not a fact available at that seam. The one place that holds the
builders is `deliver()` in `packages/ts/src/presets/shared.ts`, in the dialect —
and the finding lives in the kernel.

That is the same kernel/dialect split bug 0178 records for `deadGlobViolation`:
a finding constructor in `packages/core` whose triggering fact is only ever
computed in `packages/ts`.

## Why it matters

Plan 0100 upstream (`0100-a-preset-that-constructs-nothing.md`) exists precisely
because a preset that builds nothing passes silently. The finding was written.
It reads, in every census and every export list, as the thing that covers that
case. It covers nothing.

**What actually catches it today, and what that does not cover.**
`scripts/vacuity-matrix.mjs` detects the case — `classify()` scores such a preset
`fail-open` — and its comment says so. But that is eess's own CI auditing eess's
own five presets. It says nothing about an adopter's preset, and produces no
finding in an adopter's build. The runtime path the constructor was written for
is the uncovered one.

## Escalation — 2026-09-03: the uncovered path measured firing

[Proposal 009](../proposals/009-core-a-verdict-cannot-be-assembled-by-hand.md)
arrived from a consuming project carrying exactly the measurement this record
lacked. Reviewed the same day by three lenses; its Problem section was accepted by
all three and independently re-verified against this repo's source.

What it reports: four corpus gates written against eess, **three found inert
inside one week**. They imported eess's types (`ArchViolation`) and eess's printer
(`finishPreset`) and never a `RuleBuilder` — a loop, a literal per finding, and a
call to the emitter. Each was green. The defects were ordinary: a `continue` on a
malformed row, a counter compared against nothing, a header count compared against
nothing.

**The part that bears on severity is who wrote them.** The proposal records that
the author _"had been told to 'embrace eess' in the same session."_ It was an AI
coding agent, following instructions, using three separately-documented public
affordances in a documented way — and eess accepted the result and printed green.
That is not misuse to be documented against. It is an **affordance defect**: the
wrong construction is reachable, plausible, and rewarded, and the library's own
primary stated consumer is the one most likely to build it. `eess-ts` ships an
`agentGuardrails` preset for "the mistakes AI coding agents make most often";
this is one of them, and it is a mistake eess currently helps make.

This does not change the root cause above — `finishPreset` receives violations,
never the builder list, and "this preset constructed zero rules" is not a fact
available at that seam. It changes two things:

1. **Which fix option is honest.** Option 3 ("delete it and say so, if the vacuity
   matrix is judged sufficient") is now foreclosed. This record already states why
   in _Why it matters_ — the matrix is eess's CI auditing eess's own five presets
   and "says nothing about an adopter's preset". The adopter's preset is precisely
   what was measured failing. The choice is between options 1 and 2.
2. **That option 2 is bigger than this record implies, and has a design.** Proposal
   009's Ask A asks for exactly the seam move, and its review found the _mechanism_
   it proposed cannot work — a `WeakSet` keyed on violation objects cannot speak
   about an empty array, and the empty array is the dominant path (every clean
   preset run). The review's alternative is to mint the **container**: the receipt
   `CollectResult` (`packages/core/src/terminal-builder.ts:39`), which is already
   the evidence shape ADR-010 mandates and which every terminal already produces.
   That is the same "give the kernel the fact, not the array" move option 2 names,
   at a granularity that works.

**The decision now exists as [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)**
(Accepted 2026-09-03), which takes option 2 in the container's shape — the
receipt as a **required field** on the emitter, not a minted registry, so
ADR-010 §2's cap is untouched — and names this record's red test as one of its
Enforcement rows. The preset-specific remedy this constructor carries stays with
the preset plumbing that knows it is a preset (ADR-014 §4); the kernel emitter
names the hand-assembler's remedy instead. This record stays open until plan 0235 lands and the finding is producible or gone.

Also relevant, and not this record's to decide: 009's review found the seam move
collides with two binding texts — ADR-010:136 (_"nothing may add a fourth"_
kernel `WeakSet` registry) and ADR-008:30-31 (`reportViolations` _"never throws or
filters"_). Neither forbids fixing this; both mean the fix is a recorded decision
rather than an implementation detail. Note the ADR-010 clause constrains one
_mechanism_ — a run-scoped counter in the shape of `violationsEmittedCount()`
(`packages/core/src/report.ts:51`, whose docstring already argues the general case:
_"Count emissions, not silences"_) adds no registry at all.

**Sibling records on the same seam**, none of which is fixed, and which are worth
sequencing together rather than one at a time:
[0206](./0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md) (the
dialect's default path bypasses the kernel finisher) and
[0097](./0097-crossval-presets-bypass-caller-owns-reporting.md) (two presets return
`void`, so ADR-008 never reached them).

## Fix

Undecided, and the decision is the work — as with 0178:

1. **Wire it in the dialect.** `deliver()` holds the builders; have it emit the
   finding when the list is empty. Costs a dialect-side call to a kernel
   constructor, which is the existing pattern.
2. **Move the seam.** Give `finishPreset` the builder count so the kernel can
   decide. Larger, and touches every preset conduit.
3. **Delete it and say so.** If the vacuity matrix is judged sufficient, remove
   the constructor rather than leaving an unreachable finding on the published
   surface — an export that cannot fire is worse than no export, because it is
   counted.

Whichever is chosen, the outcome must be that either the finding is producible or
the symbol is gone. It must not stay exported and unreachable.

## Verification

- [ ] Red test first: a preset that constructs zero rules produces the finding
      through `.check()`. Must fail today.
- [ ] The break class is registered in `scripts/check-nonvacuity.mjs`, so an
      emptied implementation cannot stay green.
- [ ] If option 3 is chosen instead, the symbol is removed from both barrels and
      from `vacuity-classification.ts`, and this record says so.
- [ ] `npm run validate` green.

Deferred: none.
