# Bug 0272: the kernel root's unwatched residual

## Status

- **State:** Draft — narrow, measured, and much smaller than this record first
  claimed.
- **Priority:** Low
- **Found by:** plan 0263 Phase 5, then **corrected by a method review of the
  same PR**, which found the original filing rested on a false negative.

## The correction that produced this record

This bug was first filed as "nothing watches the kernel root's export list",
asserting that a symbol added to `packages/core/src/index.ts` was caught by no
gate and no test. That was wrong, and how it was measured is the lesson.

The author ran three instruments against a kernel-root-only re-add — the
published-surface matrix, `check:surface` and `check:family` — found all three
green, and concluded "nothing". The suite that contains the guard which _does_
hold it was never run. `CLAUDE.md` records this exact shape about its own gate
table: an instrument that looks in one place and reports absence is the fail-open
these gates exist to catch. Filing that as a bug, splitting an ADR row on it, and
marking half of it `pending` propagated one unrun test into five artifacts.

**What actually holds the kernel root**, both measured 2026-09-09:

| addition to `packages/core/src/index.ts` | caught by                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| a **value** export                       | `packages/ts/tests/standalone-surface.test.ts` — reds with `expected [ 'throwIfViolations' ] to have a length of +0` |
| a **type** export                        | `check:surface` — reds as `1 of 101 symbols … appear in no docs/ page`                                               |

Both run inside `npm run validate`. The ADR-014 row is `gated` on the first plus
the published-surface matrix.

## The residual that is real

Two narrow gaps survive, each needing two coordinated acts rather than one slip.

**1. A value export added to the kernel root AND to an exclusion set.**
`packages/ts/tests/standalone-surface.test.ts` imports `FAMILY_ONLY`,
`KERNEL_INTERNAL`, `ANSI_INTERNAL` and `KERNEL_PRIVATE_BEFORE_THE_SPLIT` from
`scripts/lib/kernel-surface.mjs` and excludes their members. Importing the sets
rather than restating them is right and deliberate — plan 0165 records a
hand-synced pair drifting — but it means a name added to a set in the same
change is exempted with nothing to say so. `KERNEL_INTERNAL` is currently empty
and its own docstring calls it "a real category, currently unused".

**2. A type export whose name already appears in docs.** The value guard is
explicitly value-only, by its own docstring: `import * as ns` captures what
exists at runtime. So types fall to `check:surface`, which binds a symbol to a
documentation _mention_ — and cannot tell a documented export from a documented
prohibition. `throwIfViolations` is the live example: it stays in
`docs/presets.md` as a call `noVerdictOutsideRules` forbids.

## Why it is Low and not fixed here

Neither gap is reachable by a single careless edit, and closing them properly
means a checked-in census of the kernel root asserted both directions — the shape
`packages/ts` proves out. That mechanism would red on every legitimate kernel
root addition by design, which is a change to how the kernel's public API
evolves and belongs in an ADR-011 amendment rather than in a plan phase.

## Verification ledger

- [ ] A decision on whether the kernel root's membership is frozen (ADR-011
      amendment, or an explicit "no, the two guards are enough").
- [ ] If yes: the census, asserted both directions, with a vacuity arm proving
      the scan reads the real root, and covering types as well as values.
- [ ] Either way: a note in `scripts/lib/kernel-surface.mjs` that adding a name
      to an exclusion set silently exempts it from the standalone-surface guard.
