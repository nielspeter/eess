# Bug 0314: the function rules read no parameter default

## Status

- **State:** Fixed — the function search reads what a function's parameters run at each call, after
  its body, and `functionNoSilentCatch` reads the same and a concise arrow's body. Red test first. The
  record's comment question is split to [0325](../0325-the-class-search-reads-no-comment-on-a-parameter.md).
- **Severity:** High — **false green.** `functionNoEval` passed `function f(g = eval('w'))`, plain or
  destructured, and so did every function rule: they read a function's body only. The `recommended`
  preset runs `functionNoEval`, `functionNoFunctionConstructor` and `functionNoSilentCatch`
  (`packages/ts/src/presets/recommended.ts:48`, `:58`, `:68`), and `agentGuardrails` runs
  `notContain` and `functionNoGenericErrors` over functions.
- **Origin:** found on 2026-09-14 by the CONTROL written for
  [0309](./0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md), recorded
  there, and split out by #137's second method review.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-19

## Symptom

`functionNoEval()` over one file, on 0.6.0:

| function                                              | reported |
| ----------------------------------------------------- | -------- |
| `function plain(g = eval('w')) { … }`                 | **no**   |
| `function destructured({ g = eval('w') } = {}) { … }` | **no**   |
| `function body() { return eval('v') }`                | yes      |

`functionNoSilentCatch` reported a silent `catch` in a block body only: not one in a parameter's
default, and not one in a concise arrow's body, `() => [0].map(() => { try { … } catch { … } })`, which
it skipped whole. A requirement failed the other way: `contain(call('legacy'))` reported
`function f(g = legacy())` as missing the call.

## Root cause

The function rules search `ArchFunction.getBody()` (`packages/ts/src/models/arch-function.ts:53`),
which is the body alone: no parameter is read. `functionNoSilentCatch`
(`packages/ts/src/rules/errors.ts:79`) does not use the function search: it walked a block body
itself, and skipped any body that was not a block.

## Fix

`codeOfParameters` (`packages/ts/src/helpers/body-traversal.ts:321`) returns what a function's
parameters run at each call: for each parameter its default, then in a destructured parameter each
binding element's computed key and default at any depth — the order they run, as
`bindingPatternMatches` (`:299`) reads a class member's for [0309](./0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md).
Two sites read it:

- `searchFunctionBody` (`:427`) searches each of them with `findMatchesInExpression` after the body
  (`:483`), so every function rule built on it — `notContain`, `contain`, `useInsteadOf`, the security,
  error and TypeScript function rules, and the sibling smells — reads them, and a finding a baseline
  accepted in the body keeps its identity; the new one is numbered after it.
- `functionNoSilentCatch` walks the body whatever its kind, then the same parameter code
  (`packages/ts/src/rules/errors.ts:89`).

A constructor's parameter property is a parameter, so `constructor(readonly f = eval('w')) {}` is read
since [0315](./0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md)
collects the constructor. The metrics measure a body's shape and are unchanged.

**The comment question, split.** The record asked the function and class searches to agree on a
comment in a parameter's default. Measured on 0.6.0, the function search reads a comment on a
parameter and one inline in its default — a comment matcher starts at the declaration
(`packages/ts/src/helpers/body-traversal.ts:449`) — and the class search reads neither, though it reads
a comment in a member's body. The gap is the class search's, and closing it moves the class rules'
comment identities, a separate change: [0325](../0325-the-class-search-reads-no-comment-on-a-parameter.md).

**The comment start, decided.** For a function-valued property, the declaration a comment matcher
starts at is the property declaration, its decorators and type annotation included (0315's choice, so a
docstring above the property is read). A comment trailing such a decorator is therefore read by the
function rules, as it is by the class rules since
[0307](./0307-class-body-rules-skip-class-code-outside-its-members.md). Kept: it is the
declaration a reader writes the function's comment on.

**It is a behaviour change.** A green function rule can report findings in parameters, and a
requirement can be met by one. The changeset marks it breaking.

## Verification

- [x] Red test first — the KNOWN-GAP test filed with this record asserted the gap; the new tests below
      were each red on 0.6.0's source, four of four, and the KNOWN-GAP file is replaced, as
      [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md)'s was.
- [x] The fix turns them green —
      `packages/ts/tests/rules/a-function-rule-reads-its-parameter-defaults.test.ts` ·
      `it('functionNoEval reports eval in a default, a destructured default and a computed key')`,
      `it('a finding in the body keeps its identity, and a default’s is numbered after it')`,
      `it('functionNoSilentCatch reads a default and a concise arrow’s body')` and
      `it('a requirement is met by a call in a default')`.
- [x] The eess-ts suite passes with the fix: 3,793 of 3,793 tests in 307 files.
- [x] Sabotage matrix in the worktree, sources restored by sha256 and the tree unchanged: the function
      search reading no parameter turns the eval, order and requirement tests red; the catch rule
      reading a block body only turns the catch test red; no destructured pattern turns the eval test
      red; parameters read before the body turn the order test red.
- [ ] deferred→0325 — the comment question: the class search reads no comment on a parameter; 0325
      pins the gap with a KNOWN-GAP test.
- [x] `npm run validate` green.

Deferred: 0325.
