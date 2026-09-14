# Bug 0307: class body rules skip class code outside its members

## Status

- **State:** Fixed — a class body rule that forbids something reads all the code a class runs,
  including every decorator expression, computed member names and the `extends` expression; one
  that requires something reads member code only. Red test first.
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
— bodies, parameter defaults, property initializers and static blocks. Decorators, computed member
names and the `extends` expression are none of those: they run when the class is defined. They
were not read before 0300 either.

## Fix

**How the ruling was reached.** The record left open which of these a class body rule reads. On
2026-09-14 the maintainer asked for it to be settled on what makes sense rather than put to them as
a question. The first ruling, in #136's first commit, drew a syntactic line: read what a class
supplies — decorator arguments, computed names, the arguments of `extends` — and not the wiring they
are supplied to, so that `@Validate()` alone could not satisfy `classMustCall(/validate/i)`. #136's
enforcement review showed that line does not hold. A DI token is wiring passed as an argument:
`constructor(@Inject(getRepositoryToken(User)) …)` made `classMustCall(/Repository/)` pass on a
service that never calls a repository, red before the change and green after. A cut between callee
and argument cannot tell behaviour from wiring. The ruling below replaces it; it is that review's
first option, and it stands as the re-review of #136 ratifies it.

**The ruling: fail closed in each direction.** For a rule about what a class must NOT contain —
`notContain`, the banned half of `useInsteadOf`, and every rule built on them — reading more can only
report more, so it reads all the code the class runs: member code, every decorator expression on
the class, its members, accessors and parameters, computed member names and the whole `extends`
expression. For a rule about what a class MUST contain — `contain`, `classMustCall`, the replacement
half of `useInsteadOf` — reading less is what fails closed, so it reads member code only, and a
decorator, a DI token, a computed name or a base class never satisfies it. `implements` is
type-only and docstrings are not code, so neither is read.

That also removes every limit the first ruling had to state. A must-not-contain rule now reads
`extends (eval('Base'))`, a cast or non-null assertion in the wiring (`extends (Base as any)`,
`extends registry.Base!`), a ternary, element access or method chain in `extends` or a decorator,
and a comment inside a decorator's argument list.

**Built.** `searchClassBody` takes a required `reach` — `'member-code'` or `'all-code'` — so every
caller decides: `classContain` and the replacement half of `classUseInsteadOf` pass `'member-code'`;
`classNotContain` and the banned half pass `'all-code'`.

**Ordering, for baselines.** A match's identity is numbered within its enclosing declaration, and a
declaration is known by its name, so a getter and its setter, or a static and an instance member of
one name, share one — measured by the enforcement review. The first version searched member by
member, so a new read in one member could take the ordinal of an accepted read in its same-named
twin; 0300's parameter defaults, merged but unreleased, had the same defect. The walk now runs in
three passes over all members: every method, constructor and accessor body, which is what it read
before 0300, in the same order; then every parameter default, property initializer and static
block, which 0300 added; then, for `'all-code'`, every decorator, computed name and the `extends`
expression. A test pins each pairing, including a getter and setter and a static and an instance
member. The first version of this record also claimed a computed name has a scope of its own; the
method review measured that it shares its method's.

The descriptions were brought into line: the `contain()` and `notContain()` JSDoc on the class
builder, `classContain` and `classNotContain`, the class rules in `rules/typescript` and
`rules/security`, the class walk and the `contain`/`notContain` rows in `docs/standard-rules.md`,
`docs/api-reference.md`, `docs/body-analysis.md` and `docs/classes.md`, and the `classMustCall`
rows, which still said "at least one class method". The pending 0300 changeset no longer lists these
positions as unsearched, and says the ordering in its three-pass form.

## Verification

- [x] A ruling on which of them a class body rule reads — above, with how it was reached.
- [x] Red test first — the first target tests were run against `2630112` before the first fix: the
      positions test reported line `['6']` of eleven findings; the wiring test reported all four
      classes; the ordinal test saw lines `['4', '8']` of four; the docstring CONTROL passed. The
      redesign's tests are measured red against the same shipped walk as matrix row R0, below.
- [x] The fix turns them green —
      `it('noProcessEnv on a class reads decorator arguments, computed member names and the arguments of extends')`,
      `it('a must-not-contain rule reads the whole extends and decorator expressions')`,
      `it('a must-contain rule is satisfied only by member code, never by a decorator, a DI token, a computed name or a base class')`,
      `it('a must-not-contain rule reports the same calls wherever the class runs them')` and
      `it('a finding the walk read before keeps its ordinal, even beside a member of the same name')`,
      with `it('CONTROL — a docstring above a decorator is still not read')` and
      `it('CONTROL — implements is type-only and is not read')` green. 0300’s `noProcessEnv` test
      expects the decorator argument on its line 12. The `packages/ts` suite passes, and tsc and
      eslint are clean.
- [x] Sabotage matrix in the 0307 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `body-traversal.ts` restored by
      sha256 after every row, verdicts read by test title over this file and 0300’s): **17 rows, 0
      mismatches**. Baseline green. R0 restores the shipped walk from `2630112` and R1 switches the
      0307 pass off: each reds the positions, whole-expression, must-not-contain and ordinal tests
      and 0300’s `noProcessEnv` test, while the must-contain test stays green, because the shipped
      walk read member code only. Letting a must-contain search read everything reds the
      must-contain test only. Removing one 0307 search at a time reds the positions test, and also:
      parameter decorators the must-not-contain test (the DI token); member decorators the ordinal
      test; computed method names the must-not-contain and ordinal tests; property decorators
      0300’s `noProcessEnv` test; class decorators the whole-expression, must-not-contain and
      ordinal tests; the `extends` expression the whole-expression and must-not-contain tests. Each
      of the three orderings — defaults before bodies, static blocks after the class decorator, the
      0307 pass before the bodies — reds the ordinal test, and the first also 0300’s ordinal test.
      Over-broad — the decorator node read with its leading trivia, or `implements` read — reds the
      matching CONTROL only. A total break reds every test in both files but the `implements`
      CONTROL and 0300’s kind-guard test, which both expect nothing.
- [x] `npm run validate` green.

Deferred: none.
