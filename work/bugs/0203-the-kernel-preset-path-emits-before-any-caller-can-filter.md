# Bug 0203: the kernel's preset path emits before any caller can filter

## Status

- **State:** Draft — the kernel half of
  [bug 0201](./fixed/0201-executecheck-prints-before-the-caller-can-filter.md),
  whose dialect half is fixed. Measured, with the leak reproduced after that fix.
- **Deferred:** none
- **Found:** 2026-08-21, splitting 0201 once its `.check()` half was repaired.

## Symptom

`packages/core/src/report.ts:58-69` — `finishPreset` emits unconditionally before
it throws:

```ts
const mode: ReportMode = options.report ?? 'throw'
if (mode === 'return') return violations
reportViolations(violations, options) // ← unconditional
if (mode === 'throw' && violations.length > 0) {
  throw new ArchRuleError(violations, options.reason)
}
```

So a preset called at module scope in a rule file — `...recommended(p)` without
`report: 'builders'` — prints its findings **before the CLI sees them**. No
CLI-side filter can act on that output: not `--baseline`, not `--changed`, not the
run-level suppression tallies.

## Why it survived 0201's fix

0201 fixed the **dialect** path: `packages/ts/src/core/execute-rule.ts`'s
`executeCheck` now honours `callerAggregatesReports`, so a `.check()` at module
scope stays quiet under `eess-ts check`. Measured: the leaked violations went 4 → 0.

`finishPreset` lives in `@nielspeter/eess` and has **no such flag to honour**.
`setCallerAggregatesReports` is ts-dialect module state; the kernel cannot read it,
and should not — a kernel that reaches into a dialect's globals is the wrong shape.
Measured after the dialect fix, same run, same fixture:

| rule file                                     | leaked to stderr    |
| --------------------------------------------- | ------------------- |
| `.check()` at module scope                    | **nothing** — fixed |
| `...recommended(p)` (no `report: 'builders'`) | **still leaks**     |

## Why this is ADR-008's question, not a patch

[ADR-008](../../adr/008-caller-owns-reporting.md) says the caller decides **how and
whether** to emit. Presets got `PresetReportOptions` and honour it; the kernel's
`finishPreset` honours `'return'` (don't run, don't emit) and `'warn'`, but has no
way to express _"run, throw, and let my caller emit"_ — which is exactly what an
aggregating CLI needs. `report: 'builders'` is the current workaround and it is a
different thing: it declines to run the rules at all.

That missing mode is the defect. Candidates:

1. **A new `ReportMode`** — e.g. `'throw-quiet'` / `'collect'`: run, throw, do not
   emit. Small, additive, no new state. The name matters more than the mechanism;
   `'builders'` vs this pair is already a subtle distinction to document.
2. **An explicit `emit` predicate on `PresetReportOptions`**, so the caller decides
   per call rather than picking from an enum.
3. **The kernel gains its own caller-aggregates flag**, mirroring the dialect's.
   Rejected on sight unless the other two fail: it is the same process-global
   pattern in a second place, and it would put a CLI concern in the kernel.

Whatever ships must keep `.check()` and a preset in a **test file** printing as
they do today — that is what every existing consumer relies on, and it is why
neither half of this is a one-line default change.

## Until it is fixed

`eess-ts check` reports the leak rather than hiding it: `baselineNotApplied()` in
`packages/ts/src/cli/rule-file-findings.ts` fires when a rule file printed findings
a CLI-side filter could not reach, and names the remedy. That notice is now gated
on **measured** leakage — `suppressedCheckWrites()` — so it fires for this path and
NOT for the repaired `.check()` path.

**When this bug is fixed, that notice must be re-examined**: if no path can still
leak, it becomes a rule that cannot fire and must be removed rather than left green
forever (ADR-010).

## Verification

- [ ] Red test first: a rule file whose preset enforces at module scope, run under
      `eess-ts check`, writes nothing of its own — asserted on the rule file's
      output, not the CLI's.
- [ ] `.check()` and a preset in a **test file** still print, unchanged.
- [ ] `--baseline` and `--changed` both apply to a preset-enforcing rule file's
      findings once it is fixed.
- [ ] `baselineNotApplied` is removed, or its remaining reachable path is named and
      tested.
