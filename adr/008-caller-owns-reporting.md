# ADR-008: Detection is separate from reporting; the caller owns emission

## Status

Accepted (2026-07-13). Implements plan
[0070](../work/plans/completed/0070-caller-owns-reporting.md).

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

### Amendment 2026-08-22 — a run-level caller may suppress emission

**The default is print-then-throw for a caller that has not said otherwise.** A
caller that declares it aggregates the whole run gets **throw without emit**, and
that is not an opt-in mode — it is selected by the run, not by the call.

The distinction the paragraph above missed: `report` is chosen at the **call site**,
and for the case this governs there is no call site to choose at. A self-executing
rule file writes `.check()` with no arguments, and `recommended(p)` is written by
the rule file's author, not by the CLI that loads it. So the CLI cannot express
"run these and let me do the reporting" through `PresetReportOptions` or
`CheckOptions` — the only party who could pass an option is the one party who does
not know a CLI is driving.

`eess-ts`'s `withCallerAggregating` is therefore a run-scoped declaration rather
than an option, and while it is in effect `executeCheck`, `deliver()` and
`checkAll()` throw without emitting. **The violations are not lost:** they ride the
thrown `ArchRuleError`, which the aggregating caller collects and reports once.

**The governing invariant, which the four read sites must each satisfy: suppress
exactly what rides the throw, and nothing else.** `executeWarn` is the case that
proves the rule has content — its warn-severity violations do **not** ride the
throw (only the configuration findings do), so it suppresses only the
`bypassFilters` entries and writes the rest. A future emitter that suppresses more
than rides the throw loses findings silently.

**Why it was needed:** without it a preset at module scope emitted its findings and
then threw, and the CLI reported the same violations again off the throw — measured
at 13 blocks for 7 findings, under a summary claiming one
([bug 0203](../work/bugs/fixed/0203-a-preset-at-module-scope-prints-its-findings-twice.md)).
No CLI-side filter could reach the printed copy either, so `--baseline` and
`--changed` did not apply to it
([bug 0199](../work/bugs/fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)).

**Scope, stated because it bounds the claim:** this is a `eess-ts` mechanism. The
kernel's `finishPreset` has no such flag and neither does the kernel's own
`executeCheck`, which still emits unconditionally — recorded as knowingly divergent
and owned by [plan 0188](../work/plans/0188-unify-the-duplicated-engine-modules.md).

### Amendment 2026-09-03 — the emitters take evidence (ADR-014)

[ADR-014](./014-the-emitter-refuses-a-verdict-without-evidence.md), accepted
2026-09-03, supersedes three statements above at the two emitters:

- _"Preset return type is `ArchViolation[]`"_ — a preset, and `finishPreset`,
  hand back the receipt `{ violations, examined }` that every terminal already
  produces. The violations are still there, one field deeper.
- _"`throwIfViolations` is retained … for compatibility"_ — removed. An alias
  that still takes a bare array is the hole ADR-014 closes, under another name.
- _"Existing call sites are unaffected … the option is additive"_ (Consequences)
  — true of this ADR's own change, and not of ADR-014's: every emitter call
  changes, and the changeset names every dependent.

The principle is untouched: a check detects, the caller decides how and whether
to emit, and `reportViolations` still never throws on violations and never
filters them. What narrows is what a caller may hand over — a value that says
what was examined — and what widens is what comes back.

**Decided, not yet enforced.** Until [plan 0235](../work/plans/0235-the-emitter-takes-a-receipt.md)
lands, the code still matches the Decision as written above and the Enforcement
rows below still describe it; this amendment records the ruling, and the plan
turns it into the seam.

## Consequences

- Embedders own reporting: no double render, and preset violations can be
  emitted as `--format json` like rule violations.
- One emission code path, format-aware, shared by checks and presets.
- Existing call sites are unaffected (default behavior unchanged); the option is
  additive.
- Mild surface growth: three new kernel exports (`reportViolations`,
  `finishPreset`, and the option types).

## Enforcement

Most test citations below are by file + case name in prose, not the `it(…)`
form: `check:crossval` (the AST title resolver) scans only the eess-ts project,
while those tests live in `@nielspeter/eess` (`packages/core`). `check:corpus`
verifies the files exist, and the cases run in `npm test` (the gate). Widening
`check:crossval` to resolve citations across every package is a separate
follow-on (plan 0070 Out of scope).

