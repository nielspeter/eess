# Bug 0508: an unknown `report` mode prints the violations and passes

## Status

- **State:** Draft — recorded 2026-10-19; reproduced on main (7ef7a1d), no red test yet.
- **Severity:** High — a JavaScript caller (this repository's own `scripts/*.mjs` are JavaScript) that
  misspells the mode gets a green exit over real violations. The violations are printed, so a person
  reading the log may notice; an agent reading the exit code will not (ADR-009).
- **Origin:** self-found · noticed while reproducing bug 0507 (`honestyAtClose(c, { report: false })`
  printed its violations), confirmed with a misspelt mode
- **Reported:** 2026-10-19

## Symptom

`finishPreset` reads `options.report ?? 'throw'` and then compares the mode against `'return'` and
`'throw'` only (`packages/core/src/report.ts:250`, `:262`, `:276`). Any other value, `false`, `'thorw'`,
`'retrun'`, falls through both comparisons: the violations are emitted, nothing is thrown, and the
caller's process exits 0. `ReportMode` (`packages/core/src/report.ts:24`) is `'throw' | 'return' |
'warn'`, so TypeScript rejects these values; a JavaScript caller, or a value read from config or the
environment, gets no such check.

## Reproduction

On main's build (7ef7a1d), a corpus holding one closed plan with an open box:

```js
const c = corpus({ cwd, roots: ['work/**/*.md'] })
const r = honestyAtClose(c, { report: 'thorw' })
```

prints `Architecture Violation [1 of 1] … ledger/silent-open-box`, returns 1 violation, and the
process exits 0. `report: false` behaves the same.

## Fix

Refuse a mode that is not one of `ReportMode`'s three values with `ArchConfigError`, at every door
that reads it (`finishPreset`, `reportViolations` if it reads a mode, and the dialects' preset
options), naming the value and the three accepted ones. A test per door, red first on main.

## Verification

- [ ] red test first: `finishPreset(v, { report: 'thorw' })` with one violation throws `ArchConfigError` naming `'thorw'`
- [ ] every door that reads a report mode refuses an unknown one
- [ ] sabotage: the refusal removed turns the test red
