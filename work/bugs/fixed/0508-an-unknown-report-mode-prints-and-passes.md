# Bug 0508: an unknown `report` mode prints the violations and passes

## Status

- **State:** Fixed — 2026-10-19, on branch `fix/fail-open-batch` (with bugs 0499 and 0506's
  crossvalidate half, and plan 0481). Recorded 2026-10-19; reproduced on main (7ef7a1d).
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
- ~~Nothing in eess-md, eess-mermaid or eess-crossvalidate reads a mode.~~ Corrected 2026-10-19
  (PR #251's verify review): eess-md reads one through `honestyAtClose`
  (`packages/md/src/rules/ledger.ts:907`, `:966`) and `adrEnforcement`
  (`packages/md/src/rules/adr.ts:147`), and eess-crossvalidate through its bindings, each handing
  its options to `finishPreset`. The kernel refusal covers them all, and this bug's own reproduction
  is the md preset. The changeset names both packages. eess-mermaid reads no mode.

## Fix

Refuse a mode that is not one of `ReportMode`'s three values with `ArchConfigError` in
`finishPreset`, naming the value and the three accepted ones. The refusal runs before
`if (mode === 'return')` (`:265`), or `'retrun'` slips through, and accepts `undefined` and `null`,
which `??` turns into the default.

## Resolution

`finishPreset` reads the mode through `readReportMode` (`packages/core/src/report.ts`), once, before
any comparison. `undefined` and `null` are `'throw'`; `'throw'`, `'return'` and `'warn'` pass
through; anything else throws `ArchConfigError` (subject `report`) naming the value and the three
modes. eess-ts's `deliver` needed no change: it handles `'builders'` and hands every other value to
`finishPreset`, including on its aggregating branch, where only `'throw'` is diverted.

Decided in the build, against the record:

- **Not flagged as a break.** The refusal reds only a run whose `report` value is outside the
  published `ReportMode` type, and that run was printing real violations above a zero exit. Bug
  0284's refusal was flagged because it refused values its type admitted; this one admits nothing
  new and refuses nothing typed. The changeset is a patch for `eess` and `eess-ts`.
- **eess-ts refuses first, with all four modes** (review fix). The kernel's message lists its three
  modes, so an eess-ts caller who misspelt `'builders'` was told to choose among modes that did not
  include the one they meant. `deliver` (`packages/ts/src/presets/shared.ts`) now refuses a value
  outside `PresetDelivery` before it compares `'builders'`, naming `'throw'`, `'return'`, `'warn'`,
  `'builders'`. The kernel keeps its own refusal for every other caller, and takes no hint about a
  dialect's extra modes.
- **One reader of a mode** (PR #251's verify review). The first fix gave eess-ts a hand-written
  copy of the kernel's check, with its own list of modes. `readReportMode(value, extraModes)` is now
  the kernel's one reader, on `@nielspeter/eess/internal`; `finishPreset` calls it with no extras,
  and eess-ts's `deliver` calls it with `['builders']`, so the refusal lists every mode the door
  accepts and nobody keeps a second list.
- **eess-crossvalidate is named in the changeset** (review fix): its bindings finish through
  `finishPreset`, so its JavaScript callers get the refusal too.
- **Non-string values are shown by type** (`a value of type object`), not stringified: a lint rule
  (`no-base-to-string`) rejects `String(value)` on an unknown, and `[object Object]` would say less.

## Verification

- [x] red test first: `finishPreset(v, { report: 'thorw' })` with one violation throws `ArchConfigError` naming `'thorw'` — `packages/core/tests/report.test.ts`, failed on the unfixed code ("expected function to throw an error, but it didn't")
- [x] `'retrun'` and `false` refused; `undefined` and `null` still mean `'throw'` — same file, the first failed before the fix, the second passed before and after
- [x] eess-ts's `deliver` with `report: 'thorw'` refuses, run through `eess-ts check` so the exit code is measured — `packages/ts/tests/cli/unknown-report-mode.test.ts` drives `runCheck` over `tests/fixtures/rule-files/unknown-report-mode.rules.ts`; before the fix `runCheck` returned 0
- [x] sabotage: the refusal removed turns the test red
- [ ] validation-owed: `npm run validate` and CI green on PR #251 (they run after this record is
      written; the result is reported on the PR, and CI is the gate)

Sabotage matrix (rows 1-2: mutant applied to `packages/core/src/report.ts`, core rebuilt, then
restored; row 3: mutant in `packages/ts/src/presets/shared.ts`, since replaced by row 4's reader; rows 4-5:
`packages/core/src/report.ts`, core rebuilt). Row 1 was re-run after eess-ts
began refusing first: it now reds the two kernel tests only, since `deliver` refuses before the
kernel is reached; before that change it also redded `fails eess-ts check and names the mode`.

| row | mutant                                                                                              | red                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `const mode: ReportMode = options.report ?? 'throw'` (no refusal)                                   | `refuses an unknown report mode instead of printing and passing`, `refuses retrun and false before the return comparison`                                                                            |
| 2   | `null` no longer read as the default                                                                | `reads an undefined or null report mode as throw`                                                                                                                                                    |
| 3   | eess-ts's `refuseUnknownDelivery` call removed (the kernel's three-mode message reaches the caller) | `fails eess-ts check and names the mode`                                                                                                                                                             |
| 4   | `readReportMode` leaves `extraModes` out of the refusal's list                                      | `accepts a dialect's extra mode and lists it in the refusal`, `fails eess-ts check and names the mode`                                                                                               |
| 5   | `readReportMode` stops accepting an extra mode                                                      | `accepts a dialect's extra mode and lists it in the refusal`, and every eess-ts preset test that runs with `report: 'builders'` (`strictBoundaries reports it`, `layeredArchitecture reports it`, …) |

Deferred: none
