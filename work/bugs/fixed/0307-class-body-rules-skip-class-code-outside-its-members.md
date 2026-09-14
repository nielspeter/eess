# Bug 0307: class body rules skip class code outside its members

## Status

- **State:** Fixed — the class body search reads what a class supplies outside its members:
  decorator arguments, computed member names and the arguments of calls in `extends`; not the
  decorator or base class itself. Red test first.
- **Severity:** High — **false green.** A framework module that reads its configuration in a
  class decorator — `@Module({ path: process.env.X })` — passed `noProcessEnv`, the rule written to
  push configuration into injection.
- **Origin:** found by the reviews of
  [0300](./0300-class-body-search-reads-methods-constructors-and-accessors-only.md)'s fix:
  decorator arguments by the method review, computed member names and the `extends` expression by
  the enforcement review.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. `noProcessEnv()` over one class reported the method's read only:

```ts
@Module({ path: process.env.CLASS_DECORATOR }) // class decorator: not reported
export class AppModule extends Base(process.env.HERITAGE) {
  // the extends expression above: not reported
  [process.env.COMPUTED_KEY] = 1 // computed member name: not reported
  @Inject(process.env.MEMBER_DECORATOR) dep = 1 // member decorator: not reported
  withParam(@Inject(process.env.PARAMETER_DECORATOR) x: unknown) {
    // parameter decorator above: not reported
    return x
  }
  method() {
    return process.env.METHOD // reported
  }
}
```

The same held for every rule built on the class body conditions.

## Root cause

`searchClassBody` in `packages/ts/src/helpers/body-traversal.ts` walked the code each member runs
— bodies, parameter defaults, property initializers and static blocks. Decorator arguments,
computed member names and the `extends` expression are none of those: they run when the class is
defined. They were not read before 0300 either.

## Fix

**The ruling.** The record left open which of these a class body rule owns. It was ruled in the fix
— asked to settle it on what makes sense rather than as a question — and stands as the fix's review
ratifies it. Class body conditions work in two directions. For a must-not-contain rule
(`notContain`, and everything built on it) searching more of what the class runs is fail-closed.
For a must-contain rule (`contain`, `classMustCall` — "enforce that a layer actually delegates to
its dependency") searching more can make the rule pass on code that is not behaviour. So the search
reads what a class **supplies** and not the **wiring** it supplies it to:

- read: the arguments of every decorator on the class, its members, accessors and parameters —
  every call of a factory chain, so `@Outer(a)(b)` supplies `a` and `b` — computed member names,
  and the arguments of calls in `extends`;
- not read: the decorator or base class itself. That is what `haveDecorator()` and `extend()`
  select on, and counting it as body code would let `classMustCall(/validate/i)` pass on a class
  that only carries `@Validate()`, a new false green. On the must-not-contain side it gains
  nothing: no global a security rule forbids is applied as a decorator or a base class.
- not read: `implements`, which is type-only, and docstrings, which are not code.

**Built.** `searchClassBody` reads, after each member's body and parameter defaults, its
parameters' and its own decorator arguments and a computed name; after each property's
initializer, its decorator arguments and a computed name; and after the static blocks, the class's
decorator arguments and the arguments of `extends`. A private helper, `suppliedArguments`, walks a
decorator or `extends` expression's call chain through parentheses and returns every call's
arguments in source order.

**The order is for baselines.** A match's identity is numbered within its enclosing declaration.
Measured: a class decorator's arguments and `extends` count toward the class, as a static block
does; a member decorator's and a parameter decorator's arguments toward the member, as its body and
defaults do; a computed name has a scope of its own. Each declaration's earlier searches come first,
so a finding a baseline accepted keeps its ordinal and a new one is numbered after it; a test pins
both scopes.

**A limit, stated rather than filed:** a forbidden call used as the base or decorator itself —
`extends (eval('Base'))` — is not reported, because the wiring is not searched. Nothing but a
deliberate evasion writes one, and reading the wiring would cost the must-contain rules a false
green.

The descriptions of the class walk were updated: the `contain()` JSDoc on the class builder, the
class rules' JSDoc in `rules/typescript` and `rules/security`, the class walk in
`docs/standard-rules.md`, `docs/body-analysis.md` and `docs/classes.md`, and the `classMustCall`
rows, which still said "at least one class method". The pending 0300 changeset no longer lists these
positions as unsearched.

## Verification

- [x] A ruling on which of them a class body rule reads — above.
- [x] Red test first —
      `packages/ts/tests/conditions/class-body-search-reads-class-code-outside-members.test.ts`, the
      KNOWN-GAP test inverted into target tests and run before the fix: the positions test reported
      line `['6']` of eleven findings; the wiring test reported all four classes as not containing
      the call, where the one that supplies `validate()` in a decorator argument contains it; the
      ordinal test saw lines `['4', '8']` of four; the docstring CONTROL passed.
- [x] The fix turns them green —
      `it('noProcessEnv on a class reads decorator arguments, computed member names and the arguments of extends')`,
      `it('a decorator or base class is wiring, not body code, but a call in its arguments is')` and
      `it('a match outside the members is numbered after the matches its declaration already had')`,
      with `it('CONTROL — a docstring above a decorator is still not read')` still green. 0300’s
      `noProcessEnv` test now expects the decorator argument on its line 12. The full `packages/ts`
      suite passes.
- [x] Sabotage matrix in the 0307 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `body-traversal.ts` restored by
      sha256 after every row, verdicts read by test title over this file and 0300’s): **16 rows, 0
      mismatches**, every row as predicted on its first run. Baseline green. Every new search
      removed reds the positions, wiring and ordinal tests and 0300’s `noProcessEnv` test.
      Removing one search at a time reds the positions test each time, and also: member decorators
      the ordinal test; property decorators 0300’s `noProcessEnv` test; class decorators the wiring
      and ordinal tests. Reading only the outermost call of a factory chain reds the positions
      test. Searching the class’s decorators and `extends` before its static blocks reds the
      ordinal test; searching a member’s decorators and defaults before its body reds the ordinal
      test and 0300’s. Over-broad — the whole decorator expression, or the whole `extends`
      expression — reds the wiring test only; reading the decorator node with its leading trivia
      reds the wiring test and the docstring CONTROL. A total break reds every test in both files
      but 0300’s kind-guard test, which expects nothing.
- [x] `npm run validate` green.

Deferred: none.
