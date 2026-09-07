---
'@nielspeter/eess-ts': minor
'@nielspeter/eess': patch
---

**Breaking (@nielspeter/eess-ts):** `eess-ts check`, `eess-ts check --fix`, `eess-ts baseline` and `checkAll()` now fail on a builder that hands back a bare array instead of a receipt — a behavioural break, not a signature one

ADR-014 requires every emitter to refuse a verdict it has no evidence for. Four doors in this
package did not: `runCheck` and `runBaseline` built their reports by pushing
`attributeToRuleFile(builder.violations(), …)` into a plain array, and `runFix` and `checkAll`
aggregated with `flatMap`. All four drop the `examined` count that `violations()` returns, so none
reached the evidence gate.

Measured before this change, over a rule file containing `export default [{ violations: () => [] }]`:
`eess-ts check` reported `"total": 0`, `"examined": null`, **exit 0**; `eess-ts baseline` wrote a
baseline file and exited 0; `eess-ts check --fix` exited 0; and `checkAll()` returned silently.

The three CLI doors now run the gate **per builder**, where the rule file is known, so the finding
names the file it came from — and three dead builders in one file are three findings, not one.

**`--fix` refuses before it writes.** A fix is an edit derived from a verdict, so a refused verdict
refuses every edit computed from it. Measured before this change, `eess-ts check --fix --apply` over
an evidence-free builder **rewrote the target file** while the same run reported the finding and
exited 1. It now reports and writes nothing. `checkAll` merges its builders' receipts with `mergeCollectResults`
(fail-closed per member, so one dead builder among many is named rather than absorbed) and consults
the same gate. A builder with no receipt is `emitter/no-receipt`; one that ran and examined nothing,
with no declaration, is `emitter/pass-without-evidence`. Both findings are unsuppressable and set the
exit code.

**`eess-ts baseline` refuses rather than accepting.** A baseline is a persisted verdict, so a
builder that certified nothing must not contribute to one. The command still writes the entries it
_could_ accept, prints the refused finding with its rule file, and exits 1 — the behaviour it
already had for other unsuppressable findings.

**`checkAll([])` now throws**, with a message written for that door: guard the array —
`if (rules.length > 0) checkAll(rules)` — or pass the rules you meant to check. There is no
declaration form at this door, and the finding no longer offers one: a preset that legitimately
produces no rules declares that where it is built, not here.

**`eess-ts doctor` is unchanged, and that is a gap rather than a decision.** A diagnostic returns no
verdict, so it is outside this clause. But measured against this same probe it prints `No rules that
cannot enforce anything.` and exits 0 — the command whose stated job is reporting rules that cannot
enforce anything. That is bug 0268 — filed, not excused. A sibling dialect's door is bug 0269.

**One door stays open, stated rather than implied:** the exported `collectViolations` helper is
typed to accept a bare array and documented as not throwing, so calling it with `generateBaseline`
by hand still bypasses the gate. Closing that is a public-API decision rather than a wiring one, and
it is not made here.

**The kernel's `dedupeConfigFindings` no longer collapses emitter findings.** It keys on `(rule file,
rule id, offending glob)`, and an emitter finding carries `element: ruleId` and `file: ''` — it points
at a verdict, not at a place in code — so every occurrence in a run shared one key and merged, with a
note claiming they were "one edit". Three hand-rolled builders are three edits in three places.
`keyFor` now returns no key for the four ids in `emitter-findings.ts`. Everything else is unchanged:
preset fan-out still collapses, and so does a rule with a real narrowing and no glob to name.

**What breaks.** A rule file or test that hands any of these doors a hand-rolled builder — an object with
a `violations()` that returns a plain array — used to pass and now fails. That is the point: it was
certifying nothing. **What to do:** return `collectResult(violations, { examined })` from your
builder (`import { collectResult } from '@nielspeter/eess-ts'` — no second install), or declare a legitimately empty result with `declaredEmpty: true`. A builder produced by
this package's own fluent API already carries its receipt and is unaffected; every rule file in this
repository passes unchanged.
