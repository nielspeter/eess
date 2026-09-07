---
'@nielspeter/eess-ts': minor
---

**Breaking (behavioural):** `eess-ts check` and `checkAll()` now fail on a builder that hands back a bare array instead of a receipt

ADR-014 requires every emitter to refuse a verdict it has no evidence for. Two doors in this
package did not: `runCheck` built its report by pushing `attributeToRuleFile(builder.violations(), …)`
into a plain array, and `checkAll` aggregated with `flatMap`. Both drop the `examined` count that
`violations()` returns, so neither reached the evidence gate.

Measured before this change: a rule file containing `export default [{ violations: () => [] }]`
ran through `eess-ts check` to `"total": 0`, `"examined": null`, **exit 0**, and the same builder
through `checkAll()` returned silently.

Both now route their aggregation through the kernel's one merge (`mergeCollectResults`, fail-closed
per member) and consult the gate under `report: 'return'`. A builder with no receipt is
`emitter/no-receipt`; one that ran and examined nothing, with no declaration, is
`emitter/pass-without-evidence`. Both findings are unsuppressable and set the exit code.

**What breaks.** A rule file or test that hands either door a hand-rolled builder — an object with
a `violations()` that returns a plain array — used to pass and now fails. That is the point: it was
certifying nothing. **What to do:** return `collectResult(violations, { examined })` from your
builder, or declare a legitimately empty result with `declaredEmpty: true`. A builder produced by
this package's own fluent API already carries its receipt and is unaffected; every rule file in this
repository passes unchanged.
