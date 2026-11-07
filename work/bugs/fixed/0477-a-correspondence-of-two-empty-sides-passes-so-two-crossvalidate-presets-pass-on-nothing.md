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

## Verification

- [x] done-otherwise — red first by measurement, not a test: each preset over two empty inputs passed ([spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s probe, on `main` e651544e) and the matrix's `correspondence()` probe was `KNOWN_FAIL_OPEN`. The tests came after the fix; the matrix below restores each part of the defect and reds them.
- [x] Green: the join and each preset report the empty input (`packages/core/tests/correspondence-source-empty.test.ts`, `packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts`), and their three `KNOWN_FAIL_OPEN` entries are removed from `scripts/vacuity-matrix.mjs`; `check:vacuity` now classes each probe `config-finding`.
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
