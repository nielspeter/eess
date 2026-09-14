# Bug 0307: class body rules skip class code outside its members

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test.
- **Severity:** High — **false green.** A framework module that reads its configuration in a
  class decorator — `@Module({ path: process.env.X })` — passes `noProcessEnv`, the rule written
  to push configuration into injection.
- **Origin:** found by the reviews of
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md)'s fix:
  decorator arguments by the method review, computed member names and the `extends` expression by
  the enforcement review.
- **Reported:** 2026-09-14

## Symptom

`noProcessEnv()` over one class reports the method's read only:

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

The same holds for every rule built on the class body conditions; the enforcement review
measured `noEval` missing a computed key and an `extends` expression the same way.

## Root cause

`searchClassBody` (`packages/ts/src/helpers/body-traversal.ts:184`) walks the code each member
runs — bodies, parameter defaults, property initializers and static blocks. Decorator arguments,
computed member names and the `extends` expression are none of those: they run when the class is
defined. They were not read before 0300 either, so this is not a regression.

## Fix

Not decided. All three are code, so the question is which of them a class body rule owns — the
class's decorators, its members' and its parameters', member names, the heritage clause. Whatever
the answer, a member's docstring stays outside the search: a `comment()` rule must not start
reading documentation, and 0300's CONTROL pins that.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/conditions/class-body-rules-skip-decorator-arguments.test.ts` ·
      `it('KNOWN GAP — a class body rule does not read decorator arguments, computed member names or the extends expression')`.
      It asserts the method's read IS reported, so it cannot pass over a rule that reports
      nothing. 0300's `noProcessEnv` test excludes a member decorator argument from its exact set
      too, so a fix turns both red.
- [ ] a ruling on which of them a class body rule reads
- [ ] the fix, with the KNOWN-GAP test inverted into a red-first test
- [ ] `npm run validate` green.

Deferred: none.
