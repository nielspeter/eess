# Bug 0315: the function builder does not collect a constructor, an accessor, a function-valued property or a wrapped function

## Status

- **State:** Fixed — `functions()` collects a class declaration's constructor, accessors and
  function-valued properties beside its methods, and a function behind parentheses, `as`, `<T>`,
  `satisfies` or `!`. Each function reports its kind and a rule selects by it; `resolvers()` leaves
  out constructors and accessors; `noEmptyBodies` does not report an empty constructor that does
  something. Red test first. The positions still not collected are 0321, and accessor and static
  member naming is 0320.
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

**Collection** (`packages/ts/src/models/arch-function.ts`). After each class declaration's methods,
`collectFunctions` collects its constructor with a body — ts-morph lists an overloaded constructor by
its implementation alone, and an ambient class's constructor has none — its accessors, and its
properties whose value is a function. It reads a variable's initializer, and a property's value,
through parentheses, `as`, `<T>`, `satisfies` and `!` with `functionValueOf`, which the class metrics
rules now import from here instead of keeping their own copy. A member is named by its class —
`Class.constructor`, `Class.handler`, and `Class.get x` and `Class.set x`, because a getter and its
setter share a name — and reports its class's export, its own access modifier, whether it is async,
its parameters and its function's return type; its line and its node are the member's, so a finding,
and a comment above the member, anchor there. `includeMethods: false` leaves out every class member.
Every function collected before keeps its name.

Not collected, and filed in this PR: a class expression's and a namespace class's members, an object
literal's accessors, a static block, and a function behind a call or a conditional —
[0321](./0321-function-positions-no-function-rule-reads.md). The class metrics still name an accessor
`Class.x`, and a static member is named like its instance twin on both sides —
[0320](../0320-an-accessor-is-named-two-ways-and-static-members-collide.md).

**Kinds** (`packages/ts/src/predicates/function.ts`). A requirement — `beAsync()`, `contain(...)`,
`acceptParameterOfType(...)`, `haveReturnTypeMatching(...)`, `haveNameMatching(...)`, `beExported()`
— now judges a constructor and an accessor too, which may not be able to comply. #140's product review
asked for a way to keep such a rule to the functions that can. `functionKindOf` names each function's
kind — `'function'`, `'method'`, `'constructor'`, `'getter'`, `'setter'` or `'property'` — and
`areOfKind(...)` and `areNotOfKind(...)` select by it, as predicates and on the function builder;
naming no kind, or a string that is not a kind, throws `ArchConfigError`, because the type stops a
typo only where a rule file is type-checked: #140's second enforcement review measured
`areOfKind('getter', 'seter')` passing a setter's `eval` before that check. `resolvers()`
(`packages/ts/src/graphql/resolver-rule-builder.ts`) leaves out constructors and accessors itself: a
class-based resolver's injected constructor would otherwise fail every `contain(...)` rule written
against the resolvers. A getter written as a field resolver is therefore not read either.
`docs/functions.md`, `docs/api-reference.md` and the changeset say so.

**Measured on the shipped build, 2026-09-15.** Each rule below ran twice — over the collection at
`6e077ed` and over this fix's build, with object-literal functions collected as the presets ask — on
eess's `packages/*/src` at `6e077ed`; NestJS's `packages/` and, separately, its `sample/` and
`integration/` apps, at `nestjs/nest@4c5fac0`; TypeORM's `src/` at `typeorm/typeorm@7a9009d`; and
PixiJS's `src/` at `pixijs/pixijs@6bcc937`, tests and specs left out. Findings were compared by file,
element and message, and each added and each lost finding counted rather than the totals netted. The
collection grew by 2.0% in eess (1,767 → 1,803 functions) and 34.0% in PixiJS (2,354 → 3,154). **No
finding was lost.** Added, summed over the five: duplicate bodies at 0.9 similarity 21,
`functionNoGenericErrors` 19, `maxFunctionParameters(4)` 18, `maxFunctionLines(50)` 10,
`noStubComments` 9, `maxFunctionComplexity(10)` 6, `noEmptyBodies` 2, `functionNoSilentCatch` 1,
and `functionNoEval` and `functionNoFunctionConstructor` 0 — generic `Error`s thrown in constructors
and getters, and TypeORM's `ColumnMetadata` constructor at complexity 63, among them. `resolvers()`,
`inconsistentSiblings` and the requirement conditions were not measured.

**`noEmptyBodies`** (`packages/ts/src/conditions/body-analysis-function.ts`). A prototype of the
collection, run on the same corpora before any of this was built, reported 201 empty constructors: 199
whose every parameter is a parameter property, `constructor(private readonly db: Db) {}`, and 2
`constructor() {}` in NestJS's integration apps. The implementer ruled on that measurement — the
maintainer had asked, in conversation on 2026-09-15, that such rulings rest on facts — and #140's
reviews narrowed the ruling: an empty constructor whose every parameter is a parameter property is not
reported, since each parameter assigns a field, and neither is a `private` or `protected` constructor
that takes no parameter, since it restricts who may construct the class. Every other empty constructor
is reported: a plain parameter beside a parameter property, a decorated parameter without a property
modifier, a non-public constructor that drops a parameter, and a public one that takes nothing. The
shipped build reports the 2 and none of the 199. Two parts rest on reasoning, because the corpora hold
neither shape: they contain no empty non-public constructor without parameters, and no empty constructor
with a decorated plain parameter such as `@Inject(TOKEN) db: Db`. typescript-eslint's
`no-useless-constructor` spares both exempted shapes and more — any parameter property or decorated
parameter, and any non-public constructor — because it asks whether removing a constructor would change
the class. This rule asks whether an empty body is a stub, so a dropped parameter is reported.

