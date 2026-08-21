# Bug 0201: `executeCheck` prints unconditionally, so a caller cannot filter what it emits

## Status

- **State:** Fixed — `executeCheck` now honours `callerAggregatesReports`, exactly
  as `executeWarn` always has. Measured: a `.check()` at module scope leaked 4
  already-accepted violations before, and 0 after. **Rewritten once** before that:
  the first version blamed jiti module registries and was wrong; see "What this
  record used to say".
- **Deferred:** [0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md)
  — the kernel half, which no dialect flag can reach
- **Found:** 2026-08-21, while fixing [bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md).
  Re-diagnosed the same day by the enforcement review of PR #74.

## Symptom

`packages/ts/src/core/execute-rule.ts` — `executeCheck` writes its report and
then throws:

```ts
if (filtered.length > 0) {
  const stamped = stampSeverity(filtered, 'error')
  writeReport(stamped, options?.format, ctx.reason) // ← unconditional
  throw new ArchRuleError(stamped, ctx.reason)
}
```

The write has no guard. A `.check()` evaluated at module scope therefore prints its
findings **before any caller can see them** — so a caller aggregating a run cannot
suppress, filter, or re-order that output.

`eess-ts check` is exactly such a caller. It sets `setCallerAggregatesReports(true)`
so rule files stay quiet and the CLI reports once. **That flag does not apply here:**
it is read at exactly one site, `packages/ts/src/core/execute-rule.ts`, inside
`executeWarn`. `executeCheck` never consults it.

## Consequences

1. **`--baseline` does not apply to what a self-executing rule file prints.** The
   measured symptom of [bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md):
   a project whose baseline matched **5 of 5** violations still showed two of them
   as failures, because the rule file printed them itself. 0199 ships a notice
   saying so; this record is the repair.
2. **`--changed` (diff-aware) leaks the same way** — a self-executing terminal
   passes no `options.diff`, so the printed set is unfiltered by the diff. Not
   separately measured.
3. **Comment suppression does NOT leak**, and the first version of this record was
   wrong to say it did. `isExcludedByComment` runs inside `applyFilters` at
   `packages/ts/src/core/execute-rule.ts`, i.e. **before** `writeReport`, so
   `// eess-exclude` does apply to a rule file's own printing. What can go missing
   is the run-level _tally_ — `recordCommentSuppression` at `:306` feeding
   `commentSuppressionNotice()` — which is a different defect and is not filed.

## What this record used to say, and why that is kept

**Version 1 blamed jiti.** It claimed `setCallerAggregatesReports` is module state
that does not cross jiti's registry, so the rule file holds a second copy with the
flag `false`. Three disproofs:

- The flag is read only by `executeWarn`; `executeCheck` never reads it, so no
  amount of making it cross registries would silence a `.check()`.
- **jiti is not the default loader.** `packages/ts/src/cli/import-rule-module.ts`
  imports natively first and reaches jiti only on a module-format refusal
  (a `"type": "commonjs"` consumer — bug 0074).
- Measured under one shared module graph, no jiti: the rule file printed anyway.

It matters because that version proposed three fixes and **two of them could not
have worked** — a `globalThis` singleton and threading the flag through the loader
both make the flag cross registries, which changes nothing at a site that does not
read it. Only the third (let the caller own invocation) pointed anywhere useful, and
for a different reason than was given.

## A second, separable defect this exposed

**No `bypassFilters` configuration finding can be registered in
`scripts/check-nonvacuity.mjs` at all.** `firedOn` (`scripts/check-nonvacuity.mjs:293-299`)
keys strictly on `v.ruleId`, and configuration findings carry no `ruleId` — so the
only way to register one is to key on its prose, which
[bug 0110](./0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)
specifically forbade.

That is why none of the ~16 producers in `packages/ts/src/cli/rule-file-findings.ts`
and its siblings appears in that harness, and why
[bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md)
disposed its registration box as `dropped-on-purpose` rather than owed. The family's
accountability lives in the census's `verified` claim instead.

Worth its own record if anyone wants these gate-level rather than suite-level; noted
here because this is where it was found, and because a fix that gave configuration
findings a stable `ruleId` would unblock all of them at once.

## Fix — the dialect half, one line

`packages/ts/src/core/execute-rule.ts`:

```ts
if (callerAggregatesReports) {
  checkWritesSuppressed++
} else {
  writeReport(stamped, options?.format, ctx.reason)
}
throw new ArchRuleError(stamped, ctx.reason)
```

