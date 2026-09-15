# Bug 0315: the function builder does not collect a constructor, an accessor, a function-valued property or a wrapped function

## Status

- **State:** Fixed — `functions()` collects every named function: a class's constructor, accessors and
  function-valued properties beside its methods, and a function behind parentheses, `as`, `<T>`,
  `satisfies` or `!`. `noEmptyBodies` does not report an empty constructor that still does
  something. Red test first.
- **Severity:** High — **false green** on the floor. The `recommended` preset's function rules never
  saw the code of a class constructor, an accessor or an arrow-function property, or a function inside
  parentheses or behind `as`: `eval` there passed `functionNoEval`. The class rules read those
  positions since
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md) and
  [0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md), but the floor
  does not run them.
- **Origin:** #137's second architecture review, measured then.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-15

## Symptom

As reported. `functions(p).should().satisfy(functionNoEval())` over one file:

| function                                                                    | reported |
| --------------------------------------------------------------------------- | -------- |
| method `m() { return eval('m') }`                                           | yes      |
| `constructor() { eval('c') }`                                               | **no**   |
| `get g() { return eval('g') }`                                              | **no**   |
| `handler = () => eval('h')`                                                 | **no**   |
| `export const wrapped = ((x: string) => eval(x)) as (x: string) => unknown` | **no**   |
| `export const plain = (x: string) => eval(x)`                               | yes      |

## Root cause

`collectFunctions` (`packages/ts/src/models/arch-function.ts`) collected function declarations, a
variable whose initializer was itself an arrow function or function expression
(`getInitializerIfKind`, which reads through no wrapper), class methods, and — when asked — function
values in object literals. Constructors, accessors and class properties were not among them.

## Fix

**Collection** (`packages/ts/src/models/arch-function.ts`). After each class's methods,
`collectFunctions` collects its constructor with a body — ts-morph lists an overloaded constructor by its
implementation alone, and an ambient class's constructor has none — its accessors, and its properties whose value is a function. It reads a variable's initializer, and a
property's value, through parentheses, `as`, `<T>`, `satisfies` and `!` with `functionValueOf`, which
the class metrics rules now import from here instead of keeping their own copy. A member is named by
its class — `Class.constructor`, `Class.handler`, and `Class.get x` and `Class.set x`, because a getter
and its setter share a name and a function metric's identity keys on it — and reports its class's
export, its own access modifier, whether it is async and its parameters. `includeMethods: false`
leaves out every class member. The name of every function collected before is unchanged. The setter
notes on `acceptParameterOfType`, the function builder's own description, and `docs/functions.md`,
`docs/standard-rules.md`, `docs/api-reference.md` and the eess-ts README say so.

**Measured before building it, 2026-09-15.** A prototype of that collection ran beside today's over
eess's `packages/*/src` at `6e077ed`; NestJS's `packages/` and, separately, its `sample/` and
`integration/` apps, at `nestjs/nest@4c5fac0`; TypeORM's `src/` at `typeorm/typeorm@7a9009d`; and
PixiJS's `src/` at `pixijs/pixijs@6bcc937`. The collection grew by 2.0% in eess (1,767 → 1,803
functions) and 34.0% in PixiJS (2,354 → 3,154). No finding any measured rule reported was lost. The
findings it added, summed over the five corpora: `functionNoEval` and `functionNoFunctionConstructor`
0, `functionNoSilentCatch` 1, `functionNoGenericErrors` 19, `noStubComments` 9,
`maxFunctionComplexity(10)` 6, `maxFunctionLines(50)` 10, `maxFunctionParameters(4)` 18, duplicate
bodies at 0.9 similarity 21 — generic `Error`s thrown in constructors and getters, `ColumnMetadata`'s
constructor at complexity 63 — and `noEmptyBodies` 201, every one an empty constructor: 199 with a
parameter property, `constructor(private readonly db: Db) {}`, and 2 `constructor() {}`.

**`noEmptyBodies`** (`packages/ts/src/conditions/body-analysis-function.ts`). Ruled on that
measurement, as the maintainer asked on 2026-09-15 that such rulings rest on facts: an empty
constructor with a parameter property, or a `private` or `protected` one, is not reported, and an
empty public constructor without either is. A parameter property assigns a field and a non-public
constructor restricts who may construct the class, so neither body is a stub — typescript-eslint's
`no-useless-constructor` treats both as useful too. It clears all 199 and keeps the 2. Without it,
collecting constructors would have added 199 false findings to the `recommended` floor, the largest
effect of the change.

## Verification

- [x] Red test first — `packages/ts/tests/rules/functions-collects-every-named-function.test.ts`, the
      KNOWN-GAP test inverted and widened, run before the fix: the shapes test found 2 of 11 functions,
      the member test none of its members, the `includeMethods: false` test 1 of 5, and the empty-body
      test collected no function at all, so the rule reported only that it examined nothing. The
      member test was widened after that run — async, parameters, an overloaded constructor and an
      ambient class — and the matrix shows it red without the fix.
- [x] The fix turns them green —
      `it('collects a constructor, accessors, a function-valued property and a wrapped function')`,
      `it("a class member reports its class's export, its own access modifier, async and parameters")`,
      `it('includeMethods: false leaves out every class member, and still reads a wrapped variable')`
      and `it('noEmptyBodies reports an empty constructor only when it does nothing')`. The whole
      `packages/ts` suite passes with no other test changed, and this repo's own `check:arch`,
      `check:guardrails` and `check:baseline`, which run function rules and the two presets, pass.
- [x] Sabotage matrix in the 0315 worktree (per-entry `node_modules`, literal replacements in
      `arch-function.ts` and `body-analysis-function.ts` restored by sha256 after every row, verdicts
      read by test title over the new test file and `class-rules-read-the-code-a-class-runs.test.ts`):
      **26 rows, 0 mismatches**. Baseline green. Collecting no class member but methods reds the
      shapes, member and empty-body tests; reading a variable without unwrapping reds the shapes and
      `includeMethods` tests; reading through any one of the five wrappers fewer also reds 0306's
      metrics test, which shares the unwrap. Collecting a constructor without a body — an ambient
      class's — or a member reporting itself exported, public, not async or without parameters reds the member test.
      Naming a getter like a property, or collecting no getter, reds the shapes, member and empty-body
      tests; naming a setter like a property, or collecting no setter or no function-valued property,
      reds the shapes and member tests. A member without a body reds the shapes and empty-body tests;
      ignoring `includeMethods: false` reds its test. Removing the empty-constructor exemption, or
      its private, protected or parameter-property branch, exempting every constructor, or exempting
      one for any parameter, reds the empty-body test. One row was a mismatch on the first run: with
      only an overloaded constructor in the fixture, collecting a constructor without a body stayed
      green, because ts-morph lists an overloaded constructor by its implementation alone; an ambient
      class was added, and that row reds. Not pinned: a member's return type and start line, which no
      rule over these shapes reads in the tests.
- [x] `npm run validate` green.

Deferred: none.
