# Bug 0577: a preset under `report: 'warn'` exits 0 on a configuration finding

## Status

- **State:** Fixed — 2026-11-07, on `fix/config-findings-not-lost`. Measured first at `bd78b962` (on [bug 0097](./0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  branch); the Symptom's code pointers are as at that commit.
- **Severity:** High — a false green: a finding that the rule's own text calls unsuppressable,
  such as an unmet `expectNonEmpty`, is printed and the run passes.
- **Origin:** self-found · [bug 0097](./0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  architect review, which found it by reading; reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

A builder's `.warn()` throws for every finding that carries `bypassFilters`
(`packages/core/src/execute-rule.ts:404`: "a config finding whose own text promises 'not by
.warn()' must still fail the build"). A preset's `report: 'warn'` goes through `finishPreset`,
which throws under warn only for the emitter's own five findings (`EMITTER_IDS`,
`packages/core/src/emitter-findings.ts:115`). Every other `bypassFilters` finding is printed and
the preset returns. The §5 comment in `finishPreset` (`packages/core/src/report.ts:319`) says
"an unsuppressable configuration finding printed above a zero exit is exactly the silent green
this ADR closes"; the code beneath it closes that case for the emitter's findings only.

## Reproduction

`adrCitationsResolve` over an ADR corpus whose `dir` matches nothing, with
`{ expectNonEmpty: true, report: 'warn' }`, on the fixtures in
`packages/crossvalidate/tests/fixtures/citations`: the finding is printed once to stderr and
nothing is thrown. The same options with `report: 'return'` hand back the
`crossval/adr-citations-resolve` finding, so the finding exists; only the warn path lets it pass.
The defect is in `finishPreset`, so it applies to every preset in the family.

## Fix

Not designed. The direction: under `report: 'warn'`, `finishPreset` fails on every finding
`severityFor(v, 'warn')` escalates, exactly as `executeWarn` does, so the two warn paths cannot
disagree.

**Fixed 2026-11-07.** Under `report: 'warn'`, `finishPreset` (`packages/core/src/report.ts`)
throws every finding `severityFor(v, 'warn')` escalates, the emitter's own findings among them, as
`executeWarn` does: one escalation rule for both warn doors. Ordinary violations are still printed
and returned. The docs that said `warn` never fails (`docs/presets.md`, `packages/ts/README.md`,
`packages/core/README.md`) now name the exception; `docs/tests-cannot-lie.md` already claimed it,
falsely until now.

Built together with [bug 0586](./0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and [bug 0595](./0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), one root:
a configuration finding lost on a kernel path that does not throw.

## Verification

- [x] Red test written first, through a real preset: `adrCitationsResolve` with an unmet `expectNonEmpty` under `report: 'warn'` throws the finding (`packages/crossvalidate/tests/preset-warn-configuration-finding.test.ts`; red before the fix, its `report: 'return'` control green).
- [x] An ordinary finding under `report: 'warn'` still prints and returns (`packages/core/tests/configuration-findings-not-lost.test.ts`), and only the configuration finding is thrown beside it.
- [x] The two warn paths share one escalation rule: `severityFor`, read by `executeWarn` and `finishPreset`.
- [x] A changeset naming `@nielspeter/eess`. Marked `**Breaking**`, kernel `minor` with the five dialects named at `minor` (`.changeset/configuration-findings-not-lost.md`): unlike [bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)'s refusal, which only an untyped call could reach, each change here is observable to a typed caller whose run was green.
- [x] done-otherwise — `npm run validate` is CI's since [spike 0631](../../spikes/0631-where-ci-time-goes.md): this PR's CI runs the same chain, and it merges only green. Locally: typecheck, lint, format, `check:arch`, `check:family`, `check:vacuity`, `check:docs-code`, `check:release` and `check:corpus` green (100 s); the core suite 436 of 436, and crossvalidate 148, mermaid 173, gherkin 13 and md 1,266, with eess-ts's 20 tests in the 5 files under `packages/ts/tests` that contain `report: 'warn'` (`npx vitest run $(grep -rln "report: 'warn'" tests)`, 36 s). Before the build review's fixes; after them the core suite is 437. CI is ruleset 26704592's required `test`, `nonvacuity` and `bun-load`.
- [x] The sabotage matrix, run 2026-11-07 on `fix/config-findings-not-lost`'s final code, after the build review, in a
      worktree with its own install and build (14 s), the kernel rebuilt after each mutant, against
      `packages/core/tests/configuration-findings-not-lost.test.ts` and
      `packages/crossvalidate/tests/preset-warn-configuration-finding.test.ts` (34 s). The restored
      tree red 0 before and after; every mutant red:

      | mutant | core tests red | crossvalidate tests red |
      | --- | --- | --- |
      | 0577: `warn` throws only the emitter's findings (the old door) | 1 | 1 |
      | 0577: the ordinary `warn` findings left unprinted (added at review) | 1 | 0 |
      | 0586: a non-`ArchRuleError` swallowed | 2 | 0 |
      | 0586: identity instead of structure (`instanceof`) | 1 | 0 |
      | 0595: `generateBaseline` leaves them out silently | 2 | 0 |
      | 0595: the refused findings thrown but not printed (added at review) | 2 | 0 |

      _The first run, before the review, had the four rows without "added at review"; its 0577
      mutant first did not apply, its text written before prettier joined the line. The review's
      enforcement lens found the second 0577 mutant surviving every test in the family: the warn
      test captured stderr and never read it._

- [x] The build review (2026-11-07, enforcement and method). Fixed from it: the `warn` test reads
      what was printed, so ordinary findings beside a configuration finding cannot vanish;
      `generateBaseline` prints each refused finding (file, rule id, message, `Fix:`) before it
      throws, as `eess-ts baseline` does; `finishPreset`'s escalation is `severityFor` alone, the one
      rule `executeWarn` reads (the emitter's findings carry `bypassFilters`); one composed test, a
      real builder that examined nothing, through `collectViolations` into `generateBaseline`; the
      docstrings (`collectViolations` no longer says it never throws; `generateBaseline` has its
      `@throws`, and says it overwrites the file); [ADR-008](../../../adr/008-caller-owns-reporting.md)'s 2026-11-07 amendment and its
      gated row; `docs/markdown.md` and eess-ts's preset JSDoc. Recorded, not fixed: [bug 0638](../0638-eess-ts-generate-baseline-drops-a-configuration-finding-without-a-word.md)
      (eess-ts's own `generateBaseline` drops them the same way), [bug 0639](../0639-the-docs-say-a-builders-warn-never-throws.md) (two docs say a builder's
      `.warn()` never throws), and [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)'s kernel half, which this fix made reachable (a
      `warn` preset inside `eess-ts check` prints its configuration finding twice; exit 1).

Deferred: none. Found and recorded: [bug 0639](../0639-the-docs-say-a-builders-warn-never-throws.md); [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md) updated.
