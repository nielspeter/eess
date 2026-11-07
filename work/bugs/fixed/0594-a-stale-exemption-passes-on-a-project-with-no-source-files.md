# Bug 0594: a stale exemption passes on a project with no source files

## Status

- **State:** Fixed — 2026-11-07, on `fix/an-input-side-loaded-nothing`, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design. First
  measured as the Symptom says; its code pointers are as at that measurement.
- **Severity:** High — a false green: `scenarioExemptionsCurrent` exists to report an exemption that
  a test now covers, and over a project that loads no test file it passes, with no declaration.
- **Origin:** self-found · PR #290's method review, which found that the records for
  [proposal 014](../../proposals/014-crossvalidate-tests-in-any-language.md)'s review left it with no
  owner: [bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md)
  names it out of its scope.
- **Reported:** 2026-11-01

## Symptom

`scenarioExemptionsCurrent` (`packages/crossvalidate/src/gherkin-ts.ts:305`) reports an exempt
scenario that a test cites, since the exemption is then stale. Its receipt counts the exempt
scenarios as examined (`:335`), so over a project that loads no source file it has evidence and
passes: the test side it compares against was never read, and nothing says so.

## Reproduction

One feature file with an `@wip` scenario; two TypeScript projects, one with no source file and one
whose single test cites the scenario. `scenarioExemptionsCurrent(project, features, { report:
'return', isExempt: (s) => s.tags.includes('wip') })` (eess-gherkin stores a tag without its `@`), against
`packages/*/dist`, 0.17 s:

```text
-- empty 0 files
scenarioExemptionsCurrent isExempt @wip          examined 1 -> GREEN
-- cites 1 files
scenarioExemptionsCurrent isExempt @wip          examined 1 -> crossval/scenario-exemption-stale
```

The same scenario is stale when the test side is read and green when it is empty. No
`expectEmpty` is passed.

## Root cause

The receipt's `examined` counts the exempt scenarios, from the feature side, and nothing on it says
the test side loaded nothing. The siblings' fix in
[bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md),
setting `sourceEmpty`, does not fit here: beside `examined > 0` the kernel refuses it as
`emitter/contradictory-evidence`, which names the wrong remedy (measured there).

## Fix

Not designed. The direction: when the project loads no source file, the preset reports that the
test side is empty, as a finding of its own naming the project and its tsconfig, rather than judging
exemptions against nothing. Whether that finding is the preset's own or a kernel fact that does not
contradict `examined > 0` is the design question. Built beside
[bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md), which
touches the same receipts.

**Fixed 2026-11-07, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design.** A `Selection` carries `sourceEmpty: true` when the
source it was selected from loaded nothing; the kernel's and eess-ts's `select()` set it, and
`adrCitationsResolve` sets it on its two hand-built sides. `correspondence()` over such a side reports
the empty source once: under the rule when the join examined nothing, as `emitter/source-empty`
beside what it did examine. The gherkin↔ts presets merge an empty test side the same way. Two loaded
sides that select nothing still pass.

Built together with [bug 0477](./0477-a-correspondence-of-two-empty-sides-passes-so-two-crossvalidate-presets-pass-on-nothing.md) and [bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md), one root: a check whose input loaded nothing.

## Verification

- [x] done-otherwise — _criterion as written: "the reproduction's empty project gives a finding
      naming the empty test side, not a pass"_. Written after the fix, red under the matrix's mutants:
      the empty project gives a finding, not a pass, beside the exemptions it counted.
- [ ] deferred→[bug 0641](../0641-the-empty-source-finding-names-no-source.md) — the finding naming the empty test side: it is the generic
      `emitter/source-empty`, which names the kinds of empty source, not this one's tsconfig.
