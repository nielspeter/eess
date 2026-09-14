# Bug 0309: a parameter default is not read — inside a destructured parameter by the class rules, and at all by the function rules

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** High — **false green.** `noEval` passes `m({ a = eval('x') } = {})` in a class, and
  so does every rule over the class body search — `notContain`, `noSilentCatch`, `noMagicNumbers`.
  `functionNoEval` passes `function f(g = eval('w'))`, destructured or not.
- **Origin:** found by the enforcement review of
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix
  (the destructured shape), and measured then; the function rules' plain default was found by the
  CONTROL written for this record. The class search has read a whole parameter's default since
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md).
- **Reported:** 2026-09-14

## Symptom

The same code as a plain parameter default and inside a destructured parameter:

| code, rule                                     | plain default    | inside the pattern                 |
| ---------------------------------------------- | ---------------- | ---------------------------------- |
| `eval('x')` in a method — `noEval`             | reported         | **not reported**, object and array |
| `4242` in a method — `noMagicNumbers`          | reported         | **not reported**                   |
| a silent `catch` in a method — `noSilentCatch` | reported         | **not reported**                   |
| `eval('w')` in a function — `functionNoEval`   | **not reported** | **not reported**                   |

A class method's default of the whole pattern — `o({ c } = { c: eval('z') })` — is read. A read in a
function's body is reported.

## Root cause

Two readers, two gaps.

- `searchClassBody` (`packages/ts/src/helpers/body-traversal.ts`) searches a parameter's
  `getInitializer()`, the default of the whole parameter. A default inside the pattern belongs to a
  binding element under the parameter's name node, and the name node is not searched.
- The function rules search `ArchFunction.getBody()`
  (`packages/ts/src/models/arch-function.ts:46`), which is the body alone: no parameter is read.

## Fix

Read a function's parameter defaults in the function rules, as 0300 did for class members, and in
both readers search a parameter's name node when it is a binding pattern — its binding elements'
defaults and computed property names. Decide at the fix whether `noMagicNumbers`' exemption for a
whole-value default covers a binding element: `{ retries = 3 }` names its value as `retries = 3`
does. Today neither is read, so either answer adds findings.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/a-parameter-default-is-not-read.test.ts` ·
      `it('KNOWN GAP — a default inside a destructured parameter passes the class rules')` and
      `it('KNOWN GAP — the function rules read no parameter default, plain or destructured')`.
- [x] `it('CONTROL — a plain default in a class and a read in a function body are reported')`
- [ ] the fix, the KNOWN-GAP tests inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
