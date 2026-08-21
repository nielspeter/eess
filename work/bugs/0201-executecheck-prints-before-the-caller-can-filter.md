# Bug 0201: `executeCheck` prints unconditionally, so a caller cannot filter what it emits

## Status

- **State:** Draft — **rewritten 2026-08-21.** The first version of this record
  blamed jiti module registries and was wrong; see "What this record used to say".
- **Deferred:** none
- **Found:** 2026-08-21, while fixing [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md).
  Re-diagnosed the same day by the enforcement review of PR #74.

## Symptom

`packages/ts/src/core/execute-rule.ts:460` — `executeCheck` writes its report and
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
it is read at exactly one site, `packages/ts/src/core/execute-rule.ts:526`, inside
`executeWarn`. `executeCheck` never consults it.

## Consequences

1. **`--baseline` does not apply to what a self-executing rule file prints.** The
   measured symptom of [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md):
   a project whose baseline matched **5 of 5** violations still showed two of them
   as failures, because the rule file printed them itself. 0199 ships a notice
   saying so; this record is the repair.
2. **`--changed` (diff-aware) leaks the same way** — a self-executing terminal
   passes no `options.diff`, so the printed set is unfiltered by the diff. Not
   separately measured.
3. **Comment suppression does NOT leak**, and the first version of this record was
   wrong to say it did. `isExcludedByComment` runs inside `applyFilters` at
   `packages/ts/src/core/execute-rule.ts:303`, i.e. **before** `writeReport`, so
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
[bug 0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)
specifically forbade.

That is why none of the ~16 producers in `packages/ts/src/cli/rule-file-findings.ts`
and its siblings appears in that harness, and why
[bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)
disposed its registration box as `dropped-on-purpose` rather than owed. The family's
accountability lives in the census's `verified` claim instead.

Worth its own record if anyone wants these gate-level rather than suite-level; noted
here because this is where it was found, and because a fix that gave configuration
findings a stable `ruleId` would unblock all of them at once.

## Fix

Not decided, and it is an ADR-008 question rather than a patch.

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

- [ ] Red test first: a self-executing `.check()` rule file run under
      `eess-ts check` must not write its own report — asserted on the rule file's
      output, not the CLI's.
- [ ] `--changed` is measured for the same leak and the result recorded either way.
- [ ] Comment suppression is confirmed unaffected (it should be — see Consequence 3),
      and the run-level tally question is either fixed or filed.
- [ ] `.check()` in a **test file** still prints — that is the behaviour every
      existing consumer depends on and the reason this is not a one-line change.
- [ ] With the fix, [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)'s
      `baselineNotApplied` notice becomes unreachable **via the `.check()` path**.
      Decide then whether any path can still reach it; if none can, remove it rather
      than leave a rule that cannot fire (ADR-010).
