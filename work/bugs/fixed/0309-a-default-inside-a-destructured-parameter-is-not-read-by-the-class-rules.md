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
it read before, every destructured parameter of every method, constructor and accessor: for each
binding element, its computed key, then its default, then the pattern it destructures into. That is
code each call runs, so both reaches read it — member code, as a plain default is. A match there is
numbered after every match the search read before in the same member, so a finding a baseline
accepted keeps its identity. Every class rule over the search reads it: `contain`, `notContain`,
`useInsteadOf`, `noSilentCatch`, `noMagicNumbers` and the class security rules, and a must-contain
rule is satisfied by a call there, as by a call in a plain default.

**`noMagicNumbers`** (`packages/ts/src/rules/code-quality.ts`). The record asked whether its
exemption for a whole-value default covers a binding element. The implementer ruled on 2026-09-15 that
it does, reasoning it out as the maintainer had asked of design questions; the maintainer accepts or
rejects it at review. `{ attempts = 3 }` names its value exactly as `attempts = 3` does, and 0306 drew
the line at the class's own names; reporting it would ask an author to extract a constant that is
already named. Neither shape was read before, so the exemption drops no finding. It covers a binding
element's whole default, through the same sign and wrappers, at any depth of pattern, in a parameter
of one of the class's own members. A number inside a larger default or in a computed key is
reported, and so is one in a destructured parameter of a function nested inside a member, as it was
before.

The function rules read no parameter default at all; that is
[0314](../0314-the-function-rules-read-no-parameter-default.md), still open.

## Verification

- [x] Red test first — `packages/ts/tests/rules/class-rules-read-a-destructured-default.test.ts`,
      the KNOWN-GAP test inverted into target tests and run before the fix: `noEval` reported none of
      the five destructured positions (`[]`); `noMagicNumbers` reported one number of the three the
      exemption test expects, the nested function's; the ordinal test found the matches on lines 3,
      5 and 7 and none on line 4; the CONTROL passed. The `classContain` test was written after the
      fix, and the matrix's red-first row shows it red without it.
- [x] The fix turns them green —
      `it('the class rules read a default inside a destructured parameter')`,
      `it("noMagicNumbers exempts a whole default inside the class's own destructured parameter, not a nested function's")`,
      `it('a match in a destructured default is numbered after every match the search read before in that member')`
      and `it('classContain counts a call in a destructured default as the class containing it')`,
      with `it('CONTROL — a plain parameter default and a whole pattern default are read as before')`
      still green. Every test under `packages/ts/tests/rules`, `tests/conditions` and `tests/helpers`
      passes.
- [x] Sabotage matrix in the 0309 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved to
      the worktree's `packages/core`, literal replacements in `body-traversal.ts` and
      `code-quality.ts` restored by sha256 after every row, verdicts read by test title over this file
      and `class-rules-read-the-code-a-class-runs.test.ts`): **15 rows, 0 mismatches**. Baseline
      green. Reading no destructured parameter reds the four target tests and not the CONTROL, and so
      does not reading a binding element's default, or not reading an object pattern. Not reading a
      computed key reds the target test and the exemption test; not reading a nested pattern, not
      reading an array pattern, or treating an array pattern's hole as an element reds the target
      test. Reading destructured defaults before the bodies reds the ordinal test. Removing the
      binding-element exemption, applying it to any binding element, or not climbing a nested, an
      object or an array pattern to the parameter reds the exemption test; treating any function's
      parameter as the class's own also reds 0306's nested test. Not guardable by construction, and
      so not rows: `isOwnParameter`'s parameter check narrows a node whose grandparent is compared to
      the class, and nothing else a binding element destructures in member code has the class as its
      grandparent; and the binding element's initializer comparison, because a numeric literal whose
      parent is a binding element and which is not its default is a plain numeric key, which the
      search does not read. Not pinned: the order of a computed key and a default within one binding
      element, which only an ordinal between two matches on one element could show.
- [x] `npm run validate` green.

Deferred: none.
