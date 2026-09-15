# Bug 0309: a default inside a destructured parameter is not read by the class rules

## Status

- **State:** Fixed — the class body search reads the code a destructured parameter runs: each
  binding element's default and computed key, at any depth. `noMagicNumbers` names a number that is
  the whole default of a binding element in one of the class's own members' parameters. Red test
  first.
- **Severity:** High — **false green.** `noEval` passed `m({ a = eval('x') } = {})` in a class, and
  so did every rule over the class body search — `notContain`, `noSilentCatch`, `noMagicNumbers`.
- **Origin:** found by the enforcement review of
  [0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix, and
  measured then. The class search has read a whole parameter's default since
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md); a default
  inside the pattern was never read. The function rules' parameter defaults, first recorded here,
  were split to [0314](../0314-the-function-rules-read-no-parameter-default.md) by #137's second
  method review: either fix can land without the other.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-15

## Symptom

As reported. The same code as a plain parameter default and inside a destructured parameter, in a
class method:

| code — rule                        | plain default | inside the pattern                 |
| ---------------------------------- | ------------- | ---------------------------------- |
| `eval('x')` — `noEval`             | reported      | **not reported**, object and array |
| `4242 * 2` — `noMagicNumbers`      | reported      | **not reported**                   |
| a silent `catch` — `noSilentCatch` | reported      | **not reported**                   |

The default of the whole pattern — `o({ c } = { c: eval('z') })` — was read, as a plain default is.

## Root cause

`searchClassBody` (`packages/ts/src/helpers/body-traversal.ts`) searched a parameter's
`getInitializer()`, the default of the whole parameter. A default inside the pattern belongs to a
binding element under the parameter's name node, and the name node was not searched.

## Fix

**The search** (`packages/ts/src/helpers/body-traversal.ts`) reads, in a fourth pass after everything
it read before, every destructured parameter of every method, constructor and accessor. The walk,
`bindingPatternMatches`, reads for each binding element its computed key, then its default, then the
pattern it destructures into — the order they run — and sits apart from the class search so 0314's
fix can read a function's parameters with it. That code runs at each call, so both reaches read it:
it is member code, as a plain default is, and a computed key inside a destructured parameter is
member code while a computed member name, which runs once when the class is defined, is not. The
reach's documentation says so. A match there is numbered after every match the search read before in
the same member — its body, its plain defaults, a property of its name, a static member of its name,
its decorators — so a finding a baseline accepted keeps its identity. Every class rule over the
search reads it: `contain`, `notContain`, `useInsteadOf`, the class security, error and TypeScript
rules, `noSilentCatch`, `noMagicNumbers`, `classMustCall` and the `dataLayerIsolation` preset's
typed-errors rule. So a green rule may report findings there, and a must-contain rule may now be
satisfied by a call there, as by a call in a plain default; the changeset says both.

**`noMagicNumbers`** (`packages/ts/src/rules/code-quality.ts`). The Draft record asked the fix to
decide whether its exemption for a whole-value default covers a binding element. The implementer
ruled on 2026-09-15 that it does, reasoning it out as the maintainer had asked on 2026-09-14 of design
questions ([0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)).
`{ attempts = 3 }` names its value exactly as `attempts = 3` does, and 0306 drew the line at the
class's own names; reporting it would ask an author to extract a constant that is already named.
Neither shape was read before, so the exemption drops no finding. It covers a binding element's whole
default, through the same sign and wrappers, at any depth of pattern, in a parameter of one of the
class's own members, constructors included. A number inside a larger default —
`outer({ timeout } = { timeout: 4040 })` — or in a computed key is reported, and so is one in a
destructured parameter of a function nested inside a member, as it was before. A plain numeric key
in a member's own parameter, `{ 4646: k }`, is not code and is not read; how numeric keys should be
treated is recorded with [0317](../0317-no-magic-numbers-reports-numbers-named-other-ways.md).
**Measured, not argued.** At #138's review, on 2026-09-15, the maintainer asked that the ruling
rest on facts rather than argument. The corpora are recorded in
[0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md): eess's `packages/*/src` at `7a71d2f`; NestJS's `packages/` and, separately, its `sample/` and
`integration/` apps, at `nestjs/nest@4c5fac0`; TypeORM's `src/` and, separately, its `sample/` and
test entities, at `typeorm/typeorm@7a9009d`; and PixiJS's `src/` at `pixijs/pixijs@6bcc937` — 4,458
files and 3,344 classes, tests excluded. The rule ran as shipped, with the exemption removed, and
reading decorators, computed member names and `extends` as well, each a patched copy of the built
rule. Across
them the exemption hid 55 of 1,148 findings, and not one was a default inside a destructured
parameter, so on this sample the extension changes no finding either way. ESLint's
`no-magic-numbers` names destructured defaults in the same line — its `ignoreDefaultValues` treats
`const { tax = 0.25 } = accountancy` as fine — and leaves that option off by default. The
binding-element exemption stands on the plain-default exemption it extends, whose measurement 0306
records.

