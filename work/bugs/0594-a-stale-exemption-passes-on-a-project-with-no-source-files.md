# Bug 0594: a stale exemption passes on a project with no source files

## Status

- **State:** Draft — measured 2026-11-01 on `main` at bd78b962; no red test yet.
- **Severity:** High — a false green: `scenarioExemptionsCurrent` exists to report an exemption that
  a test now covers, and over a project that loads no test file it passes, with no declaration.
- **Origin:** self-found · PR #290's method review, which found that the records for
  [proposal 014](../proposals/014-crossvalidate-tests-in-any-language.md)'s review left it with no
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
'return', isExempt: (s) => s.tags.includes('@wip') })`, against `packages/*/dist`, 0.17 s:

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

## Verification

- [ ] Red test written first: the reproduction's empty project gives a finding naming the empty
      test side, not a pass.
- [ ] The project whose test cites the exempt scenario still reports the stale exemption.
- [ ] A changeset naming `@nielspeter/eess-crossvalidate`.
- [ ] `npm run validate` green.

Deferred: none
