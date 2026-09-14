# Bug 0300: class-body search reads methods, constructors and accessors only

## Status

- **State:** Fixed — the class body conditions, and every rule built on them, search the code
  each member runs: bodies, parameter defaults, property initializers and static blocks; red test
  first. Two gaps of the same kind, found in review, are filed as
  [0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md) and
  [0307](./0307-class-body-rules-skip-class-code-outside-its-members.md).
- **Severity:** High — **false green.** Every rule built on the class body conditions missed code in a field
  initializer, a static field, a constructor parameter default, a static block and an
  arrow-function property. In a class written for dependency injection, a field initializer is
  the ordinary place to read configuration.
- **Origin:** found by review of the records filed with it
  ([0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)), measured then.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. One class, one `process.env` read per position, all spelled `process.env.X`:

| position                                          | `noProcessEnv()` |
| ------------------------------------------------- | ---------------- |
| field initializer `field = process.env.X`         | **missed**       |
| static field                                      | **missed**       |
| constructor parameter default                     | **missed**       |
| static block                                      | **missed**       |
| arrow-function property `f = () => process.env.X` | **missed**       |
| getter                                            | reported         |
| method                                            | reported         |

And `noEval()` reported nothing for `f = eval('1')` in a field initializer, while it reported the
same call in a method.

## Root cause

`searchClassBody` in `packages/ts/src/helpers/body-traversal.ts` walked exactly three things:
every method's body, the last constructor's body, and get and set accessors. Property
declarations, parameter initializers and static blocks were never walked. `classContain`,
`classNotContain` and `classUseInsteadOf` are built on it, and so is every class variant in
`rules/security`, `rules/errors` and `rules/typescript`, and the class-must-call rule in
`rules/architecture`. The line pointers this record carried were removed at close: the walk they
named was replaced.

## Fix

`searchClassBody` walks the code each member runs: every method, constructor and accessor — its body,
then each parameter's default — then every property initializer, which covers an arrow-function
property, then every static block.

The body comes before the defaults because of baselines. A match's identity is numbered within its
enclosing member, and a member's body and defaults share that member. The first version searched
the defaults first, so a new match in a default took the ordinal of the body match a baseline had
accepted: the baseline hid the new finding and reported the accepted one. The enforcement review
measured that against a baseline written under the old walk; a test now pins the ordinals.

**Correction, 2026-09-14 ([0307](./0307-class-body-rules-skip-class-code-outside-its-members.md)).** Per member is not enough. A
declaration is known by its name, so a getter and its setter, or a static and an instance member of
one name, share one, and a default in one could still take the ordinal of an accepted body in the
other; 0307's enforcement review measured it, and this record's ordinal test stayed green over it.
The walk now searches every body first, then every default, property initializer and static block.

The record first proposed walking the whole class node. The fix deliberately does not: the class
node also holds docstrings, and a `comment()` rule would start reporting documentation. A CONTROL
pins that a docstring is still not read. The class node also holds code no member runs — decorator
arguments, computed member names, the `extends` expression — all evaluated when the class is
defined; leaving them out is a gap, not a design choice, and is [0307](./0307-class-body-rules-skip-class-code-outside-its-members.md). (2026-09-14:
0307 ruled that a must-not-contain rule reads them, and that for a must-contain rule leaving them out
is the design, because wiring must not satisfy it.)

`noSilentCatch`, `noMagicNumbers` and the class metrics rules do not use this search; each walks
its own member list and still misses these positions. That is
[0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md).

**Found while fixing, and fixed with it.** `findMatchesInNode` tests a subtree's descendants, not
its root. That never mattered for a body — a block — but an initializer can itself be the match:
`field = eval('1')`, `tracker = register('x')`. The first run after walking initializers still
missed both. A helper private to `body-traversal.ts`, `findMatchesInExpression`, tests the root
too, for initializers and parameter defaults only. Two branches keep it from reporting a match
twice: a trivia matcher's own walk already includes the root, and a broad matcher counts the root
only when nothing inside it matched, so its deepest-match rule holds. `findMatchesInNode` itself is
unchanged for every other caller.

The trivia branch is redundant for `comment()`, the one trivia matcher shipped, which does not
narrow by kind. It is kept for a custom trivia matcher that does — the `ExpressionMatcher`
interface allows it — which would otherwise be reported twice, and a test pins it.

