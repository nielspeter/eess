# Bug 0300: class-body search reads methods, constructors and accessors only

## Status

- **State:** Fixed — every class-level body rule searches the code each member runs: bodies,
  parameter defaults, property initializers and static blocks; red test first.
- **Severity:** High — **false green.** Every class-level body rule missed code in a field
  initializer, a static field, a constructor parameter default, a static block and an
  arrow-function property. In a class written for dependency injection, a field initializer is
  the ordinary place to read configuration.
- **Origin:** found by review of the records filed with it
  ([0297](../0297-no-process-env-reads-one-spelling-of-an-environment-read.md)), measured then.
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

`searchClassBody` walks the code each member runs: every method, constructor and accessor — each
parameter's default, then the body — then every property initializer, which covers an
arrow-function property, then every static block. The groups keep their old order, so the findings
the old walk reported keep theirs.

The record first proposed walking the whole class node. The fix deliberately does not: the class
node also holds decorators and docstrings, which are not member code, and a `comment()` rule would
start reporting documentation. A CONTROL pins that a docstring is still not read.

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

The JSDoc that said "in class methods" and the doc lines that listed what class variants scan were
corrected to the walk. The changeset is a `minor` marked breaking: a green class rule may report
findings in these positions.

## Verification

- [x] Red test first —
      `packages/ts/tests/conditions/class-body-search-skips-member-initializers.test.ts`, its
      KNOWN-GAP tests inverted into the target behaviour. Measured as matrix row R1, which puts the
      shipped walk from `e17c7e6` back: `noProcessEnv` reported lines `{9, 10}` of eight, `noEval`
      `{3}` of two, `classContain` reported both classes, while
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
      full `packages/ts` suite passes.
- [x] Sabotage matrix in the 0300 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree's `packages/core`, literal replacements in `body-traversal.ts` restored by
      sha256 after every row, verdicts read by test title): **10 rows, 0 mismatches.** Baseline
      green. R1, the shipped walk restored, reds the three target tests and both guards. Dropping
      parameter defaults reds `noProcessEnv` only; dropping property initializers reds everything
      but the CONTROL; dropping static blocks reds `noProcessEnv` only. Never counting an
      initializer's root reds `noEval` and `classContain`. Counting a broad root despite an inner
      match reds the broad guard only; dropping the trivia branch reds the trivia guard only.
      Over-broad — searching the whole class node — reds `noProcessEnv` (the decorator argument)
      and the CONTROL (the docstring). A total break reds all six. Two first-run errors were the
      matrix's, not the fix's, and are recorded: the over-broad row's search string was not
      unique, and was re-anchored; the trivia test's first fixture put the comment on the line of
      `=`, where ts-morph reads it as that token's trailing trivia, so the test was red at baseline
      — the comment was moved to its own line before the rows were run again.
- [x] `npm run validate` green.

Deferred: none.
