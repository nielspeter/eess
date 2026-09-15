# Bug 0321: function positions no function rule reads — a class expression, a namespace class, an object accessor, a static block, a call, a conditional

## Status

- **State:** Draft — reproduced on 0315's build, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green** on the floor. `eval` in any position below passes
  `functionNoEval`, which the `recommended` preset runs over the same collection
  (`packages/ts/src/presets/recommended.ts:152`). The class rules miss two of the positions as well.
- **Origin:** #140's method and enforcement reviews, 2026-09-15, reviewing
  [0315](./fixed/0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md)'s
  fix, which collects a class declaration's function members; split from it rather than widening
  that fix.
- **Reported:** 2026-09-15

## Symptom

One file, on 0315's build: `functions()` with object-literal functions asked for, as the presets ask,
and `classes()`, each with its `eval` rule.

| position                                                                                      | `functions()` · `functionNoEval` | `classes()` · `noEval` |
| --------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------- |
| control: `export function control() { eval('…') }`                                            | reported                         | —                      |
| a class expression's method: `export const Expr = class { m() { eval('…') } }`                | **no**                           | **no**                 |
| a namespace class's method: `export namespace N { export class Inner { m() { eval('…') } } }` | **no**                           | **no**                 |
| an object literal's accessors: `{ get x() { return eval('…') }, set x(v) { eval(v) } }`       | **no**                           | —                      |
| a static block: `class S { static { eval('…') } }`                                            | **no**                           | reported               |
| a class field that holds no function: `class F { x = eval('…') }`                             | **no**                           | reported               |
| a function passed to a call a variable holds: `const memoised = memo(() => eval('…'))`        | **no**                           | —                      |
| a function a conditional chooses: `const chosen = flag ? () => eval('…') : () => 0`           | **no**                           | —                      |
| a callback at module level: `app.get('/', () => eval('…'))`                                   | **no**                           | —                      |

Two positions near these are read, measured the same way: a class declared inside a function, as
part of that function's body, and a default-exported class, whose method is collected as
`<anonymous>.m`.

## Root cause

`collectFunctions` (`packages/ts/src/models/arch-function.ts:352`):

- collects class members from `sourceFile.getClasses()` (`packages/ts/src/models/arch-function.ts:382`),
  a file's top-level class declarations, so neither a class expression nor a class inside a
  namespace;
- collects a variable whose initializer is a function behind at most parentheses, `as`, `<T>`,
  `satisfies` or `!` (`packages/ts/src/models/arch-function.ts:374`), so not one behind a call or a
  conditional — and a callback passed to a call outside any function belongs to no collected function;
- collects an object-literal value that is an arrow function, a function expression or a method
  (`packages/ts/src/models/arch-function.ts:460`), so not an accessor;
- collects nothing for a static block, or for a class field whose value is not a function: neither is
  a function.

The class rules miss a class expression and a namespace class too; where their walk starts is for
the fix to establish.

## Fix

The positions are different questions, and each wants a measured ruling:

- a class expression's or a namespace class's members are the members 0315 collects, in a class the
  walk does not reach, and the class rules need the same reach;
- an object literal's accessors are the object-literal collection's counterpart of 0315's class
  accessors;
- a static block, and a field whose value is not a function, are code a class runs; whether a function
  rule reads them, or they stay with the class rules, which read both, is a ruling;
- a function passed to a call or chosen by a conditional is where 0315 stopped on purpose.
  `FunctionCollectionOptions` keeps anonymous function values opt-in because every inline callback
  would reach rules written for named functions. Code outside any function may belong to
  `moduleNoEval` and its siblings rather than to the function collection; the `recommended` preset
  builds every rule it runs with `functions()` today.

Measure each on the corpora 0315 used before ruling.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/function-positions-the-builder-does-not-collect.test.ts` ·
      `it('KNOWN GAP — eval in a class expression, a namespace class, an object accessor, a static block, a call or a conditional is not reported')`
      and `it('KNOWN GAP — the class rules read neither a class expression nor a namespace class')`,
      each asserting its control: the function declaration, and the static block and the field, are
      reported.
- [ ] a measured ruling per position
- [ ] the fix, the KNOWN-GAP tests inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
