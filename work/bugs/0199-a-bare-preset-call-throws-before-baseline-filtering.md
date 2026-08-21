# Bug 0199: a bare preset call throws before `--baseline` can filter, so accepted violations resurface

## Status

- **State:** Draft — measured end-to-end from a packed install, both directions.
- **Deferred:** none
- **Found:** 2026-08-21, while measuring ts-archunit → eess-ts baseline
  compatibility for [bug 0198](./0198-no-migration-path-from-ts-archunit.md).

## Symptom

A rules file that calls a preset **without** `report: 'builders'`:

```ts
export default [...recommended(p)]
```

evaluates the preset at **module-evaluation time**. `deliver()` defaults to
`report: 'throw'` (ADR-008), so the preset throws the moment it finds a
violation — **before** the CLI's baseline filtering ever runs. The `--baseline`
flag is silently inert.

Measured: a project with a full, byte-matching baseline covering **all 5** of its
violations still exits **1**, reporting 2 of the 5 as failures.

```
npx eess-ts check arch.rules.ts --baseline arch-baseline.json
→ exit 1
  src/services/order-service.ts:4 — OrderService.place     ← in the baseline
  src/services/report-service.ts:6 — ReportService.todo    ← in the baseline
```

Both are present in `arch-baseline.json` at exactly those positions. The same
project with `report: 'builders'` added exits **0** with all 5 suppressed.

## Why the failure is quiet in the worst way

The user gets a red build listing violations they have already accepted, and
**nothing in the output mentions the baseline at all**. The rule-file finding
says the file "stopped evaluating", which is true and useless — it points at
evaluation order, not at the reason their accepted debt reappeared. Nothing says
"your preset call is enforcing directly, so `--baseline` did not apply."

It also truncates the run: the throw stops the file, so every rule declared after
the first throwing preset never runs. In the measurement, `agentGuardrails(...)`
on the next line was never evaluated and its 3 violations went unreported — a
**silent under-report** sitting beside a red build.

## Who hits it

- **Every `@nielspeter/ts-archunit` migrator, with certainty.** ts-archunit's
  `recommended()` returns builders directly — it has no `deliver()` and never
  throws. eess-ts's routes through `deliver()`. So the identical rules file,
  with only the import specifier changed, behaves differently. See 0198.
- **Anyone hand-writing rules from the README.** `packages/ts/README.md:175`
  describes `recommended(p)` in exactly the bare form that triggers this.
- **Not** users of `eess-ts init` — it scaffolds `report: 'builders'` on all 8
  preset calls, which is why this never showed up in the repo's own dogfooding.

## Root cause

`packages/ts/src/presets/shared.ts` — `deliver()` returns builders only for an
explicit `report: 'builders'`; omission falls through to `finishPreset` with
`report: options?.report ?? 'throw'`.

That default is **correct per ADR-008** and is not what should change. The defect
is that the throwing path and the CLI's baseline path are unaware of each other:
a preset that enforces inline cannot see a baseline the CLI holds.

## Fix

Not decided. The design question is which layer owns it:

1. **The preset consults the baseline** — requires the baseline path to be
   reachable from `deliver()`, which crosses the boundary ADR-008 draws between
   detection and emission.
2. **The CLI refuses the combination** — if `--baseline` is passed and a rule
   file throws out of a preset, report that specifically: "`--baseline` was not
   applied; this preset enforces inline — pass `report: 'builders'`." Cheap,
   honest, and fails loudly instead of quietly.
3. **The CLI sets the mode** — when invoked via `eess-ts check`, presets default
   to `'builders'`, since the CLI is the caller that owns reporting.

Option 2 is the smallest thing that removes the silence. Option 3 is closest to
ADR-008's "caller owns reporting" but changes a default again.

## Verification

- [ ] Red test first: a fixture project with a complete baseline and a bare
      preset call must red today, and must not after the fix.
- [ ] The truncation case: rules declared after a throwing preset are either
      evaluated or explicitly reported as not evaluated with their count.
- [ ] `--baseline` with a bare preset produces a message naming the baseline.
- [ ] The break class is registered in `scripts/check-nonvacuity.mjs`.