The same guard `executeWarn` has had since it shipped. **Safe for every other
caller because the flag defaults to `false` and only the CLI sets it** — a
`.check()` in a test file, where there is no aggregator, prints exactly as before.
The violations are not lost when it stays quiet: they ride the throw, which is the
same reason `executeWarn` may suppress only its `bypassFilters` entries.

The counter is not decoration. Once `.check()` stopped leaking, the
`baselineNotApplied` notice became **reachable and wrong** on that path — it fired
on a run where nothing leaked, which is a claim constructed from a default
(ADR-010). `suppressedCheckWrites()` lets the CLI read a per-file delta and tell
the two throws apart: a `.check()` we silenced (no notice owed) from a preset's
throw, which emits through the kernel and never reaches this function.

**This fix made the two engine copies diverge, and that is recorded rather than
discovered later.** `packages/core/src/execute-rule.ts` has its own `executeCheck`
which still calls `reportViolations` unconditionally, under a comment reading "One
emitter for both paths". Before this change the two had identical emission
semantics. Latent today — [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md)
measured that no aggregating caller drives the kernel copy — but it is the second
such divergence in two days, and it is exactly what
[plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md) was raised to
High for. Both the kernel copy and `packages/ts/src/core/check-all.ts` are named in
[bug 0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md).

**The preset half is NOT fixed and is filed as
[bug 0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md).**
`finishPreset` emits unconditionally. Measured after this fix, same run: the
`.check()` path leaks nothing, the preset path still leaks — and its worst symptom
turns out to be a **double print with no flags involved at all**, which this record
did not anticipate.

**The reasoning first written here was wrong** and is corrected in 0203: it said no
dialect flag could reach the preset path, so the kernel needed a new mode. Measured
since — `deliver()` in `packages/ts/src/presets/shared.ts` is ts code, is the single
site all five presets finish through, and honouring the flag there takes the fixture
from 8 leaked blocks to 2. No kernel change required.

### The options as originally stated

1. **Make `executeCheck` honour `callerAggregatesReports`**, as `executeWarn`
   already does. Smallest change. But it alters when a terminal emits for **every**
   caller, and `.check()` printing is relied on in test files, where there is no
   aggregator — so the flag's default must stay "print".
2. **Give the terminal an explicit report mode** rather than a module-level flag,
   so the decision travels with the call. Closest to ADR-008's "caller owns
   reporting", largest change.
3. **Have the CLI refuse to load self-executing rule files at all** and require the
   array export. Most drastic; would break existing rule files that work today.

Option 1 is the obvious first move and its risk is bounded — `executeWarn` is the
working precedent for exactly this split.

## Verification

- [x] Red test first — `packages/ts/tests/cli/rule-file-truncation.test.ts`,
      `it('no longer prints its own findings, so no notice is owed')`. Verified by
      sabotage: reverting `executeCheck` to write unconditionally reds it.
- [x] The leak is measured, not asserted: 6 violation blocks before (four of them
      already accepted in the baseline), 2 after — both the CLI's own configuration
      findings. The test asserts `parseFooOrder` never reaches stderr AND that the
      baseline suppressed all four, so the absence cannot be a rule that matched
      nothing.
- [x] `.check()` in a **test file** still prints. By construction: the flag
      defaults to `false` and only `runCheck` sets it. The whole suite — 3547 tests
      across 263 files — is green, and it is full of `.check()` calls that depend
      on today's behaviour.
- [x] `--changed` covered: the notice is gated on any CLI-side filter, not just
      `--baseline`, after an adopter measured a self-contradicting transcript on
      that path. `it('fires for --changed too, not only --baseline')`.
- [x] Comment suppression confirmed unaffected — `isExcludedByComment` runs inside
      `applyFilters` **before** `writeReport`, so exclusions do apply to a rule
      file's own printing. The run-level tally question is noted in the record and
      not filed; it is a different defect and n=0 evidence today.
- [x] The notice did NOT become unreachable, which is what the first version of
      this box predicted. It became reachable-and-wrong on the fixed path — worse —
      and is now gated on measured leakage. Its remaining live path is
      [bug 0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md);
      when that lands, the notice must be removed or its last path named (ADR-010).
- [x] `npm run validate` exits 0 — 3547 tests, 263 files.

Deferred: [0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md)
— the kernel half.
