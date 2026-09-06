---
'@nielspeter/eess-ts': minor
---

**New rule:** `preset/agent/no-verdict-outside-rules` on `agentGuardrails`,
behind `noVerdictOutsideRules` (default **off**).

A module that is not a rule file, a test, or a file you name in the companion
`ruleFiles` option must not import eess as a value — only `import type` — and
must not call `finishPreset` / `reportViolations` / `throwIfViolations`.

**Why.** A consuming project shipped four corpus gates as hand-rolled loops,
importing eess's types and its printer and never a `RuleBuilder`. Three went
inert in one week and each printed green. `ADR-014` makes an evidence-free
verdict unrepresentable at every seam eess owns, and names honestly what it
cannot reach: a caller who sums receipts by hand, and one who never calls an
emitter at all. This rule is what reaches those two.

**The flag defaults off, so the upgrade is silent** — no adopter reds on
install. A dogfooder running every flag must add this one. Turn it off again
with `overrides: { 'preset/agent/no-verdict-outside-rules': 'off' }`.

**Expect a first red on your own preset modules.** A module that builds rules
imports `dispatchRule` at runtime, so it trips this rule until you name it in
`ruleFiles` — correct, because a preset module is a verdict file by definition.

`ruleFiles` **extends** the default `['**/*.rules.ts', '**/*.test.ts', '**/*.spec.ts']`
rather than replacing it, and an entry matching no file is reported as
`preset/agent/rule-files-matches-nothing` so the list cannot rot in silence.

**What it does not reach**, stated because an unstated ceiling reads as
coverage: nothing inside a rule file, no `.mjs` script outside your `tsconfig`,
and no equivalent for adopters without `eess-ts` — there is no AST engine to
build one on, and for them the kernel contract is the whole protection.
