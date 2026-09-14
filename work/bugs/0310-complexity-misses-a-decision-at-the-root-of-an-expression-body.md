# Bug 0310: cyclomatic complexity does not count a decision at the root of an expression body

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** Medium — an under-measure by one. `(a, b) => a && b`, `(a) => a ?? 0` and
  `(a) => a ? 1 : 2` measure complexity 1; the same decision inside parentheses or a block measures 2.
  A ceiling passes such a function at one over. Prettier wraps an arrow's conditional body in
  parentheses, so formatted code hides the ternary case, but not `&&`, `||` or `??`.
- **Origin:** found by the enforcement review of
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix, which
  made the metrics rules measure arrow-function properties, and measured then. The helper has always
  counted this way.
- **Reported:** 2026-09-14

## Symptom

`maxCyclomaticComplexity(1)` over one class:

| property                                | measured | reported |
| --------------------------------------- | -------- | -------- |
| `onAnd = (a, b) => a && b`              | **1**    | **no**   |
| `onNullish = (a) => a ?? 0`             | **1**    | **no**   |
| `onTernary = (a) => a ? 1 : 2`          | **1**    | **no**   |
| `onParen = (a) => (a ? 1 : 2)`          | 2        | yes      |
| `onBlock = (a) => { return a ? 1 : 2 }` | 2        | yes      |

## Root cause

`cyclomaticComplexity` iterates `body.getDescendants()`
(`packages/ts/src/helpers/complexity.ts:39`), which excludes the body node itself. A block body is
never a decision, so only an expression body loses its root. The same helper measures a function for
the `haveComplexity` predicate; that path was not measured.

## Fix

Count the body node as well as its descendants. Findings on an expression-bodied function whose root
is a decision rise by one.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/a-root-decision-is-not-counted.test.ts` ·
      `it('KNOWN GAP — an expression body that is itself a decision measures complexity 1')`.
- [x] `it('CONTROL — the same decision one node below the body is counted')`
- [ ] the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
