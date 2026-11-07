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

- [x] done-otherwise — written after the fix, red under the matrix's mutants: the empty project
      gives a finding, not a pass, beside the exemptions it counted. It is the generic
      `emitter/source-empty`, which names the kinds of empty source, not this one's tsconfig:
      [bug 0641](../0641-the-empty-source-finding-names-no-source.md).
- [x] The project whose test cites the exempt scenario still reports the stale exemption (`packages/crossvalidate/tests/gherkin-ts.test.ts`, "fires when an exempt scenario already has a citing test", unchanged and green).
- [x] A changeset naming `@nielspeter/eess-crossvalidate` (`.changeset/an-input-side-loaded-nothing.md`).
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

Deferred: none. Found and recorded: [bug 0641](../0641-the-empty-source-finding-names-no-source.md).