The descriptions of the old walk were corrected: the JSDoc of the security and typescript class
rules, of `contain()` on the class builder and of `classContain` and `classNotContain`, and the
class body lines in `docs/api-reference.md`, `docs/classes.md`, `docs/body-analysis.md` and
`docs/standard-rules.md`. The first pass corrected only the security JSDoc and two doc lines; the
method review found the rest. The changeset is a `minor` marked breaking, and names every rule and
the one preset rule (`dataLayerIsolation`'s `preset/data/typed-errors`) built on the conditions.

## Verification

- [x] Red test first —
      `packages/ts/tests/conditions/class-body-search-skips-member-initializers.test.ts`, its
      KNOWN-GAP tests inverted into the target behaviour. Measured as matrix row R1, which puts the
      shipped walk from `e17c7e6` back: `noProcessEnv` reported lines `{9, 10}` of eight, `noEval`
      `{3}` of three, `classContain` reported both classes, while
      `it('CONTROL — a docstring is not member code, so a comment rule still reads only the body')`
      stayed green.
- [x] The fix turns them green:
      `it('noProcessEnv on a class reads field initializers, static fields, parameter defaults, static blocks and arrow properties')`,
      `it('noEval on a class reads eval in a field initializer')` and
      `it('classContain counts a call in a field initializer as the class containing it')`, with the
      CONTROL still green. Two tests were added when the root-inclusion helper was written, one per
      branch that keeps it from double-reporting, because nothing else guarded them:
      `it('a broad matcher reports an initializer once, at its deepest match')` and
      `it('a trivia matcher that narrows by kind reports a comment on an initializer once')`. The
      enforcement review added three more, each measured unguarded before it was written:
      `it('a match in a parameter default is numbered after the body match of the same member')`,
      `it('a matcher that narrows by kind is asked only about an initializer of that kind')`, and an
      `eval` default in the `noEval` fixture that is itself the call. Line assertions are sorted
      arrays, not sets, so a duplicated finding shows. The full `packages/ts` suite passes.
- [x] Sabotage matrix in the 0300 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree's `packages/core`, literal replacements in `body-traversal.ts` restored by
      sha256 after every row, verdicts read by test title): **13 rows, 0 mismatches.** Baseline
      green. R1, the shipped walk restored, reds the three target tests, both double-report guards
      and the ordinal test. Dropping parameter defaults reds `noProcessEnv`, `noEval` and the
      ordinal test; dropping property initializers reds everything but the ordinal test, the kind
      test and the CONTROL; dropping static blocks reds `noProcessEnv` only. Never counting an
      initializer's root reds `noEval`, `classContain` and the ordinal test; never counting a
      parameter default's root alone reds `noEval` and the ordinal test. Searching defaults before
      the body reds the ordinal test only. Counting a broad root despite an inner match reds the
      broad guard only; dropping the trivia branch reds the trivia guard only; dropping the kind
      guard reds the kind test only. Over-broad — searching the whole class node — reds
      `noProcessEnv` (the decorator argument), the CONTROL (the docstring) and the ordinal test
      (document order puts the default first). A total break reds all but the kind test, which
      expects nothing. The first run had two errors of the matrix's own, recorded: the over-broad
      row's search string was not unique, and was re-anchored; the trivia test's first fixture put
      the comment on the line of `=`, where ts-morph reads it as that token's trailing trivia, so
      the test was red at baseline — the comment was moved to its own line. The three rows for the
      review findings were added afterwards, and every row was run again with them.
- [ ] deferred→[0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md) —
      `noSilentCatch`, `noMagicNumbers` and the class metrics rules keep their own member walk.
- [ ] deferred→[0307](./0307-class-body-rules-skip-class-code-outside-its-members.md) — decorator arguments,
      computed member names and the `extends` expression are not searched. The method review
      found the first, the enforcement review the other two. Resolved in 0307 (2026-09-14): a
      must-not-contain rule reads them whole; a must-contain rule reads member code only.
- [x] `npm run validate` green.

Deferred: [0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md),
[0307](./0307-class-body-rules-skip-class-code-outside-its-members.md)
