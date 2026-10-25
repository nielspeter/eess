# Bug 0538: a metric baseline never tightens

## Status

- **State:** Draft — read from both baseline copies on 2026-10-21; no red test yet.
- **Severity:** Medium — **a paid-down metric can grow back to its old ceiling without a word.** A
  baselined metric finding is known while its measurement is no greater than the accepted one, and
  nothing reports a measurement below it, so the ceiling stays where it was written. Pay a class
  down from 400 lines to 250 and it can grow back to 400 green. The manifesto's baseline clause is
  "record the gap, don't fake the gate, ratchet it closed" (`docs/manifesto.md:438`); this ratchet
  only turns one way.
- **Origin:** self-found, 2026-10-21, while choosing a ratchet for this repository's own adoption of
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask A (plan
  [0541](../plans/completed/0541-this-repositorys-record-mentions-are-gated.md)), which needed a per-file count that
  falls and stays down.
- **Reported:** 2026-10-21

## Symptom

`Baseline.isKnown` in the kernel (`packages/core/src/baseline.ts:259-267`) and its eess-ts copy
(`packages/ts/src/helpers/baseline.ts:655-686`) both return known for a metric finding whose
`measured` is `<=` the accepted value. The design is stated beside them, "an improvement stays
known" (`packages/core/src/baseline.ts:256`, `packages/ts/src/helpers/baseline.ts:104-106`), so
paying down debt does not turn the build red ([ts-archunit bug 0012](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0012-metric-findings-have-no-usable-ratchet.md)'s
reason). Neither copy reports the gap between the two numbers, and neither the CLI's `baseline`
command nor a run rewrites the accepted value downward. Nothing tells the author the ceiling could
be lowered, so it is not.

No dialect emits `measured` through the kernel copy today (its own comment says so); eess-ts's
metric rules use the eess-ts copy.

## Root cause

"Known" is a single yes/no, and the only no is a regression. Slack is neither, so it is invisible.

## Fix

Undecided. Two shapes, not chosen here: a finding when a measurement falls below its accepted value
("lower the ceiling", fixable by regenerating), which turns paying down red until the baseline is
updated; or a disclosure line naming the slack beside a green run, which keeps the green and says
what could tighten. The first is the fail-closed one and changes behaviour for every metric baseline.

## Verification

- [ ] A red test: a baselined metric paid down and grown back to its old ceiling is not silently
      green.
- [ ] The chosen shape applied to both copies, or the eess-ts copy retired onto the kernel's.
