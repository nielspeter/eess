# Bug 0203: a preset at module scope prints its findings twice, and no flag is needed

## Status

- **State:** Draft — **rewritten 2026-08-21** after review. The first version framed
  this as a kernel-only filtering concern and got both halves wrong; see
  "What this record used to say".
- **Deferred:** none
- **Found:** 2026-08-21, split from
  [bug 0201](./fixed/0201-executecheck-prints-before-the-caller-can-filter.md) once
  its `.check()` half was fixed. Re-scoped by the architecture and product reviews
  of PR #74.

## Symptom — a double print, with no flags at all

`eess-ts check arch.rules.ts`, no `--baseline`, no `--changed`, on a rule file
whose preset enforces at module scope (`export default [...recommended(p)]`):

```
Architecture Violation [1 of 1]        ← the preset's own emission
  src/a.ts:2 — bad
Architecture Violation [1 of 2]        ← the SAME violation, from the CLI
  src/a.ts:2 — bad
Architecture Violation [2 of 2]
  Rule: eess-ts: rule file
✗ eess-ts — 0 rules across 1 file · 1 of 0 rules failing · 1 violation
```

Measured on this repo's own `enforcing-preset.rules.ts` fixture: **13 violation
blocks, 6 of them exact duplicates**, under a summary line claiming `1 violation`.

`finishPreset` emits through the kernel's `reportViolations`; `failureOrViolations`
then collects the same violations off the thrown error and the CLI reports them
again. One violation, two blocks, two contradicting counters.

**This is the flag-independent, primary symptom**, and it is what a migrator sees
on their first `eess-ts check` — the bare `recommended(p)` form is what
`packages/ts/README.md` teaches and what a rule file carried over from
`@nielspeter/ts-archunit` will have.

The filtering consequence is the _secondary_ one: with `--baseline` or `--changed`
the printed copy is also unfiltered, so already-accepted findings reappear. That is
what [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)
covers with a notice — **and that notice is gated on those flags, so the
double-print case above gets no notice at all.**

## What this record used to say, and why that is kept

**Version 1 claimed the kernel must grow a new report mode, because
`setCallerAggregatesReports` is ts-dialect state "no dialect flag can reach".**
Both halves are wrong:

1. **A dialect flag CAN reach it.** `deliver()` in
   `packages/ts/src/presets/shared.ts` is ts-package code and the single site all
   five ts presets finish through. **Measured:** having it honour the flag —
   returning violations and throwing itself instead of calling `finishPreset` —
   takes the fixture from **8 blocks with the leak** to **2 with none**. No kernel
   change, no fourth `ReportMode`, no second global.
2. **A new mode nobody passes fixes nothing.** Version 1 listed `'throw-quiet'` and
   an `emit` predicate as candidates 1 and 2. Both require the _leaking call site_
   to opt in — and the leaking call site is `...recommended(p)`, written by someone
   who passed nothing. That is the entire defect. Only a run-level override
   addresses it, which version 1 listed as candidate 3 and "rejected on sight".

Recorded rather than deleted because version 1 would have sent the next reader to
the kernel to design an API that does not solve the case.

## Two more unguarded emitters that no record named

Found by the architecture review of PR #74, and the reason this section exists:

| unguarded emitter                                    | status                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/core/src/report.ts` — `finishPreset`       | this bug                                                                            |
| `packages/core/src/execute-rule.ts` — `executeCheck` | **this bug** — added on review                                                      |
| `packages/ts/src/core/check-all.ts` — `writeReport`  | **this bug** — added on review                                                      |
| `packages/core/src/execute-rule.ts` — `executeWarn`  | [bug 0163](./0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md) |

**The kernel's `executeCheck` is the same defect 0201 fixed in the dialect copy**,
and 0201 fixed only the ts one. Before that the two copies had identical emission
semantics; now they diverge **behaviourally**, which is precisely what
[plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md) was raised to
**High** for on 2026-08-21 — "the fix had landed in `packages/ts` with the engine
copy and never reached the kernel". Latent today (bug 0163 measured that no
aggregating caller drives the kernel copy), but it is the second instance in two
days and it was unrecorded until review caught it.

## Fix

Not decided. The dialect-local fix in `deliver()` is measured and small, and it
resolves the double print for every ts preset. Open questions before it ships:

- **Does it belong in `deliver()` or does `checkAll()` need the same treatment?**
  `check-all.ts` has its own `writeReport` call and is a third path.
- **The notice's fate.** With `deliver()` fixed, can `baselineNotApplied` still
  fire? The architecture review counts **four** throw paths reaching that catch —
  `.check()`, preset, `checkAll()` at module scope, and `.warn()` with a live
  selector — not the two its comment claims. If none can leak afterwards, the
  notice must be removed rather than left as a rule that cannot fire (ADR-010).
- **The kernel copy and `check-all.ts`** either get the same guard or are recorded
  as knowingly divergent, with plan 0188 owning the convergence.

## Verification

- [ ] Red test first: `eess-ts check` on a preset-enforcing rule file, **no flags**,
      prints each violation exactly once.
- [ ] The summary line's violation count matches the number of blocks printed.
- [ ] A preset in a **test file** still prints as it does today.
- [ ] `--baseline` and `--changed` apply to a preset-enforcing rule file's findings.
- [ ] `baselineNotApplied` is removed, or its remaining reachable path is named and
      tested.
- [ ] The kernel `executeCheck` and `check-all.ts` are fixed or recorded as
      divergent, cross-linked from [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md).
