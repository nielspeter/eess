# Bug 0314: the function rules read no parameter default

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green.** `functionNoEval` passes `function f(g = eval('w'))`, plain or
  destructured, and so does every function rule: they read a function's body only. The `recommended`
  preset runs `functionNoEval`, `functionNoFunctionConstructor` and `functionNoSilentCatch`
  (`packages/ts/src/presets/recommended.ts:48`, `:58`, `:68`).
- **Origin:** found on 2026-09-14 by the CONTROL written for
  [0309](./fixed/0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md), recorded
  there, and split out by #137's second method review.
- **Reported:** 2026-09-14

## Symptom

`functionNoEval()` over one file:

| function                                              | reported |
| ----------------------------------------------------- | -------- |
| `function plain(g = eval('w')) { … }`                 | **no**   |
| `function destructured({ g = eval('w') } = {}) { … }` | **no**   |
| `function body() { return eval('v') }`                | yes      |

## Root cause

The function rules search `ArchFunction.getBody()` (`packages/ts/src/models/arch-function.ts:46`),
which is the body alone: no parameter is read.

## Fix

Read a function's parameter defaults, as
[0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md) did for class
members, including the defaults inside a binding pattern that 0309 reads for class members.

#138's architecture review names two things the fix must also cover. `bindingPatternMatches` in
`packages/ts/src/helpers/body-traversal.ts` reads a destructured parameter for the class search and
is kept apart from it so this search can use it. And `functionNoSilentCatch`
(`packages/ts/src/rules/errors.ts`) does not use `searchFunctionBody` — it reads a block body itself
— so fixing the function search alone leaves its parameters unread. The two searches also disagree on
comments in a parameter default: the function search starts a comment matcher at the declaration,
and the class search reads none there; the fix should make them agree.

Since [0315](./fixed/0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md)
the function rules collect a class's constructor, so the defaults this fix reads include a
constructor's, a parameter property's among them: `constructor(readonly f = eval('w')) {}` passes
today. And that comment matcher starts at `triviaRoot(fn.getNode())`
(`packages/ts/src/helpers/body-traversal.ts:421`), which for a function-valued property is the whole
property declaration — its decorators and type annotation, not only the function — as #140's
architecture review noted; the comment question has to settle that start too.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/a-function-rule-reads-no-parameter-default.test.ts` ·
      `it('KNOWN GAP — the function rules read no parameter default, plain or destructured')`.
- [x] `it('CONTROL — a read in a function body is reported')`
- [ ] the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
