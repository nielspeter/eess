# Bug 0224: the `recommended` floor misses concise arrows and function expressions

## Status

- **State:** Draft — measured 2026-08-23; fix not built.
- **Priority:** High — `recommended` is the preset every adopter installs, described in
  `scripts/check-baseline.mjs` as "the universal safety floor every consumer gets, applied to
  us". Two ordinary TypeScript shapes pass straight through it, and this repo's own
  `check:baseline` is green over them today.
- **Origin:** self-found — auditing every `check:*` script by planting a real violation of its
  stated subject. Twelve reded correctly; this one did not.

## Symptom

Measured against `npm run check:baseline`, each shape appended to a real source file in
`packages/core/src/` and reverted between runs:

| shape                                        | result    |
| -------------------------------------------- | --------- |
| `function a() { return eval("1") }`          | **red**   |
| `const a = () => { return eval("1") }`       | **red**   |
| `const a = () => eval("1")`                  | **green** |
| `const a = function () { return eval("1") }` | **green** |
| `class A { m() { return eval("1") } }`       | **red**   |

So it is not arrow functions — `collectFunctions` (`packages/ts/src/models/arch-function.ts:198-200`)
gathers `VariableDeclaration`s with an `ArrowFunction` initializer, and the block-bodied arrow
reds. What passes is:

1. an arrow with a **concise body** (`() => eval(…)`, no braces), and
2. a **function expression** (`function () { … }` assigned to a variable), which
   `collectFunctions` does not collect at all — it looks for `SyntaxKind.ArrowFunction`
   specifically.

## Repro

```bash
printf '\nexport const probe = () => eval("1")\n' >> packages/core/src/violation.ts
npm run check:baseline   # → exit 0, "4 floor rules across 245 source files · 0 violations"
git checkout -- packages/core/src/violation.ts
```

## Root cause — two, and only one is obvious

**Function expressions** are a collection gap: `collectFunctions` handles
`FunctionDeclaration`, `VariableDeclaration` + `ArrowFunction`, and class methods. A
`VariableDeclaration` whose initializer is a `FunctionExpression` matches none of them.

**Concise arrow bodies** are a body-analysis gap: the collection succeeds (the arrow is
found) but the condition inspects statements, and `() => eval("1")` has an expression body
with no statement list. This is why the block-bodied arrow reds and the concise one does not
— same element, different body shape.

Not to be confused with [bug 0161](./0161-smell-detectors-silently-miss-object-literal-functions.md),
which is a third gap in the same family: `collectFunctions` also skips object-literal
functions unless `includeObjectLiteralFunctions` is passed. Three shapes, one theme —
**"what counts as a function" is answered differently in three places**, and each answer is
missing something.

## Why the harness did not catch it

`scripts/check-nonvacuity.mjs`'s baseline fixture plants
`export function probe() { return eval('1 + 1') }` — a function declaration. It proves the
rule fires for **one** shape and says nothing about the rest. Measured: with a concise-arrow
`eval` sitting in `packages/core/src`, `check:baseline` exits 0 **and** the harness prints
`baseline — OK (fails on violating input)` and `55 fixtures each fired on their violating
input — no fixture is silently green`.

That is the finding behind the finding: a non-vacuity fixture proves a rule can fire, never
that it fires on everything it claims to cover.

## Fix

1. Collect `FunctionExpression` initializers alongside `ArrowFunction` in `collectFunctions`.
2. Make the body-analysis conditions read a concise arrow body as the single expression it is,
   rather than an empty statement list.
3. Fixture **per shape**, not per rule. The five rows in the table above are the test matrix,
   and they should be a committed fixture so a future collector change cannot silently drop one.

Whether the same two shapes are missed by the other three floor rules — and by the
`agentGuardrails` / `strictBoundaries` presets — is unmeasured and part of the fix.

## Verification

- [ ] Red first: all five shapes in the Symptom table red for `no-eval`.
- [ ] The same matrix run against every rule in `recommended`, with the results recorded here.
- [ ] A committed fixture covering the matrix, so the harness stops proving one shape.
