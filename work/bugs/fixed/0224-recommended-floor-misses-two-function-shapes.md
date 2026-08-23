# Bug 0224: the `recommended` floor misses concise arrows and function expressions

## Status

- **State:** Fixed — red test first, both causes fixed, all five shapes verified through the
  real gate. `Deferred: none`.
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

Not to be confused with [bug 0161](../0161-smell-detectors-silently-miss-object-literal-functions.md),
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

## Fix — built

**Two causes, two changes, and they are not the same kind of defect.**

1. **Traversal** (`packages/ts/src/helpers/body-traversal.ts`). Both match paths walk
   `descendantsOfKind` / `allDescendants` — **descendants only**. A concise arrow's
   `getBody()` returns the `CallExpression` _as_ the body, so the node that matters was never
   tested. `searchFunctionBody` now also tests the body root, **but only when it is not a
   `Block`**: testing a `Block` root is the over-match the file already warns about, where
   `expression(/…/)` matches a function's entire body text and turns every body-analysis rule
   into a whole-declaration one.

2. **Collection** (`packages/ts/src/models/arch-function.ts`). A `VariableDeclaration` whose
   initializer is a `FunctionExpression` was collected by nothing. `fromArrowVariableDeclaration`
   is now `fromFunctionInitializerDeclaration` and handles both; the old name is kept as a
   `@deprecated` alias because it is exported from `index.ts` and removing it would be a
   break.

**Verified through the real gate**, not just the unit test — the same sabotage matrix that
found the bug, appended to `packages/core/src/violation.ts` and reverted between runs:

| shape                                        | before | after |
| -------------------------------------------- | ------ | ----- |
| `function a() { return eval("1") }`          | red    | red   |
| `const a = () => { return eval("1") }`       | red    | red   |
| `const a = () => eval("1")`                  | green  | red   |
| `const a = function () { return eval("1") }` | green  | red   |
| `class A { m() { return eval("1") } }`       | red    | red   |

Clean source still exits 0.

**Not fixed here, and named rather than left implicit:** whether the other three `recommended`
rules and the `agentGuardrails` / `strictBoundaries` presets miss the same shapes. The
traversal fix is shared, so they very likely improve too — but "likely" is not measured, and
this record does not claim it.

## Verification

- [x] **Red first.** `packages/ts/tests/rules/no-eval-function-shapes.test.ts` was written
      before either fix and failed on exactly two rows — the concise arrow and the function
      expression — with the other three green. That is the bug, captured before any source
      changed.
- [x] All five shapes red through `npm run check:baseline` itself, and clean source still
      exits 0.
- [x] **A test per shape, not per rule.** The matrix is the committed fixture, so a future
      collector or traversal change cannot silently drop a shape the way this one did.
- [x] No regressions: `packages/ts` was **12 files / 17 tests failing before and after**
      (those failures are pre-existing on `main`), and the pass count moved 3423 → 3429 —
      exactly the six new tests.
- [ ] The same matrix against the other floor rules and the two other presets —
      `dropped-on-purpose` here, and stated in the Fix section as unmeasured rather than
      assumed.
