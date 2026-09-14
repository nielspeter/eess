# Bug 0309: a default inside a destructured parameter is not read by the class rules

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test.
- **Severity:** High — **false green.** `noEval` passes `m({ a = eval('x') } = {})` in a class, and
  so does every rule over the class body search — `notContain`, `noSilentCatch`, `noMagicNumbers`.
- **Origin:** found by the enforcement review of
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix, and
  measured then. The class search has read a whole parameter's default since
  [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md); a default
  inside the pattern was never read. The function rules' parameter defaults, first recorded here,
  were split to [0314](./0314-the-function-rules-read-no-parameter-default.md) by #137's second method
  review: either fix can land without the other.
- **Reported:** 2026-09-14

## Symptom

The same code as a plain parameter default and inside a destructured parameter, in a class method:

| code — rule                        | plain default | inside the pattern                 |
| ---------------------------------- | ------------- | ---------------------------------- |
| `eval('x')` — `noEval`             | reported      | **not reported**, object and array |
| `4242 * 2` — `noMagicNumbers`      | reported      | **not reported**                   |
| a silent `catch` — `noSilentCatch` | reported      | **not reported**                   |

The default of the whole pattern — `o({ c } = { c: eval('z') })` — is read, as a plain default is.

## Root cause

`searchClassBody` (`packages/ts/src/helpers/body-traversal.ts`) searches a parameter's
`getInitializer()`, the default of the whole parameter. A default inside the pattern belongs to a
binding element under the parameter's name node, and the name node is not searched.

## Fix

Search a parameter's name node when it is a binding pattern: its binding elements' defaults and
computed property names. Decide at the fix whether `noMagicNumbers`' exemption for a whole-value
default covers a binding element — `{ retries = 3 }` names its value as `retries = 3` does. Today
neither the plain `4242` of a binding element nor `4242 * 2` is read, so either answer adds findings.
0314's fix reads the same patterns in a function's parameters.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/a-destructured-default-is-not-read.test.ts` ·
      `it('KNOWN GAP — a default inside a destructured parameter passes the class rules')`.
- [x] `it('CONTROL — the same code as a plain parameter default is reported')`, which also pins the
      whole pattern's default as read.
- [ ] the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
