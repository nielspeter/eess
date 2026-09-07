---
'@nielspeter/eess-ts': minor
---

**Breaking (behavioural):** `eess-ts check`, `eess-ts baseline` and `checkAll()` now fail on a builder that hands back a bare array instead of a receipt

ADR-014 requires every emitter to refuse a verdict it has no evidence for. Three doors in this
package did not: `runCheck` and `runBaseline` built their reports by pushing
`attributeToRuleFile(builder.violations(), …)` into a plain array, and `checkAll` aggregated with
`flatMap`. All three drop the `examined` count that `violations()` returns, so none reached the
evidence gate.

Measured before this change, over a rule file containing `export default [{ violations: () => [] }]`:
`eess-ts check` reported `"total": 0`, `"examined": null`, **exit 0**; `eess-ts baseline` wrote a
baseline file and exited 0; and `checkAll()` returned silently.

The two CLI commands now run the gate **per builder**, where the rule file is known, so the finding
names the file it came from. `checkAll` merges its builders' receipts with `mergeCollectResults`
(fail-closed per member, so one dead builder among many is named rather than absorbed) and consults
the same gate. A builder with no receipt is `emitter/no-receipt`; one that ran and examined nothing,
with no declaration, is `emitter/pass-without-evidence`. Both findings are unsuppressable and set the
exit code.

**`eess-ts baseline` refuses rather than accepting.** A baseline is a persisted verdict, so a
builder that certified nothing must not contribute to one. The command still writes the entries it
_could_ accept, prints the refused finding with its rule file, and exits 1 — the behaviour it
already had for other unsuppressable findings.

**`checkAll([])` now throws.** An empty rule array examined nothing and declared nothing, so it is
the same case. If you spread a preset that can legitimately produce no rules, check the array before
calling, or declare the empty state.

**Not affected:** `eess-ts check --fix`, which returns before reaching a verdict, and `eess-ts
doctor`, which is a diagnostic that already reports rules unable to enforce anything.

**One door stays open, stated rather than implied:** the exported `collectViolations` helper is
typed to accept a bare array and documented as not throwing, so calling it with `generateBaseline`
by hand still bypasses the gate. Closing that is a public-API decision rather than a wiring one, and
it is not made here.

**What breaks.** A rule file or test that hands any of these doors a hand-rolled builder — an object with
a `violations()` that returns a plain array — used to pass and now fails. That is the point: it was
certifying nothing. **What to do:** return `collectResult(violations, { examined })` from your
builder, or declare a legitimately empty result with `declaredEmpty: true`. A builder produced by
this package's own fluent API already carries its receipt and is unaffected; every rule file in this
repository passes unchanged.
