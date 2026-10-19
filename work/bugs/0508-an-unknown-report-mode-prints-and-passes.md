# Bug 0508: an unknown `report` mode prints the violations and passes

## Status

- **State:** Draft — recorded 2026-10-19; reproduced on main (7ef7a1d), no red test yet.
- **Severity:** High — a caller without TypeScript's check (a JavaScript rule file, or a mode read
  from config or the environment) that misspells the mode gets a green exit over real violations. The
  violations are printed, so a person reading the log may notice; an agent reading the exit code will
  not (ADR-009). Bug 0157 (a misspelt `overrides` key) set the precedent for this severity. No caller
  in this repository passes an unknown mode today: every `report:` in `scripts/` and `*.rules.ts` is
  a literal `'return'`, `'warn'`, `'throw'` or `'builders'` (grep, 2026-10-19).
- **Origin:** self-found · noticed while reproducing bug 0507 (filed on PR #247's branch), whose
  reproduction called `honestyAtClose(c, { report: false })` and printed its violations; confirmed
  with a misspelt mode. 0507's counts are unaffected: the return value is the same in every mode.
- **Reported:** 2026-10-19

## Symptom

`finishPreset` reads `options.report ?? 'throw'` (`packages/core/src/report.ts:250`) and compares the
mode against `'return'` (`:265`) and `'throw'` (`:281`) only. Any other value, `false`, `'thorw'`,
`'retrun'`, falls through both comparisons: the violations are emitted, nothing is thrown, and the
caller's process exits 0. `ReportMode` (`packages/core/src/report.ts:24`) is `'throw' | 'return' |
'warn'`, so TypeScript rejects these values; a caller without that check gets nothing.

## Reproduction

On main's build (7ef7a1d), a corpus holding one closed plan with an open box:

```js
const c = corpus({ cwd, roots: ['work/**/*.md'] })
const r = honestyAtClose(c, { report: 'thorw' })
```

prints `Architecture Violation [1 of 1] … ledger/silent-open-box`, returns 1 violation, and the
process exits 0. `report: false` behaves the same. Calling `finishPreset` directly with one violation
gives the same for `'thorw'`, `false` and `'retrun'`; `'throw'` throws `ArchRuleError` (PR #249's
review, measured).

## The doors

- `finishPreset` is the one place a mode is read. `reportViolations` takes `ReportOptions`, which has
  no `report` field, so it is not a door.
- eess-ts's `deliver` (`packages/ts/src/presets/shared.ts:449`) widens the type to
  `PresetDelivery = ReportMode | 'builders'`, handles `'builders'` itself and passes any other value
  through to `finishPreset`, so a refusal there covers it; it is pinned as a consumer.
- Nothing in eess-md, eess-mermaid or eess-crossvalidate reads a mode.

## Fix

Refuse a mode that is not one of `ReportMode`'s three values with `ArchConfigError` in
`finishPreset`, naming the value and the three accepted ones. The refusal runs before
`if (mode === 'return')` (`:265`), or `'retrun'` slips through, and accepts `undefined` and `null`,
which `??` turns into the default.

## Verification

- [ ] red test first: `finishPreset(v, { report: 'thorw' })` with one violation throws `ArchConfigError` naming `'thorw'`
- [ ] `'retrun'` and `false` refused; `undefined` and `null` still mean `'throw'`
- [ ] eess-ts's `deliver` with `report: 'thorw'` refuses, run through `eess-ts check` so the exit code is measured
- [ ] sabotage: the refusal removed turns the test red