**One row is different and deliberately uses the `it(…)` form** — "Default
preset behavior unchanged". Its clause is about the **dialect's** preset surface,
so its mechanism lives in `packages/ts`, which `check:crossval` DOES scan; the
citation is therefore machine-resolved rather than merely existing. That row
previously cited a `packages/core` test covering the kernel's `finishPreset`
default — a different path — and stayed green while the clause was violated in
the dialect for an entire release cycle
([bug 0189](../work/bugs/fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md)).
Where a clause can be resolved, resolving it is strictly better than asserting
the file exists.

| Clause                                                                                | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Status |
| ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| One emitter shared by both paths                                                      | 1    | `executeCheck` and `finishPreset` both call `reportViolations` — `packages/core/src/report.ts`, `packages/core/src/execute-rule.ts`, `packages/core/src/preset-dispatch.ts`                                                                                                                                                                                                                                                                                                                                                                      | gated  |
| Presets return violations, don't force emission                                       | 2    | `packages/core/tests/report.test.ts` — the `report: return` case (returns violations, no stderr/stdout write)                                                                                                                                                                                                                                                                                                                                                                                                                                    | gated  |
| Default preset behavior for a caller that has not declared aggregation: emit + throw  | 2    | `packages/ts/tests/presets/the-default-enforces.test.ts` · `it('the shape the docs teach — a bare call, result discarded — THROWS')` — the DIALECT's preset surface, which is what this clause is about; `packages/core/tests/report.test.ts` covers the kernel's `finishPreset` default separately                                                                                                                                                                                                                                              | gated  |
| Under a run-level aggregating caller: throw WITHOUT emit, violations riding the throw | 2    | `packages/ts/tests/cli/preset-double-print.test.ts` · `it('reports each finding once, not twice')` — the preset emits nothing of its own and the CLI reports once; `packages/ts/tests/cli/aggregation-is-scoped.test.ts` · `it('a direct preset call still reports after the CLI has run in the same process')` pins the scope so suppression cannot leak past the run                                                                                                                                                                           | gated  |
| Suppress exactly what rides the throw — `checkAll`                                    | 2    | `packages/ts/tests/cli/checkall-warn-survives-aggregation.test.ts` · `it('still reports warn-severity findings, which ride no throw')` — the throw carries only the error-severity subset, so the warn findings must still be written; sabotage (suppress everything) reds it                                                                                                                                                                                                                                                                    | gated  |
| Suppress exactly what rides the throw — `executeWarn`                                 | 2    | `packages/ts/tests/cli/warn-terminal-emit-is-counted.test.ts` · `it('is counted as emitted, so the unfiltered-output notice fires')` — its positive anchor requires the advisory subset to reach stderr, so over-suppressing reds it. **This clause was previously cited against a test in another file, (`packages/ts/tests/cli/rule-file-truncation.test.ts`), whose fixture leaks through the kernel preset path and never exercises `executeWarn` — measured margin 0, a `gated` row over a mechanism blind to the site its own cell named** | gated  |
| Suppress exactly what rides the throw — `executeCheck`, `deliver()`                   | 2    | Vacuous as stated for these two: their throws carry EVERYTHING, so "findings that ride no throw" is empty by construction and a fixture written to that spec would match zero elements. The proposition with content here is _nothing is written twice_ — `packages/ts/tests/cli/preset-double-print.test.ts` · `it('reports each finding once, not twice')`                                                                                                                                                                                     | gated  |
| Caller owns format — presets can emit JSON                                            | 2    | `packages/core/tests/report.test.ts` — the `format: json` case (writes JSON to stdout)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | gated  |
| Violations returned to the caller carry the rule's own metadata                       | 2    | `packages/core/tests/execute-rule.test.ts` — the "stamps ruleId, because, suggestion and docs" case, and the "stamps every violation, not just the first" case (bug 0122)                                                                                                                                                                                                                                                                                                                                                                        | gated  |
| A condition's per-element value is never replaced by the rule's                       | 2    | `packages/core/tests/execute-rule.test.ts` — the "never overwrites a value the condition computed" case (inverting the guard passed the whole suite before this, bug 0122)                                                                                                                                                                                                                                                                                                                                                                       | gated  |
