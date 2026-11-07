# Bug 0584: `scenarioTestsResolve` with `expectEmpty: true` is green on a zero-file project

## Status

- **State:** Fixed — 2026-11-07, on `fix/an-input-side-loaded-nothing`, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design. First
  measured as the Symptom says; its code pointers are as at that measurement.
- **Severity:** High — a false green: a TypeScript project that loaded no source files, so no
  test could ever be read, passes once the caller declares `expectEmpty: true`. That is the
  precedence [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3 says no
  declaration may beat.
- **Origin:** self-found · [proposal 014](../../proposals/014-crossvalidate-tests-in-any-language.md)'s
  review (enforcement lens, Critical 2), which measured it in today's TS form and asked for a
  bug of its own, outside the proposal's scope.
  (That review's ruling is recorded with [proposal 014](../../proposals/014-crossvalidate-tests-in-any-language.md)'s amended text and plan, in their own PR;
  until then it lives in this record's reproduction.)
- **Reported:** 2026-11-01

## Symptom

[ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3: "Zero loaded source files is a
configuration finding under any declaration". eess-ts's own terminal honours it: a rule over a
zero-file project with `.expectEmpty()` reports "The project loaded 0 source files".

eess-crossvalidate's gherkin↔ts presets do not. `scenarioTestsResolve`
(`packages/crossvalidate/src/gherkin-ts.ts:130`) over a project whose tsconfig matches no file
reports `emitter/pass-without-evidence`. That finding's remedy offers `.expectEmpty()` among
others. Following it turns the run green, with `examined 0`. `scenariosCovered`
(`packages/crossvalidate/src/gherkin-ts.ts:246`) does the same when its `include` puts nothing in
scope. It has the same root cause and the same fix, so this bug covers both.

On a project that does load files, the same declaration behaves correctly: with citations present
it expires (`emitter/expired-declaration`), and with nothing in scope it is a legitimate
declaration over a loaded project. Only the zero-file case is wrong.

## Reproduction

Measured 2026-11-01 against `packages/{crossvalidate,gherkin,ts}/dist`, built 08:56 the same day.
No commit since then touches `gherkin-ts.ts`, `shared.ts`, core, gherkin or ts, so the build is
current. Fixture: one `features/credits.feature` with two scenarios, an `empty/tsconfig.json` whose
`include` (`src/**/*.ts`) matches no file, and a `cites/` project whose one spec file cites both
scenarios as `it('features/credits.feature › A credit is booked', …)`.

```js
const set = features({ cwd: FX, roots: ['features/**'] })
for (const d of ['empty', 'cites']) {
  const p = project(FX + '/' + d + '/tsconfig.json')
  show('scenarioTestsResolve', cv.scenarioTestsResolve(p, set, { report: 'return' }))
  show(
    'scenarioTestsResolve expectEmpty',
    cv.scenarioTestsResolve(p, set, { report: 'return', expectEmpty: true }),
  )
  show(
    'scenariosCovered include none, expectEmpty',
    cv.scenariosCovered(p, set, { report: 'return', include: () => false, expectEmpty: true }),
  )
}
```

Output (0.42 s wall time; long finding messages shortened with `…`):

```text
scenarios loaded: 2
-- empty: 0 source files
scenarioTestsResolve                       examined 0 sourceEmpty undefined declaredEmpty undefined -> emitter/pass-without-evidence: this verdict reports success over zero examined units: … Widen the selection, or — if the set is legitimately empty — declare it on the receipt: collectResult(violations, { examined, declaredEmpty: true }), or .expectEmpty() on a builder. …
scenarioTestsResolve expectEmpty           examined 0 sourceEmpty undefined declaredEmpty true -> GREEN
scenariosCovered include none, expectEmpty examined 0 sourceEmpty undefined declaredEmpty true -> GREEN
-- cites: 1 source files
scenarioTestsResolve                       examined 2 sourceEmpty undefined declaredEmpty undefined -> GREEN
scenarioTestsResolve expectEmpty           examined 2 sourceEmpty undefined declaredEmpty undefined -> emitter/expired-declaration: this verdict was declared empty but examined 2 unit(s) — the declaration has expired. …
scenariosCovered include none, expectEmpty examined 0 sourceEmpty undefined declaredEmpty true -> GREEN
default report (throw): returned, no throw
```

The last line is the default `report` mode on the zero-file project with `expectEmpty: true`:
nothing is thrown, so a rule file wiring the preset this way passes `check`.

For contrast, eess-ts's terminal on the same zero-file tsconfig (0.27 s):

```text
functions(p).should().beExported().expectEmpty().violations()
-> The project loaded 0 source files (…/empty/tsconfig.json) …
```

## Root cause

Both presets build their receipt as `collectResult(violations, { examined })`
(`packages/crossvalidate/src/gherkin-ts.ts:184`, `:267`). They never record whether the
project loaded any source files, so `sourceEmpty` stays `undefined`. `finishPreset` then sets
`declaredEmpty` from the caller's `expectEmpty` (`packages/core/src/report.ts:296`). The kernel's
precedence branch for an empty source (`packages/core/src/report.ts:174`) is already in place and
is checked before the declaration, but it reads `sourceEmpty`, which the preset never supplied.
Under [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md) the kernel takes the
emptiness fact and does not look at the project, so the dialect side must supply it. Here it does not.

## Fix

Not designed. The direction: the two presets pass the project's emptiness fact on the receipt,
`collectResult(violations, { examined, sourceEmpty: project.getSourceFiles().length === 0 })`, so
the kernel's existing branch fires. Measured on the same build, the kernel already does the right
thing with such a receipt (0.04 s):

```text
receipt {examined:0, sourceEmpty:true} + expectEmpty -> emitter/source-empty: this verdict reports success over a source that loaded zero units before any selection ran — an empty project, an unreadable config, or a glob resolving to nothing. This outranks any declaration: …
```

Whether `scenarioExemptionsCurrent` should get the same fact is out of scope. The review measured
its zero-file case as green without any declaration, because its `examined` counts exempt
scenarios, and as `emitter/expired-declaration` with one. That is a separate finding of the same
review (its enforcement lens's Critical 2), recorded as
[bug 0594](./0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md), not this bug. A `sourceEmpty`
beside `examined > 0` would also be refused as `emitter/contradictory-evidence`, which names the
wrong remedy for it.

**Fixed 2026-11-07, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design.** A `Selection` carries `sourceEmpty: true` when the
source it was selected from loaded nothing; the kernel's and eess-ts's `select()` set it, and
`adrCitationsResolve` sets it on its two hand-built sides. `correspondence()` over such a side reports
the empty source once: under the rule when the join examined nothing, as `emitter/source-empty`
beside what it did examine. The gherkin↔ts presets merge an empty test side the same way. Two loaded
sides that select nothing still pass.

Built together with [bug 0477](./0477-a-correspondence-of-two-empty-sides-passes-so-two-crossvalidate-presets-pass-on-nothing.md) and [bug 0594](./0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md), one root: a check whose input loaded nothing.

## Verification

- [x] done-otherwise — written after the fix, red under the matrix's mutants:
      `scenarioTestsResolve` over a zero-file project with `expectEmpty: true` reports
      `emitter/source-empty` under `report: 'return'`, and throws under the default mode
      (`packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts`).
- [x] `scenariosCovered` with `include: () => false` over a zero-file project with
      `expectEmpty: true` reports `emitter/source-empty`.
- [x] The same two calls over a project that loads a file keep today's behaviour: the
      declaration expires when citations exist, and passes when nothing is in scope (the CONTROL
      case in the same file).
- [x] done-otherwise — the sabotage row is "the gherkin↔ts presets ignore an empty project", which
      drops the fact from every receipt at once, 3 red; the receipts share one helper, so no row
      can drop it from one alone.
- [x] A changeset naming `@nielspeter/eess-crossvalidate` (`.changeset/an-input-side-loaded-nothing.md`, kernel `minor` marked `**Breaking**`, the five dialects named at `minor`).
- [x] The sabotage matrix, run 2026-11-07 on `fix/an-input-side-loaded-nothing`'s fix commit in a worktree with its own
      install and build (15 s), the touched package rebuilt after each mutant, against
      `packages/core/tests/correspondence-source-empty.test.ts`,
      `packages/ts/tests/select-source-empty.test.ts` and
      `packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts` (50 s). The restored tree red
      0 before and after; every mutant red:

      | mutant | core | ts | crossvalidate |
      | --- | --- | --- | --- |
      | the join ignores the sides' fact | 2 | 0 | 2 |
      | the join reports it twice (always merges) | 1 | 0 | 2 |
      | the kernel `select()` drops the fact | 3 | 0 | 0 |
      | eess-ts's `select()` drops the fact | 0 | 1 | 1 |
      | `adrCitationsResolve` stamps neither side | 0 | 0 | 1 |
      | the gherkin↔ts presets ignore an empty project | 0 | 0 | 3 |
      | the fact stamped on the one receipt beside `examined > 0` (0594's dead end) | 0 | 0 | 1 |

      _The kernel `select()` mutant first did not apply (its text was written before prettier split
      the call); rerun, it went red. The tests were written after the fix, not before it: their red
      against the defect is the matrix's rows that restore each part of it._

- [x] done-otherwise — `npm run validate` is CI's since [spike 0631](../../spikes/0631-where-ci-time-goes.md) (ruleset 26704592 requires `test`, `nonvacuity` and `bun-load`): this PR merges only green. Locally: typecheck, lint, format, `check:arch`, `check:family`, `check:vacuity` (the three `KNOWN_FAIL_OPEN` entries removed, each probe now `config-finding`), `check:surface`, `check:docs-code`, `check:release` and `check:corpus` green; core 441, crossvalidate 155, md 1,266, mermaid 173 and gherkin 13 green, with eess-ts's two test files that call `.select()` (38 s).

Deferred: none