- [x] The project whose test cites the exempt scenario still reports the stale exemption (`packages/crossvalidate/tests/gherkin-ts.test.ts`, "fires when an exempt scenario already has a citing test", unchanged and green).
- [x] A changeset naming `@nielspeter/eess-crossvalidate` (`.changeset/an-input-side-loaded-nothing.md`).
- [x] The sabotage matrix, run 2026-11-07 on `fix/an-input-side-loaded-nothing`'s final code, after the build review, in a
      worktree with its own install (6 s) and build (7 s), the touched package rebuilt after each
      mutant, against `packages/core/tests/correspondence-source-empty.test.ts`,
      `packages/ts/tests/select-source-empty.test.ts` and
      `packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts` (70 s for the matrix). The
      restored tree red 0 before and after; every mutant red:

      | mutant | core | ts | crossvalidate |
      | --- | --- | --- | --- |
      | the join ignores the sides' fact | 3 | 0 | 3 |
      | the join reads only the right side (added at review) | 1 | 0 | 1 |
      | the join reports it twice (always merges) | 2 | 0 | 3 |
      | the kernel `select()` drops the fact | 4 | 0 | 0 |
      | eess-ts's `select()` drops the fact | 0 | 1 | 2 |
      | `adrCitationsResolve` stamps neither side | 0 | 0 | 2 |
      | `adrCitationsResolve` leaves its corpus side unstamped (added at review) | 0 | 0 | 1 |
      | the presets ignore an empty input (the shared helper) | 0 | 0 | 5 |
      | the fact stamped on the one receipt beside `examined > 0` (0594's dead end) | 0 | 0 | 2 |
      | `embeddedDiagramsMatchCode` reports it per diagram block (added at review) | 0 | 0 | 1 |

      _The first matrix (7 rows, before the review) was green-to-red too; the review's enforcement
      lens then found two mutants it missed, both fully green on every suite and on
      `check:vacuity`: the join reading only its right side, and `adrCitationsResolve` leaving its
      corpus side unstamped, the realistic adopter failure (a mistyped corpus root beside a project
      that loads). Its first run's kernel `select()` mutant did not apply (prettier had split the
      call). The tests were written after the fix, not before it: their red against the defect is
      the rows that restore each part of it._

- [x] The build review (2026-11-07, enforcement, product, method). Fixed from it: the left side and
      `adrCitationsResolve`'s corpus side pinned (two tests, two matrix rows); `embeddedDiagramsMatchCode`
      reports an empty project once, not once per diagram block; one helper owns "an input that
      loaded nothing, beside a receipt" (`withEmptySource`, `packages/crossvalidate/src/shared.ts`),
      and eess-ts's `select()` calls its existing `loadedNothing()`; the `Selection.sourceEmpty`
      JSDoc says which finding id an adopter sees; the changeset's migration line no longer promises a
      named input, and names `embeddedDiagramsMatchCode`; `Selection` documented in
      `packages/core/README.md`, the hand-built-selection recipes in `packages/md/README.md` and
      `docs/crossvalidate.md` carry `sourceEmpty` (the latter's `identify: (e) => e.identify(e)`,
      which was never valid code, corrected in the same snippet), `packages/crossvalidate/README.md`
      says `expectEmpty` does not excuse an empty input, and `docs/api-reference.md` types
      `sourceEmpty` as `true`. Recorded, not fixed: [bug 0642](../0642-other-doors-pass-over-an-input-that-loaded-nothing.md) (other doors that still pass over an
      empty input) and [bug 0641](../0641-the-empty-source-finding-names-no-source.md)'s additions.

- [x] done-otherwise — `npm run validate` is CI's since [spike 0631](../../spikes/0631-where-ci-time-goes.md) (ruleset 26704592 requires `test`, `nonvacuity` and `bun-load`): this PR merges only green. Locally: typecheck, lint, format, `check:arch`, `check:family`, `check:vacuity` (the three `KNOWN_FAIL_OPEN` entries removed, each probe now `config-finding`), `check:surface`, `check:docs-code`, `check:release` and `check:corpus` green; the suites, run as `npx vitest run` per package before the build review (38 s for all of them): core 441, crossvalidate 155, md 1,266, mermaid 173 and gherkin 13, with eess-ts's two test files that call `.select()` (its full suite is CI's). After the review's fixes: the touched test files green, core 442 and crossvalidate 159 by the same count. The vacuity matrix prints each probe `config-finding` with no `KNOWN_FAIL_OPEN` entry left; it calls each preset with no options, so it does not see the `expectEmpty` and exemption paths, which only the unit tests cover.

Deferred: 1 — [bug 0641](../0641-the-empty-source-finding-names-no-source.md).