The function rules read no parameter default at all; that is
[0314](../0314-the-function-rules-read-no-parameter-default.md), still open.

## Verification

- [x] Red test first — `packages/ts/tests/rules/class-rules-read-a-destructured-default.test.ts`,
      the KNOWN-GAP test inverted into target tests and run before the fix: `noEval` reported none of
      the five destructured positions then in the fixture (`[]`); `noMagicNumbers` reported one number
      of the three the exemption test then expected, the nested function's; the ordinal test found the
      matches on lines 3, 5 and 7 and none on line 4; the CONTROL passed. The tests grew after that
      run, under #138's reviews: the array pattern's hole, the constructor and the silent catch's
      message in the target test; the array, constructor and larger-default lines in the exemption
      test; and the `classContain`, scope-ordinal and read-order tests, written after the fix. The
      matrix's red-first row shows every one of them red without the fourth pass.
- [x] The fix turns them green —
      `it('the class rules read a default inside a destructured parameter')`,
      `it("noMagicNumbers exempts a whole default inside the class's own destructured parameter, not a nested function's")`,
      `it('a match in a destructured default is numbered after every match the search read before in that member')`,
      `it('a destructured-default match is numbered after a decorator, a same-named static member and a property of that name')`,
      `it('a destructured parameter is read in the order it runs: computed key, then default, then nested pattern')`
      and `it('classContain counts a call in a destructured default as the class containing it')`,
      with `it('CONTROL — a plain parameter default and a whole pattern default are read as before')`
      still green. Every test under `packages/ts/tests/rules`, `tests/conditions` and `tests/helpers`
      passes.
- [x] Sabotage matrix in the 0309 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved to
      the worktree's `packages/core`, literal replacements in `body-traversal.ts` and
      `code-quality.ts` restored by sha256 after every row, verdicts read by test title over this file
      and `class-rules-read-the-code-a-class-runs.test.ts` only): **21 rows, 0 mismatches**, run after
      #138's review fixes. Baseline green. Reading no destructured parameter, not reading a binding
      element's default, or not reading an object pattern reds the six target tests and not the
      CONTROL. Not reading a computed key reds the target, exemption and read-order tests; not
      reading a nested pattern reds the target and read-order tests; not reading an array pattern,
      treating a hole as an element, or skipping constructors reds the target test. Reading
      destructured parameters before the bodies reds both ordinal tests; before the decorators,
      before property initializers, or with each member's plain defaults reds the scope-ordinal test.
      Reading a computed key after its default, or a nested pattern before its default, reds the
      read-order test. Removing the binding-element exemption, applying it to any binding element, or
      not climbing a nested, an object or an array pattern to the parameter reds the exemption test;
      treating any function's parameter as the class's own also reds 0306's nested test. Not
      guardable by construction, and so not rows: `isOwnParameter`'s parameter check, because what
      reaches it is a parameter or the variable declaration a pattern destructures — in a body, a
      `for…of` or a `catch` — whose grandparent is never the class, so the check only narrows the
      type; and the binding element's initializer comparison, because a numeric literal whose parent
      is a binding element and which is not its default is a plain numeric key, which the body search
      reads only where a variable or a nested function's parameter destructures it — there
      `patternOwner` reaches no parameter of the class — and which the fourth pass does not read in a
      member's own parameter. That holds across both files, not `code-quality.ts` alone.
- [x] `npm run validate` green.

Deferred: none.
