# Bug 0207: a rule-level `.warn()` emits uncounted, so the leak notice stays silent

## Status

- **State:** Fixed — `executeWarn`'s advisory write is counted, and the docblock
  that claimed it already was is corrected.
- **Deferred:** none
- **Found:** 2026-08-22, architecture review of [bug 0205](../0205-four-emitters-restate-the-suppression-rule-and-disagree.md)'s
  design. Reviewing the _record_ found a live defect in the code it described.

## Symptom

A rule file with a live `.warn()` beside a throwing `.check()`, run under
`--baseline`:

```
warn findings printed : true      ← advisory violations reached the user unfiltered
notice fired          : false     ← the run said nothing about it
```

The `.warn()`'s advisory violations ride **no throw** — `executeWarn` puts only the
configuration findings on the error — so the CLI never collects them and no
CLI-side filter can reach them. That is precisely the case
[bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md)'s notice
exists for, and it did not fire.

## Root cause

`baselineNotApplied`'s trigger reads `violationsWritten() > writtenBefore` — a
delta over **emissions**, adopted in 0199 after counting _suppressions_ proved
unsound.

`executeWarn` does not go through `writeReport`. It has its own
json/github/terminal branching that writes via `writeStderr` /
`process.stdout.write`, deliberately, so a json run's stdout document stays the
aggregating caller's alone. Neither counter moved.

**And a docblock in the same file asserted the opposite**, listing `writeReport` as
_"used by `executeCheck`, `executeWarn` and `check-all.ts`"_. Measured:
`writeReport` has three call sites — `execute-rule.ts` (`executeCheck`),
`check-all.ts`, and `cli/commands/check.ts`. Not `executeWarn`.

## Why no test caught it

`packages/ts/tests/fixtures/rule-files/warn-leaks-under-changed.rules.ts` opened
with _"`executeWarn` writes its advisory violations directly, and it MUST"_ — and
contained **no `.warn()` terminal**. It leaks through
`recommended(p, { report: 'warn' })`, which finishes through the kernel's
`finishPreset` → `reportViolations`: a **different, already-counted** emitter.

So the fixture that appeared to cover this path covered something else, and its
docblock is what made the gap look closed. Corrected, and the real case now has its
own fixture.

## Fix

`executeWarn` increments the dialect's emission counter for its advisory write.
One line, at the site that does the emitting.

## The pattern this is the third instance of

0199 counted suppressions and read their absence as "nothing written" — unsound.
0203's first guard suppressed everything at a site whose throw carried a subset —
findings deleted. This one emits without counting. Each is the same shape: **an
emitter that does not honour the contract the others do, with nothing enforcing
that they agree.** That is [bug 0205](../0205-four-emitters-restate-the-suppression-rule-and-disagree.md),
which this instance is now recorded in.

## Verification

- [x] Red test first — `packages/ts/tests/cli/warn-terminal-emit-is-counted.test.ts`.
      Verified red: the advisory findings printed and the notice did not fire.
      Sabotage-verified: removing the increment reds it again.
- [x] The fixture asserts the leak is real (`parseFooOrder` reaches stderr) before
      asserting the notice, so it cannot pass on a run that emitted nothing.
- [x] The mis-documented sibling fixture now says which emitter it actually
      exercises.
- [x] The `writeReport` call-site list in `execute-rule.ts`'s docblock is corrected
      and names all three counted emitters.
- [x] `npm run validate` exits 0 — 3557 tests.
