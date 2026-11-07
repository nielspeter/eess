# Bug 0595: `generateBaseline` drops a configuration finding without a word

## Status

- **State:** Fixed — 2026-11-07, on `fix/config-findings-not-lost` (b35229fa).
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

Built together with [bug 0577](./0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md),
[bug 0586](./0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and
[bug 0595](./0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), one root:
a configuration finding lost on a kernel path that does not throw.

## Verification

- [x] done-otherwise — red test written first: the reproduction throws, naming the finding, and writes the file for the finding it can accept (`packages/core/tests/configuration-findings-not-lost.test.ts`), per the precedent in the Fix.
- [x] A baseline over ordinary findings is written as today, and nothing is thrown.
- [x] A changeset naming `@nielspeter/eess`, marked breaking: a caller observes it. Marked `**Breaking**`, kernel `minor` with the five dialects named at `minor` (`.changeset/configuration-findings-not-lost.md`): unlike [bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)'s refusal, which only an untyped call could reach, each change here is observable to a typed caller whose run was green.
- [x] done-otherwise — `npm run validate` is CI's since [spike 0631](../../spikes/0631-where-ci-time-goes.md): this PR's CI runs the same chain, and it merges only green. Locally: typecheck, lint, format, `check:arch`, `check:family`, `check:vacuity`, `check:docs-code`, `check:release` and `check:corpus` green (100 s); the core suite 436 of 436, and crossvalidate 148, mermaid 173, gherkin 13 and md 1,266, with eess-ts's 20 tests that use `report: 'warn'` (36 s).

      The sabotage matrix, run 2026-11-07 on b35229fa in a worktree with its own install and build
      (12 s), the kernel rebuilt after each mutant, against
      `packages/core/tests/configuration-findings-not-lost.test.ts` and
      `packages/crossvalidate/tests/preset-warn-configuration-finding.test.ts` (25 s). The restored
      tree red 0 before and after; every mutant red:

      | mutant | core tests red | crossvalidate tests red |
      | --- | --- | --- |
      | 0577: `warn` throws only the emitter's findings (the old door) | 1 | 1 |
      | 0586: a non-`ArchRuleError` swallowed | 2 | 0 |
      | 0586: identity instead of structure (`instanceof`) | 1 | 0 |
      | 0595: `generateBaseline` leaves them out silently | 1 | 0 |

      _The first run's 0577 mutant did not apply: its text was written before prettier joined the
      line. Rerun against the formatted text, it went red._

Deferred: none
