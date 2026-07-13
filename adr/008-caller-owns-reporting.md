# ADR-008: Detection is separate from reporting; the caller owns emission

## Status

Accepted (2026-07-13). Implements plan
[0070](../work/plans/0070-caller-owns-reporting.md).

## Context

eess had two divergent ways to surface violations:

- **`executeCheck`** (the `.check()` path) — format-aware: honours
  `--format json/github`, baseline, and diff filters.
- **`throwIfViolations`** (the preset path — `adrEnforcement`, `honestyAtClose`,
  the cross-validation and eess-ts presets) — hardcoded stderr text, always
  printed, then threw.

Because presets emitted as an unavoidable side effect, a caller embedding eess
(a custom harness, or eess's own `check-*.mjs` dogfood scripts) could not own
reporting: catching the `ArchRuleError` and formatting it produced a **double
render**, and a preset could not emit `--format json` at all. There was no
non-throwing path, so callers resorted to `try/catch` and `.slice(0, 0)` hacks
to count-without-listing.

## Decision

**A check detects; the caller decides how — and whether — to emit. Emission
lives in one place, and it is opt-in for the preset path.**

- **`reportViolations(violations, { format, reason })`** is the single emitter —
  text (stderr), JSON, or GitHub annotations (stdout). It never throws or
  filters. Both `executeCheck` and the preset path delegate to it, so the two
  reporting paths cannot diverge again.
- **Presets take `PresetReportOptions`** (`{ report?: 'throw' | 'return' |
'warn', format? }`) and finish via **`finishPreset`**. `throw` (default) emits
  then throws — backward-compatible; `return` hands violations back and emits
  nothing; `warn` emits without throwing. Preset return type is
  `ArchViolation[]` (was `void` — a safe widening).
- `throwIfViolations` is retained as `finishPreset(v, { report: 'throw' })` for
  compatibility.

The default stays print-then-throw, so no CLI change is required; a caller opts
into `report: 'return'` to own emission.

## Consequences

- Embedders own reporting: no double render, and preset violations can be
  emitted as `--format json` like rule violations.
- One emission code path, format-aware, shared by checks and presets.
- Existing call sites are unaffected (default behavior unchanged); the option is
  additive.
- Mild surface growth: three new kernel exports (`reportViolations`,
  `finishPreset`, and the option types).

## Enforcement

Test citations are by file + case name in prose, not the `it(…)` form:
`check:crossval` (the AST title resolver) scans only the eess-ts project, while
these tests live in `@nielspeter/eess` (`packages/core`). `check:corpus`
verifies the files exist, and the cases run in `npm test` (the gate). Widening
`check:crossval` to resolve citations across every package is a separate
follow-on (plan 0070 Out of scope).

| Clause                                           | Tier | Mechanism                                                                                                                                                                   | Status |
| ------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| One emitter shared by both paths                 | 1    | `executeCheck` and `finishPreset` both call `reportViolations` — `packages/core/src/report.ts`, `packages/core/src/execute-rule.ts`, `packages/core/src/preset-dispatch.ts` | gated  |
| Presets return violations, don't force emission  | 2    | `packages/core/tests/report.test.ts` — the `report: return` case (returns violations, no stderr/stdout write)                                                               | gated  |
| Default preset behavior unchanged (emit + throw) | 2    | `packages/core/tests/report.test.ts` — the default throw-mode case (emits once, then throws)                                                                                | gated  |
| Caller owns format — presets can emit JSON       | 2    | `packages/core/tests/report.test.ts` — the `format: json` case (writes JSON to stdout)                                                                                      | gated  |
