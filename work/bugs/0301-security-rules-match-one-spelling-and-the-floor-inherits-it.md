# Bug 0301: the `eval`, `Function` and `console` rules match one spelling, and the `recommended` floor inherits it

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green in the preset every adopter installs.**
  `recommended()` passes `Function('return 1')()`, which is the same operation as
  `new Function('return 1')()` — the rule's own docs describe it as "equivalent to
  eval". It also passes `globalThis.eval('1')`.
- **Origin:** found by review of
  [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md), and
  measured then.
- **Reported:** 2026-09-14

## Symptom

Function variants, one function per spelling. Measured by the tests under
Verification:

| rule                            | reported                      | not reported                                                                        |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `functionNoEval`                | `eval('1')`                   | `globalThis.eval('1')`, `(0, eval)('1')`, `const ev = eval; ev('1')`                |
| `functionNoFunctionConstructor` | `new Function()`              | `Function()`, `new globalThis.Function()`                                           |
| `functionNoConsole`             | `console.log(1)`              | `const { log } = console; log(1)`, `console['log'](1)`, `globalThis.console.log(1)` |
| `functionNoConsoleLog`          | `console.log(1)`              | the same three                                                                      |
| `recommended()`                 | `eval('1')`, `new Function()` | the other five `eval` and `Function` spellings                                      |

## Root cause

Each rule is a lexical matcher in `packages/ts/src/rules/security.ts`:

- `functionNoEval` — `call('eval')` (`:75-76`); the class and module variants are
  the same matcher (`:15-16`, `:101-102`)
- `functionNoFunctionConstructor` — `newExpr('Function')` (`:79-80`), which matches
  only a `NewExpression`, so a call without `new` is invisible; class variant `:25-26`
- `functionNoConsole` — `access(/^console\./)` (`:91-92`); class variant `:62-63`
- `functionNoConsoleLog` — `call('console.log')` (`:87-88`); class `:54-55`, module `:109-110`

`recommended()` uses `functionNoEval` and `functionNoFunctionConstructor`
(`packages/ts/src/presets/recommended.ts:48`, `:58`).

## Relation

- [0224](./fixed/0224-recommended-floor-misses-two-function-shapes.md) fixed which
  **functions** the floor collects; this is which **spellings** it matches inside
  them.
- [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md) is the
  same shape for `process.env`. A binding-aware approach would close both; they are
  separate so each closes in one PR.
- [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md) —
  the class variants also miss field initializers, whatever the spelling.

## Fix

Not decided per spelling, and they split cleanly:

- **`Function(…)` without `new` is a plain call** — matching `call('Function')`
  alongside `newExpr('Function')` closes the floor's worst gap with no design
  question.
- **`globalThis.eval` and `new globalThis.Function`** are fixed chains, matchable
  lexically.
- **`(0, eval)(…)`, `const ev = eval` and a destructured `console`** need the binding
  resolved — the design question 0297 raises, answered once.

Release: the floor preset reds more, so it is a behavioural break, marked on `0.x`.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/security-rules-match-one-spelling.test.ts` ·
      `it('KNOWN GAP — functionNoEval reports eval() and none of globalThis.eval, an indirect call or an alias')`,
      `it('KNOWN GAP — functionNoFunctionConstructor reports new Function() and neither Function() nor new globalThis.Function()')`,
      `it('KNOWN GAP — functionNoConsole and functionNoConsoleLog report console.log and no other spelling')` and
      `it('KNOWN GAP — the recommended floor lets Function() and globalThis.eval through')`.
      Each asserts the canonical spelling IS reported.
- [ ] the fix, starting with `Function(…)` in the floor, KNOWN-GAP tests inverted
- [ ] `npm run validate` green.

Deferred: none.
