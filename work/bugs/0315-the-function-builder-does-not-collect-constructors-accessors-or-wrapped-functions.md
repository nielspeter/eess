# Bug 0315: the function builder does not collect a constructor, an accessor, a function-valued property or a wrapped function

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test.
- **Severity:** High — **false green** on the floor. The `recommended` preset's function rules
  (`packages/ts/src/presets/recommended.ts:48`, `:58`, `:68`) never see the code of a class
  constructor, an accessor or an arrow-function property, or a function inside parentheses or behind
  `as`: `eval` there passes `functionNoEval`. The class rules read those positions since
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md) and
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md), but the
  floor does not run them.
- **Origin:** #137's second architecture review, measured then.
- **Reported:** 2026-09-14

## Symptom

`functions(p).should().satisfy(functionNoEval())` over one file:

| function                                                                    | reported |
| --------------------------------------------------------------------------- | -------- |
| method `m() { return eval('m') }`                                           | yes      |
| `constructor() { eval('c') }`                                               | **no**   |
| `get g() { return eval('g') }`                                              | **no**   |
| `handler = () => eval('h')`                                                 | **no**   |
| `export const wrapped = ((x: string) => eval(x)) as (x: string) => unknown` | **no**   |
| `export const plain = (x: string) => eval(x)`                               | yes      |

## Root cause

`collectFunctions` (`packages/ts/src/models/arch-function.ts`) collects function declarations, a
variable whose initializer is itself an arrow function or function expression
(`getInitializerIfKind`, which reads through no wrapper), class methods, and — when asked — function
values in object literals. Constructors, accessors and class properties are not among them.

## Fix

Collect constructors, accessors and function-valued class properties, and read a variable's
initializer through parentheses, `as`, `<T>`, `satisfies` and `!`, as the metrics rules read a
property's since 0306. Each new element can add findings, and the names of the elements already
collected must not change, because metric identities key on them.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/functions-collects-some-function-shapes.test.ts` ·
      `it('KNOWN GAP — a constructor, an accessor, a function-valued property and a wrapped function are not collected')`,
      where the method and `plain` are collected as its control.
- [ ] the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
