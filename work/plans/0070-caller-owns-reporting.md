# Plan 0070: Caller Owns Reporting — split detection from emission

## Status

- **State:** Ready — floor frozen 2026-07-13. The open decision is resolved:
  **contract (a), non-breaking.** Presets gain an optional `{ report?:
'throw' | 'return' | 'warn', format? }` and change return type `void →
ArchViolation[]` (safe — existing callers ignore it; default `'throw'` keeps
  today's behavior). Two kernel primitives: `reportViolations(violations,
{format,reason})` (the single emitter, no throw) and `finishPreset(violations,
opts)` (emit-per-mode + throw-or-return). `throwIfViolations` and
  `executeCheck` are reimplemented on top of `reportViolations` (behavior
  unchanged). The CLI-swallow question is **sidestepped**: default `'throw'`
  still prints, so no CLI catch-and-format change is needed — callers opt into
  `'return'` to own emission.
- **Priority:** P2 — highest-leverage usability fix; a soft prerequisite to
  publishing eess (a new consumer hits this on day one)
- **Effort:** Phase 1 ≈ 1 session; Phase 2 ≈ 1 session; Phase 3 ≈ 0.5 session
- **Created:** 2026-07-13

## Problem

A usability review of the plan-0069 gates (running the presets on a real
consumer corpus, then owning the reporting in a custom harness) surfaced one
sharp, confirmed design flaw: **the library reports as an unavoidable side
effect, so a caller can never own emission.**

Root cause, located at the source — `packages/core/src/preset-dispatch.ts:74`:

```ts
export function throwIfViolations(violations: ArchViolation[]): void {
  if (violations.length > 0) {
    process.stderr.write(formatViolations(violations) + '\n') // ← always prints
    throw new ArchRuleError(violations) // ← then throws
  }
}
```

Every preset routes through this — `adrEnforcement`, `honestyAtClose`,
`scenarioCitationsResolve`, `tableErAgree`, and the eess-ts preset family
(`boundaries`, `data-layer`, `layered`). `throwIfViolations` conflates three
responsibilities — **detect → format → control-flow** — with three consequences:

1. **Double render.** A caller that catches `ArchRuleError` and formats it (a
   custom harness, or eess's own `check-corpus.mjs` / `check-crossval.mjs` /
   `check-ledger.mjs`) gets the library's stderr block _and_ its own output.
   The dogfood scripts have this latent today; it only hides because they're
   usually green.
2. **Format-blind presets.** The good, format-aware path is `executeCheck`
   (`execute-rule.ts`), used by `.check()` — it honours `--format json/github`,
   baseline, and diff filters. `throwIfViolations` hardcodes stderr text, so a
   preset **cannot emit `--format json`** even though `.check()` rules can. The
   two reporting paths have diverged.
3. **Throw-only.** Presets offer no non-throwing path, forcing a caller to
   `try/catch` for violations and hack `.slice(0, 0)` to "count but don't
   list." Warn-first is a headline adoption story, yet presets have no
   first-class report/warn mode (only `dispatchRule`'s per-rule `console.warn`).

The fix is one idea applied three times: **separate detection from reporting;
the caller owns emission.** This also unifies the two divergent paths
(`throwIfViolations` vs `executeCheck`) onto one format-aware reporter.

There is **no ADR governing reporting** today, so the convention this
establishes is itself a binding decision worth recording (Phase 1).

## Implementation phases

### Phase 1 — ADR-008 + one format-aware reporter (kernel)

Author **ADR-008: Detection is separate from reporting; the caller owns
emission.** Then collapse the two paths onto a single reporter that both
`executeCheck` and the preset path delegate to:

```ts
// one place that knows how to emit — text (stderr) / json / github, error / warn
export function reportViolations(
  violations: ArchViolation[],
  options?: ReportOptions, // { format?, reason?, stream? }
): void
```

`throwIfViolations` (and `executeCheck`) stop printing unconditionally; emission
happens only when a caller asks for it. The CLI already _swallows_
`ArchRuleError` (`cli/index.ts:114`, `watch.ts:75`) on the assumption the check
already printed — so this phase must make the CLI (and the dogfood scripts)
format **once**, on catch, through `reportViolations`.

**Files changed:** `packages/core/src/preset-dispatch.ts`,
`packages/core/src/execute-rule.ts`, a new `report.ts` (or fold into `format`),
`packages/ts/src/cli/*`, `adr/008-*.md` + the CLAUDE.md ADR-index row, tests.

### Phase 2 — the preset return contract (the open decision)

Give presets a non-throwing path so a caller owns control-flow too. **This is
the decision the freeze must resolve** — two candidate shapes:

- **(a) Options param (backward-compatible).** Presets keep returning `void` and
  throwing by default, but gain `honestyAtClose(c, { report: 'throw' | 'return'
| 'warn', format? })`. `'return'` yields `ArchViolation[]` and prints nothing.
  Non-breaking; every existing call keeps working.
- **(b) Return violations (breaking, cleaner).** Presets return
  `ArchViolation[]`; a thin `assertClean(violations)` throws. Composes better
  but changes every preset's signature and every dogfood call site.

**Frozen: (a).** Non-breaking, and `{ report: 'return' }` directly retires the
`collect()` wrapper and the `.slice(0, 0)` count-only hack from the 0069 harness.
Concrete shape:

```ts
export type ReportMode = 'throw' | 'return' | 'warn' // default 'throw'
export function finishPreset(v: ArchViolation[], o?: PresetReportOptions): ArchViolation[]
// preset options extend PresetReportOptions; preset returns finishPreset(v, o)
```

**Files changed:** every preset (`md/src/rules/{adr,ledger}.ts`,
`crossvalidate/src/md-{mermaid,mermaid-er,gherkin}.ts`, `ts/src/presets/*`),
their tests.

### Phase 3 — thread format through the dogfood scripts

With Phase 1–2 in place: make `check:corpus` / `check:crossval` / `check:ledger`
own their reporting via `reportViolations` (killing the latent double-print),
and thread `--format json/github` so preset-sourced violations become
machine-readable like rule-sourced ones — closing the format-blind gap for real,
proven by piping one script to `--format json`.

**Files changed:** `scripts/check-*.mjs`, a non-vacuity note.

## Out of scope

- **Fix-hints on parse errors** (the review's #2 — "did you mean `}o--o{`").
  Real, but the infra already exists (`ArchViolation.suggestion`, the `ArchFix`
  autofix model from plan 0066); wiring it onto the Langium/format parse-error
  path is a focused **follow-on plan**, not this one.
- **Registry publish / distribution** — a consequence of the go-public
  decision, not a reporting-boundary concern.
- **Changing the violation _format_ itself** — this plan moves _where_ emission
  happens, not what a violation looks like.

## Success definition

- No caller double-prints: a harness that catches `ArchRuleError` and formats
  gets exactly its own output; the dogfood scripts render each violation once
  (proven by a test that asserts a preset does not write to stderr on its own).
- A preset can emit `--format json` — `check:corpus --format json` produces
  machine-readable output for ADR/ledger violations, not just rule violations.
- A caller can get violations without a throw and without printing —
  `{ report: 'return' }` (or the frozen equivalent) retires `collect()` /
  `.slice(0, 0)`.
- ADR-008 records the convention; `npm run validate` stays green throughout.

## Progress ledger

- [ ] Phase 1 — ADR-008 + `reportViolations`; CLI/scripts format on catch
- [ ] Phase 2 — preset return contract (shape frozen at ready)
- [ ] Phase 3 — format threaded through the dogfood scripts

Deferred: none — Ready; ledger goes live during the build.
