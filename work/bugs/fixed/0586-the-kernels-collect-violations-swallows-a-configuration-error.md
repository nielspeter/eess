# Bug 0586: the kernel's `collectViolations` swallows a configuration error

## Status

- **State:** Fixed — 2026-11-07, on `fix/config-findings-not-lost`. Measured first at `bd78b962`; the Symptom's code pointers are as at that commit.
- **Severity:** High — a false green: a rule that refused to run gives 0 violations and no throw,
  and the documented next step writes a baseline with `count: 0` over it.
- **Origin:** self-found · [proposal 011](../../proposals/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01 (all three lenses); reproduced before filing.
- **Reported:** 2026-11-01
- **Part of:** [proposal 011](../../proposals/011-core-name-the-evidence-gate.md)'s ask C, which is held; this record owns one of its cases

## Symptom

The kernel's `collectViolations` (`packages/core/src/baseline-generator.ts:26`, on the root at
`packages/core/src/index.ts:89`) calls each builder's `check()` and catches what it throws. It keeps
the error only when `error instanceof ArchRuleError` (`packages/core/src/baseline-generator.ts:33`)
and drops everything else without a word. Three kinds of throw are lost:

- An `ArchConfigError`, which does not extend `ArchRuleError` (`packages/core/src/errors.ts:9`,
  `:83`). That is the error the family throws when a rule is misconfigured, such as the refusal of
  an unknown report mode ([bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)).
- Any other error, such as a `TypeError` from a bug in the rule.
- An `ArchRuleError` from a second copy of the kernel. `instanceof` is an identity check, and the
  kernel's own structural test `isArchRuleError` (`packages/core/src/errors.ts:50`) exists for
  exactly that case (`packages/core/src/errors.ts:30`). Here real violations are dropped.

The docstring says the helper "bypasses the evidence gate"
(`packages/core/src/baseline-generator.ts:10`). It says nothing about the swallow. That is an
[ADR-009](../../../adr/009-agent-first-failure-surfaces.md) fake green, separate from the gate bypass
that [proposal 011](../../proposals/011-core-name-the-evidence-gate.md) ask C is about.

## Reproduction

Throwaway scripts against `packages/core/dist` (built 2026-11-01 08:56; the last commit touching
`packages/core/src` is 2026-10-30, so the build matches the source), on Node 24.22.0.

The first script builds two builders. One ends its `check()` in
`finishPreset(collectResult([], { examined: 3 }), { report: 'retrun' })`, the call every preset
ends in, with a misspelt mode. The other reads a property of `undefined`. It calls each directly,
then through `collectViolations`, then hands the result to `generateBaseline`, as the helper's own
`@example` does. 0.04 s.

```text
direct check(): ArchConfigError - report: 'retrun' is not a report mode; the modes are 'throw', 'return', 'warn'. An unknown mode used to print the violations and pass.
direct check(): TypeError - Cannot read properties of undefined (reading 'rules')
collectViolations(misconfigured, broken): [] | threw: false
baseline written: baseline-0586.json | count: 0 | violations: []
```

The second script copies `packages/core/dist` to a second directory and throws that copy's
`ArchRuleError`, carrying one real violation, from a `check()`. 0.06 s.

```text
isArchRuleError(error from the second copy): true
collectViolations(builder throwing the second copy's ArchRuleError): 0 violations
```

The kernel's own guard calls the error an `ArchRuleError`. The helper drops its violation.

## Root cause

The `catch` keeps one class, by identity, and has no `else`
(`packages/core/src/baseline-generator.ts:33`). An error that is not that class object is neither
harvested nor rethrown.

## Fix

Harvest with `isArchRuleError` and rethrow every other error. A configuration error then fails the
call that generates the baseline, as it fails `check()`, and a second kernel copy's violations are
kept. The docstring keeps its gate-bypass caveat, which is
[proposal 011](../../proposals/011-core-name-the-evidence-gate.md) ask C's to close, and stops
describing the helper as harvesting everything a rule throws.

Out of scope here: `generateBaseline` silently drops `bypassFilters` findings
(`packages/core/src/baseline.ts:208`), and eess-ts's own `collectViolations`. Both belong to
[proposal 011](../../proposals/011-core-name-the-evidence-gate.md) ask C.

**Fixed 2026-11-07.** `collectViolations` (`packages/core/src/baseline-generator.ts`) harvests
with `isArchRuleError` and rethrows every other error, as this record's Fix says; its docstring says
so. eess-ts's own `collectViolations` is unchanged, as this record scoped it.

Built together with [bug 0577](./0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md) and [bug 0595](./0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), one root:
a configuration finding lost on a kernel path that does not throw.

## Verification

- [x] Red test written first: `collectViolations` over a builder whose `check()` throws
      `ArchConfigError` rethrows it (`packages/core/tests/configuration-findings-not-lost.test.ts`).
- [x] A builder throwing a `TypeError` rethrows it.
- [x] An `ArchRuleError` from a second kernel copy is harvested, not dropped: a structural one, an `Error` named `ArchRuleError` with `violations`, as a second copy's is.
- [x] An ordinary `ArchRuleError` is still harvested, and a passing builder still adds nothing.
- [x] A changeset naming `@nielspeter/eess` (_criterion as written: whether it is `**Breaking**` decided against [bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)'s precedent_). Marked `**Breaking**`, kernel `minor` with the five dialects named at `minor` (`.changeset/configuration-findings-not-lost.md`): unlike [bug 0508](./0508-an-unknown-report-mode-prints-and-passes.md)'s refusal, which only an untyped call could reach, each change here is observable to a typed caller whose run was green.
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

Deferred: none
