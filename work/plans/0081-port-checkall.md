# Plan 0081: Port `checkAll` — a test-file terminal for an array of rules

## Status

- **State:** Draft
- **Priority:** P3 — the one API gap surfaced by the 2026-07-23 ts-archunit
  audit. A convenience, not a hole: eess is CLI-first, so it was reasonably
  skipped in the [0071 parity pass](./completed/0071-ts-archunit-parity.md). But
  the test-file workflow is a supported, documented shape in ts-archunit, and
  the primitives to close it already exist in the kernel.
- **Effort:** XS — one kernel function + tests. No new primitives.
- **Created:** 2026-07-23

## Problem

eess-ts reached ts-archunit `0.17.0` parity in
[plan 0071](./completed/0071-ts-archunit-parity.md). A follow-up audit
(2026-07-23) found exactly one shipped ts-archunit engine export with no eess
equivalent: **`checkAll(rules, options?)`** (`ts-archunit/src/core/check-all.ts`,
shipped `0.16.0`). It is the **test-file terminal for an array of rules** — run
them all, aggregate, throw one `ArchRuleError` listing every failure.

eess has no equivalent (verified across all packages). A consumer who prefers
test files over the CLI rule-file golden path has no way to run a spread of
rules and get **one aggregated** failure:

```ts
// today, in a test file:
ruleA.check() // throws here — ruleB never runs, its violations are lost
ruleB.check()
```

`.check()` per rule stops at the first failure. There is no "run this whole
array and tell me everything that's wrong."

Everything else about ts-archunit's engine is either already in eess or ahead of
it (eess has the full family — kernel + `ts`/`mermaid`/`md`/`gherkin` +
`crossvalidate` — where ts-archunit's `packages/` is still an empty skeleton).
This plan closes the single remaining delta.

## Design

The port is small because eess's kernel already ships every part:

- `.violations(): ArchViolation[]` on both `RuleBuilder<T, P>` and
  `TerminalBuilder` — the `Dispatchable` shape in `packages/core/src/preset-dispatch.ts`.
- `CheckOptions` (baseline, diff, format) — `packages/core/src/check-options.ts`,
  `diff-aware.ts`. eess **does** have baseline/diff (the dogfood declines to use
  them, per [0060](./completed/0060-full-coverage-dogfooding.md), but the kernel
  supports them for consumers).
- `finishPreset(violations, options)` — the ADR-008 report / throw / return /
  warn terminal ([plan 0070](./completed/0070-caller-owns-reporting.md)).
- `ArchRuleError`.

So eess's `checkAll` is ts-archunit's function re-expressed through eess's
_consolidated_ reporting — which postdates ts-archunit's version, so eess gets to
reuse `finishPreset` instead of ts-archunit's older `writeReport` + manual throw:

```ts
// packages/core/src/check-all.ts
import type { ArchViolation } from './violation.js'
import type { CheckOptions } from './check-options.js'
import { finishPreset, type PresetReportOptions } from './report.js'

/** Anything with `.violations()` — every rule/terminal builder, any dialect. */
export interface RuleLike {
  violations(): ArchViolation[]
}

/**
 * Run an array of rules (e.g. a spread preset, or an `arch.rules.ts` default
 * export) in a test file and aggregate: report once, then throw a single
 * `ArchRuleError` listing every violation — where `.check()` per rule would stop
 * at the first failure.
 */
export function checkAll(
  rules: readonly RuleLike[],
  options?: CheckOptions & PresetReportOptions,
): ArchViolation[] {
  let violations = rules.flatMap((r) => r.violations())
  if (options?.baseline) violations = options.baseline.filterNew(violations)
  if (options?.diff) violations = options.diff.filterToChanged(violations)
  return finishPreset(violations, options) // report + throw (default) / return / warn
}
```

Reusing `finishPreset` means `checkAll` inherits `--format json`,
`report: 'return'`, and `report: 'warn'` for free (ADR-008) — and `report:
'return'` makes it testable without catching throws.

### Design decision — severity

ts-archunit's `checkAll` filters to **error**-severity before throwing, because
its rules **stamp** severity onto their violations via `.asSeverity()`. eess
applies severity differently: at the **terminal** (`.check()` / `.warn()` /
`.severity(level)`) and, inside presets, via `dispatchRule` (`off` / `warn` /
`error`) — it does **not** stamp severity onto `ArchViolation`. So a generic
`checkAll` over pre-terminal builders has no per-rule severity to honour; it
treats the array uniformly (throw on any, or `report: 'warn'` for the whole
set). **Per-rule warn/error mixing stays a preset concern** (`dispatchRule`),
which is exactly where eess already models it.

This is the one deliberate divergence from ts-archunit, and it is the _right_
one: importing violation-stamping would fork eess's severity model to match a
predecessor it has otherwise moved past.

## Implementation phases

### Phase 1 — `checkAll` + `RuleLike` in the kernel

- New `packages/core/src/check-all.ts` (above).
- Export `checkAll` and `RuleLike` from `packages/core/src/index.ts`.
- **Open decision:** kernel-only, or also re-export from `@nielspeter/eess-ts`?
  ts-archunit exports it from its (single) package; eess consumers import
  terminals from the kernel (`@nielspeter/eess`). Recommend **kernel-only** —
  `checkAll` is dialect-independent, and the kernel is where the other terminals
  (`finishPreset`, `reportViolations`) live. Surface on `eess-ts` only if the
  migration story needs it.

**Files changed:** `packages/core/src/check-all.ts` (new),
`packages/core/src/index.ts`.

### Phase 2 — tests (red/green, non-vacuous)

`packages/core/tests/check-all.test.ts`:

- **Aggregation** — `checkAll([ruleA, ruleB])` where _both_ fail throws one
  `ArchRuleError` whose violations include **both** rules', proving it does not
  stop at the first (the whole point).
- **Return mode** — `checkAll(rules, { report: 'return' })` hands back the
  aggregated array without throwing and without writing to stderr (ADR-008).
- **Green** — an array of all-passing rules returns `[]` and does not throw.
- **Baseline/diff** — a `baseline.filterNew` that removes a known violation drops
  it from the aggregate (light fixture).

## Out of scope

- **Per-rule severity stamping / `.asSeverity()`** — eess models severity at the
  terminal and via `dispatchRule`; this plan does not import ts-archunit's
  violation-severity stamping (see the design decision).
- **CLI changes** — `checkAll` is a test-file / programmatic terminal. The CLI
  already aggregates a rule file's default-export array via `eess-ts check`.
- **ts-archunit's `packages/` monorepo skeleton** — unrelated; eess already _is_
  that structure, fully built.

## Success definition

- A test that calls `checkAll([ruleA, ruleB])` with both failing throws a single
  `ArchRuleError` listing **both** — where `.check()` per rule would have stopped
  at `ruleA`. Proven by a red/green fixture test in the kernel.
- eess reaches parity with ts-archunit `0.16.0`'s `checkAll` terminal, adapted to
  eess's `finishPreset` reporting (ADR-008) rather than porting the older
  `writeReport` path.

## Progress ledger

- [ ] Phase 1 — `checkAll` + `RuleLike` in the kernel, exported
- [ ] Phase 2 — aggregation / return / green / baseline tests
