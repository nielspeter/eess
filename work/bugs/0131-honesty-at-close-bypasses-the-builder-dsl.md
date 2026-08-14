# Bug 0131: `honestyAtClose` builds no rule — a shipped preset that hand-iterates the corpus, invisible to every kernel mechanism present and future

## Status

- **State:** Draft — read from the source and confirmed by instrumenting both
  kernel examining seams: `check:ledger` emitted **zero** evidence records while
  reporting 27 done-items across 68 documents. No red test yet.
- **Severity:** Medium — nothing is wrong in its output today; `check:ledger` finds
  real violations and has caught them ([0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md),
  [0119](./fixed/0119-placement-check-never-ran.md)). It is an ADR-003 divergence in
  a **published** preset, and its cost is that every kernel-level guarantee — the
  ones that exist and the ones 0088 will add — routes around it silently.
- **Origin:** self-found · architect persona, six-persona review of
  [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) and
  [0128](./0128-enforcement-status-is-the-cell-nothing-derives.md)
- **Reported:** 2026-08-12

## Symptom

`packages/md/src/rules/ledger.ts` imports one thing from the kernel — the reporting
seam — and no builder at all:

```ts
import { finishPreset, type PresetReportOptions } from '@nielspeter/eess'
import { collectTaskItems } from '../model/task-items.js'
```

It then iterates the corpus directly (`packages/md/src/rules/ledger.ts:297`) and
hand-assembles `ArchViolation[]`. The md dialect ships six builders — `docs`,
`links`, `pointers`, `rows`, `taskItems`, `vocabulary` — and this preset uses none
of them. Measured: instrumenting `RuleBuilder.evaluate()` and
`CorrespondenceBuilder.collectViolations()` and running all eight rule-running
gates, `check:ledger` contributed **0 of 44** records.

## Reproduction

```bash
rg -c 'docs\(|links\(|rows\(|taskItems\(|pointers\(|vocabulary\(' packages/md/src/rules/ledger.ts   # 0
rg -n '^import' packages/md/src/rules/ledger.ts                                                     # no builder
```

## Root cause

Not known — the file predates the measurement, and its shape may be deliberate: the
honesty-at-close analysis is stateful across a document (find the State token, then
the region, then the boxes within it), which is awkward to express as a
predicate/condition pipeline over a flat element set. That is a real constraint and
possibly a correct decision.

What is missing is that the decision is **unrecorded**. ADR-003 makes the fluent
builder the pattern; ADR-006 makes presets functions built from rules. A preset that
descends to raw iteration is a departure from both, and nothing in the file says why.

## Why it matters

The cost is not the current output — it is that the preset is invisible to every
mechanism that operates on rules:

- **Today:** it emits no evidence at either examining seam, so a coverage
  measurement over the family cannot see it
  ([0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) counts it as
  zero rules), and `.excluding()`, `select()`, baseline/diff and the combinators do
  not apply to it.
- **After 0088:** the fail-closed floor lands at the terminal seam. `honestyAtClose`
  never reaches that seam, so **the floor cannot reach it** — the gate keeps its
  current fail-open behaviour permanently while every sibling gains a guarantee.
  0127 records this as a constraint on the floor; this record is the other half of
  it.

That second point is the one that decides the priority. Every future kernel
guarantee inherits this hole unless the preset either joins the DSL or the departure
is recorded as a known limit with its own compensating check.

`check:ledger` is also the gate the portable kit under `kit/` ships to other teams as
its honesty mechanism, so the limit travels.

## Fix

Decide which, and write the decision down — that is the deliverable either way:

1. **Express it through the DSL.** `taskItems()` and `docs()` exist; the stateful
   part is the State-region resolution, which could become a predicate over
   documents plus a condition over their task items. If it fits, the preset inherits
   every kernel mechanism for free, now and later. Survey first — this may not fit,
   and forcing it would be worse than not.
2. **Record the departure.** If raw iteration is the honest shape, say so in the
   file and in an ADR row, name what it costs (no floor, no exclusions, no evidence,
   no baseline), and give it a compensating check — at minimum, a non-vacuity
   fixture proving it fires, which `bad-ledger.mjs` already provides for three of its
   rules.

(1) is preferable if it fits; (2) is not a fallback but a legitimate answer, provided
the cost is stated rather than discovered by the next person building a kernel-level
guarantee.

## Verification

- [ ] Survey first: can the State-region analysis be expressed as a predicate over
      `docs()` plus a condition over `taskItems()`? That answer picks the fix.
- [ ] Red test written first: an arch rule asserting no preset under
      `packages/*/src/rules/**` hand-assembles `ArchViolation[]` without a builder —
      or, under fix (2), asserting that the documented exception list contains
      exactly this file. Either way the claim is derived, not asserted in prose.
- [ ] Whichever fix: `check:ledger`'s output is unchanged, proven by the existing
      `bad-ledger.mjs` fixtures plus a clean run over the real corpus.
- [ ] `npm run validate` green, with the ledger summary reporting the same counts.

Deferred: none — the floor that makes this consequential is
[0088](../plans/0088-fold-ts-archunit-into-eess.md)'s, and this record closes on the
decision rather than on the floor.
