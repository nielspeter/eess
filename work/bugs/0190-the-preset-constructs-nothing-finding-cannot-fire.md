# Bug 0190: the preset-constructs-nothing finding cannot fire

## Status

- **State:** Draft — measured unreachable; needs a decision, not just a test.
- **Severity:** Medium — an unreachable configuration finding that reads as
  coverage, ADR-009 rule 1's object. Sibling of
  [bug 0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md), same shape,
  filed at the same severity for the same reason.
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
