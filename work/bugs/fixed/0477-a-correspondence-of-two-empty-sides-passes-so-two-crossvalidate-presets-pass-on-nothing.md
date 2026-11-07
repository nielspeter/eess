# Bug 0477: a `correspondence()` of two empty sides passes, so two crossvalidate presets pass on nothing

## Status

- **State:** Fixed — 2026-11-07, on `fix/an-input-side-loaded-nothing`, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design. First
  measured as the Symptom says; its code pointers are as at that measurement.
- **Severity:** High — a silent pass. The kernel's `correspondence().beComplete()` over two empty
  selections passes, and so do the two presets that end in it: `diagramMatchesCode()` over an empty
  diagram and a zero-file project, and `adrCitationsResolve()` over an empty corpus and a zero-file
  project.
- **Origin:** self-found · [bug 0403](./0403-the-vacuity-matrix-probes-one-dialect-of-five.md)'s fix, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`correspondence().beComplete()` (`packages/core/src/correspondence.ts:109-116`) carries the
cardinality mark: "no element lacks a counterpart" is an absence assertion, and an absence assertion
over nothing is satisfied. When both sides of the join are empty, the join examines nothing and
passes. `diagramMatchesCode()` (`packages/crossvalidate/src/mermaid-ts.ts:47`) and
`adrCitationsResolve()` (`packages/crossvalidate/src/md-ts.ts:159`) end in that join, so a broken
input on both sides (an empty diagram, an unloaded project) is a green build.

The vacuity matrix carries `correspondence()` and both presets as `KNOWN_FAIL_OPEN` entries naming
this bug, expiring 2026-12-31. A fix that only makes the presets report an empty input leaves the
kernel's entry red, which is intended: the join itself is the defect.

## Fix

Not designed. Under [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3 an absence rule may legitimately match nothing, but "both sides
empty" is not the same claim as "no element lacks a counterpart": it means neither input loaded.
Candidates:

- a join whose two sides both select nothing is an empty source, reported as such;
- or each preset reports an empty input on either side.

Decide which against [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3 and [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md). `preserveRelations()` carries the same mark. Related
limits of the join: [bug 0400](./0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) and
[bug 0402](../0402-correspondence-checks-leak-between-rules-built-from-one-base.md).

**Fixed 2026-11-07, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design.** A `Selection` carries `sourceEmpty: true` when the
source it was selected from loaded nothing; the kernel's and eess-ts's `select()` set it, and
`adrCitationsResolve` sets it on its two hand-built sides. `correspondence()` over such a side reports
the empty source once: under the rule when the join examined nothing, as `emitter/source-empty`
beside what it did examine. The gherkin↔ts presets merge an empty test side the same way. Two loaded
sides that select nothing still pass.

Built together with [bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md) and [bug 0594](./0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md), one root: a check whose input loaded nothing.

`preserveRelations()`, which this record's Fix named as carrying the same mark, is covered by
construction: the join builds one receipt over its whole chain, so an empty-source side reds a
`preserveRelations()` check as it reds `beComplete()` (measured by the build review's enforcement
lens).

## Verification

- [x] done-otherwise — red first by measurement, not a test: each preset over two empty inputs passed ([spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s probe, on `main` e651544e) and the matrix's `correspondence()` probe was `KNOWN_FAIL_OPEN`. The tests came after the fix; the matrix below restores each part of the defect and reds them.
- [x] Green: the join and each preset report the empty input (`packages/core/tests/correspondence-source-empty.test.ts`, `packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts`), and their three `KNOWN_FAIL_OPEN` entries are removed from `scripts/vacuity-matrix.mjs`; `check:vacuity` now classes each probe `config-finding`.
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

Deferred: none