## Verification

- [x] Red test first —
      `packages/ts/tests/rules/functions-collects-class-members-and-wrapped-functions.test.ts`, the
      KNOWN-GAP test inverted and widened, run before the fix: the shapes test found 2 of 11 functions,
      the member test none of its members, the `includeMethods: false` test 1 of 5, and the empty-body
      test collected no function at all. The member test was widened after that run, and the tests
      #140's reviews asked for were added after the fix; the matrix shows each red without the part it
      pins.
- [x] The fix turns them green —
      `it('collects a constructor, accessors, a function-valued property and a wrapped function')`,
      `it("a class member reports its class's export, its own access modifier, async and parameters")`,
      `it('a class member reports its return type')`,
      `it('a finding on a class member is reported at the member, not the read')`,
      `it('a comment above a class member belongs to the member')`,
      `it('includeMethods: false leaves out every class member, and still reads a wrapped variable')`,
      `it('each function reports its kind, and a rule narrows by kind')` and
      `it('noEmptyBodies reports an empty constructor only when it does nothing')`;
      `packages/ts/tests/rules/no-eval-function-shapes.test.ts` gains six shapes, from a constructor to
      a property behind `satisfies`; and
      `packages/ts/tests/graphql/resolvers-skip-constructors-and-accessors.test.ts` ·
      `it('a class-based resolver is judged on its methods and function-valued properties only')`.
      The whole `packages/ts` suite passes.
- [x] Sabotage matrix in the 0315 worktree (per-entry `node_modules`; literal replacements in
      `arch-function.ts`, `body-analysis-function.ts`, `predicates/function.ts` and
      `resolver-rule-builder.ts`, restored by sha256 after every row; verdicts read by test title over
      six files — the test above, `class-rules-read-the-code-a-class-runs.test.ts`,
      `no-eval-function-shapes.test.ts`, the resolver test, and 0320's and 0321's KNOWN-GAP tests):
      **45 rows, 0 mismatches** on the last full run, the working tree unchanged after. Baseline
      green. Collecting no class
      member but methods reds all 16 tests that read one; reading a variable without unwrapping reds
      the shapes, `includeMethods`, kind and `as`-shape tests; leaving any one of the five wrappers
      unread reds those that use it and 0306's metrics test, which shares the unwrap. Collecting a
      constructor without a body, or a member reporting itself exported, public, not async or without
      parameters, reds the member test. Naming a getter or a setter like a property, or collecting
      none, reds every test that names or counts one, 0320's among them; collecting no function-valued
      property reds ten. A member reporting no body reds every test that reads a body. Reading a
      member's return type from the member, its line from its function, or taking its function as its
      node reds, in turn, the return-type test, the line test, and the comment and kind tests. Removing
      any of `functionKindOf`'s five branches, `areOfKind` matching everything, `areNotOfKind` not
      negating, and naming no kind or an unknown kind
      accepted red the kind test; a constructor, getter or setter reporting
      kind `'function'`, or `resolvers()` keeping any of the three, reds the resolver test. Removing
      the empty-constructor exemption, or its private, protected or parameter-property condition, reds
      the empty-body test, and so do five over-broad variants: every constructor spared, one parameter
      property sparing a plain parameter beside it, any parameter sparing, a public constructor that
      takes nothing spared, and a non-public one with a plain parameter spared. An earlier full run,
      before the unknown-kind
      check existed, had one mismatch, a wrong prediction rather than a wrong test: collecting no class
      member also reds 0320's exclusion test, because without the setter only the two methods remain.
      The expectation was corrected. Not pinned: the order a
      class's members are listed in — methods, then the constructor, accessors and properties — and
      that an abstract accessor without a body is collected, as an abstract method is, which #140's
      testing review measured; the member test pins an ambient accessor.
- [x] `npm run validate` green.
- [ ] dropped-on-purpose — a `check:nonvacuity` probe planting `eval` in a class member for the
      `recommended` gate, raised by #140's enforcement review. That probe proves the preset reaches this
      repo, which the top-level probe already does; which positions the collection reads is proven by
      the tests and the matrix above, which run inside `validate`.
- [ ] deferred→[0320](../0320-an-accessor-is-named-two-ways-and-static-members-collide.md) — one
      accessor naming for the class and function sides, and a static member named apart from its
      instance twin, raised by #140's reviews.
- [ ] deferred→[0321](./0321-function-positions-no-function-rule-reads.md) — the function positions
      still not collected, raised by #140's method and enforcement reviews.

Deferred: 0320, 0321.
