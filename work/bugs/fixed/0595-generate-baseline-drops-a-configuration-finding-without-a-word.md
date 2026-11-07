# Bug 0595: `generateBaseline` drops a configuration finding without a word

## Status

- **State:** Fixed — 2026-11-07, on `fix/config-findings-not-lost`. Measured first at `bd78b962`; the Symptom's code pointers are as at that commit.
- **Severity:** High — a false green: a run whose rule's instrument is broken writes an empty
  baseline and reports success, and the next `check --baseline` has nothing to say it was broken.
- **Origin:** self-found · [proposal 011](../../proposals/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01, which found this is the real silent drop behind its ask C.
- **Reported:** 2026-11-01
- **Part of:** [proposal 011](../../proposals/011-core-name-the-evidence-gate.md)'s ask C, which is held; this record owns one of its cases

## Symptom

`generateBaseline` (`packages/core/src/baseline.ts:198`) leaves out every finding that carries
`bypassFilters` (`:208`). The comment says why: a configuration finding "can never legitimately
become known, pre-existing debt". Leaving it out of the file is right. Saying nothing is not: the
run writes a baseline as if the rules had passed.

## Reproduction

`generateBaseline` over one `emitter/pass-without-evidence` finding with `bypassFilters: true`,
against `packages/core/dist`, 0.04 s:

```text
{ threw: false, stderrWrites: 0, entries: 0, count: 0 }
```

## Root cause

The filter that keeps configuration findings out of the baseline has no other branch: what it
removes is neither reported nor refused.

## Fix

`generateBaseline` refuses, throwing, when the violations it is given hold a `bypassFilters`
finding, naming each one, so a broken instrument stops the baseline from being written. Built with
[bug 0586](./0586-the-kernels-collect-violations-swallows-a-configuration-error.md), the other
half of the same path: `collectViolations` swallows the configuration error before
`generateBaseline` sees it.

**Fixed 2026-11-07, not as this record's Fix first said.** `generateBaseline`
(`packages/core/src/baseline.ts`) writes the baseline for every finding it can accept, then throws an
`ArchRuleError` naming each configuration finding it left out. The Fix above said to refuse and write
nothing. The build followed the family's precedent instead: `eess-ts baseline` writes what can be
accepted, prints what it refused and exits 1 (`packages/ts/src/cli/commands/baseline.ts`). Both are
fail-closed; the precedent keeps the two doors alike. eess-ts's own `generateBaseline` is unchanged:
its command already says what it refused.

Built together with [bug 0577](./0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md) and [bug 0586](./0586-the-kernels-collect-violations-swallows-a-configuration-error.md), one root:
a configuration finding lost on a kernel path that does not throw.

## Verification

- [x] done-otherwise — _criterion as written: "the reproduction throws, naming the finding, and writes no file"._ Red test written first: the reproduction throws, naming the finding, and writes the file for the finding it can accept (`packages/core/tests/configuration-findings-not-lost.test.ts`), per the precedent in the Fix.
- [x] A baseline over ordinary findings is written as today, and nothing is thrown.
- [x] A changeset naming `@nielspeter/eess`, marked breaking: a caller observes it. Marked `**Breaking**`, kernel `minor` with the five dialects named at `minor` (`.changeset/configuration-findings-not-lost.md`): unlike [bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)'s refusal, which only an untyped call could reach, each change here is observable to a typed caller whose run was green.
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

Deferred: none. Found and recorded: [bug 0638](../0638-eess-ts-generate-baseline-drops-a-configuration-finding-without-a-word.md).
