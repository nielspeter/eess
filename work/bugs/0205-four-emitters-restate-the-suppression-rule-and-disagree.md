# Bug 0205: four emitters restate the suppression rule inline, and they disagree

## Status

- **State:** Draft — the rule already went wrong once at one of the four sites, and
  that instance shipped as a fake green before review caught it.
- **Deferred:** none
- **Found:** 2026-08-21, architecture review of PR #75.

## Symptom

[ADR-008's amendment](../../adr/008-caller-owns-reporting.md) states one invariant
for every emitter under a run-level aggregating caller:

> **Suppress exactly what rides the throw, and nothing else.**

Nothing enforces it. It is restated inline, in prose, at four sites — and they do
not agree:

| site                                                    | policy                                          |
| ------------------------------------------------------- | ----------------------------------------------- |
| `packages/ts/src/core/execute-rule.ts` — `executeCheck` | suppress everything                             |
| `packages/ts/src/core/execute-rule.ts` — `executeWarn`  | suppress only `bypassFilters`; write the rest   |
| `packages/ts/src/core/check-all.ts`                     | suppress only error-severity; write the rest    |
| `packages/ts/src/presets/shared.ts` — `deliver()`       | suppress everything, and only in `'throw'` mode |

Each is individually correct **today**, because each throws a different subset —
`executeCheck` throws everything, `executeWarn` throws only the configuration
findings, `checkAll` throws only error-severity, `deliver()` throws everything. The
divergence is not a bug in any one of them. The bug is that the rule connecting them
lives in four comments and is checked by nothing.

## This is not hypothetical — it already happened

`check-all.ts`'s guard was added in PR #75 suppressing **all** violations, exactly
like its two neighbours, while its throw carried only the error-severity subset. The
warn findings were written by nobody and carried by nothing: measured, four findings
produced and discarded under `✓ eess-ts — 4 rules across 1 file · 0 failing`,
exit 0.

The correct reasoning was already written, one file over, in `deliver()`'s comment
about `'warn'` — and it was not applied. Two reviewers found it independently; no
test did. The fix landed in the same PR, and the fixture that holds it had to be
written from scratch because the warn path through `checkAll` had no coverage at all.

**A fifth emitter added by the next author gets it wrong the same way**, and the
failure direction is silent: findings that exist nowhere, under a green tick with a
non-vacuous denominator.

## Fix

Not decided. The shape architecture review proposed, which reads right:

```ts
emitUnlessAggregated(violations, { format, reason, ridesTheThrow })
```

One ts-side helper owning the decision, with each caller supplying only the
predicate that says which of its violations the throw will carry. `executeWarn`
passes `(v) => v.bypassFilters === true`, `checkAll` passes
`(v) => (v.severity ?? 'error') === 'error'`, and `executeCheck` / `deliver()` pass
`() => true`.

Open questions before it is built:

- **`executeWarn`'s emit is not `writeReport`.** It has its own json/github/terminal
  branching that routes json to **stderr**, deliberately, so an aggregating caller's
  stdout document stays machine-clean. `writeReport` sends json to stdout. The
  helper has to preserve that difference or state why it may collapse.
- **`check-all.ts` carries extra payload** — the diff notice and `untestedRules()`.
- **Does the helper belong in the kernel?** The kernel's own `executeCheck` and
  `finishPreset` have the same shape and no flag to read (see
  [bug 0203](./fixed/0203-a-preset-at-module-scope-prints-its-findings-twice.md)),
  so a ts-side helper leaves them out. That is the right scope today and the wrong
  one the day [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)
  converges the copies.

## Verification

- [ ] Red test first: a fixture per emitter asserting that findings which ride **no**
      throw still reach the user under aggregation. `checkAll`'s exists
      (`checkall-warn-only.rules.ts`); the others do not.
- [ ] Sabotage: widening any one emitter's suppression to "everything" reds a test.
      Measured today — doing that to `check-all.ts` reds exactly one, and doing it
      to `executeWarn` is unmeasured.
- [ ] The invariant is stated in ONE place that the four sites reference, rather
      than four times in prose.
