# Bug 0206: `deliver()` bypasses the kernel finisher on the dialect's default path

## Status

- **State:** Fixed — was NOT latent after all; see the first box.
  Previously read: Draft — latent. Nothing is broken today; the exposure is that the two
  paths can drift and no test would notice.
- **Deferred:** none
- **Found:** 2026-08-21, architecture review of PR #75.

## Symptom

`packages/ts/src/presets/shared.ts` — `deliver()` throws `ArchRuleError` **itself**
when a run-level caller is aggregating, instead of delegating to the kernel's
`finishPreset`:

```ts
if (mode === 'throw' && callerAggregates()) {
  if (violations.length > 0) throw new ArchRuleError(violations, options?.reason)
  return violations
}
return finishPreset(violations, { report: mode, format: options?.format, reason: options?.reason })
```

Today the two are semantically identical — `packages/core/src/report.ts`'s
`finishPreset` emits, then throws `new ArchRuleError(violations, options.reason)` on
the same condition. So this is not a defect in behaviour.

**The exposure is which path is bypassed.** Under `eess-ts check` — the aggregating
caller, and the shape a rule file actually has — the kernel finisher is now skipped
on the **default** delivery path. `report: 'warn'` and `report: 'return'` still go
through it. So any future change inside `finishPreset` — stamping, dedupe, ordering,
error metadata, a new field on `ArchRuleError` — would reach the explicit modes and
**not** the default one, in the dialect that is the family's flagship.

No test would catch that. There is no assertion anywhere that the aggregating path
and `finishPreset` produce the same error payload.

## Why it was written this way

`finishPreset` **emits and then throws**, and emitting is precisely what must not
happen under an aggregating caller ([bug 0203](./0203-a-preset-at-module-scope-prints-its-findings-twice.md)).
The kernel has no mode meaning _"run, throw, and let my caller emit"_ —
`'return'` declines to throw, `'warn'` declines to throw, and the default emits. So
the dialect had nowhere to delegate to.

That gap is the real subject here. It is the same one
[ADR-008's amendment](../../../adr/008-caller-owns-reporting.md) records: aggregation
is a property of the run, and the kernel's preset API is per-call.

## This and bug 0205 prescribe opposite fixes for the same site

[Bug 0205](../0205-four-emitters-restate-the-suppression-rule-and-disagree.md) wants
`deliver()` wired into a shared ts-side emit-and-throw primitive. Option 2 below
**deletes** `deliver()`'s aggregation branch entirely, removing it from 0205's four
sites. Doing 0205 first deepens the bypass this record is about.

**Whichever ships first makes the other's stated fix wrong.** Decide this one first,
or decide both together.

## Fix

Not decided. Three shapes, in increasing order of what they commit to:

1. **Assert the equivalence instead of removing it.** A test that runs one preset
   both ways and compares the thrown `ArchRuleError`'s payload field by field.
   Cheapest, keeps the duplication, and turns a silent drift into a red test. Does
   nothing about the underlying gap.
2. **Give the kernel a non-emitting throw path** — a `finishPreset` that takes the
   emission decision from the caller rather than the mode. Then the dialect
   delegates again and the duplication disappears. This is a kernel API change and
   wants weighing against the `ReportMode` vocabulary already in place.
3. **Move the aggregation concept into the kernel.** Rejected on sight in bug 0203
   and still rejected: it puts a CLI concern in the kernel and adds a second
   process-global.

Option 1 is worth doing regardless of whether 2 ever happens — it is the thing that
makes the drift loud.

## Verification

- [x] Red test first, and it was genuinely red: `packages/ts/tests/presets/all-off-and-aggregation.test.ts`
      ("the receipt rides the throw, so an aggregating caller sees the evidence")
      failed on first run. The drift was live at that moment — `deliver()`'s
      aggregating branch returned before `finishPreset` was ever called, so the
      emitter's evidence gate never ran on that path. An all-off preset reported
      correctly on the default path and **silently** under `eess-ts check`.
      Written to close this bug, it found the bug still open.
- [x] Both doors are asserted, not assumed: the same file pins the aggregating
      path and the default path reaching the same verdict
      ("and the non-aggregating default reaches the same verdict"). Asserting
      only one is how the drift went unnoticed.

**The picked direction, per plan 0235 Phase 0.** The aggregating branch keeps
throwing without emitting — emission is the caller's under bug 0203 — but it now
runs the gate first, so the `ArchRuleError` carries the receipt with the finding
already in it. Teaching the kernel finisher a run-level aggregation mode was the
alternative and is plan 0188's scope; a plan that must close in one PR does not
reach into another plan's.

Deferred: none.
