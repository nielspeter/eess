# Bug 0308: the security rules miss a global read through a cast, a non-null assertion or a second global object

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test.
- **Severity:** High — **false green.** Without Node's types, `globalThis.process` does not
  type-check, so `(globalThis as any).process.env` is the ordinary TypeScript spelling of the
  global-object read that
  [0297](./fixed/0297-no-process-env-reads-one-spelling-of-an-environment-read.md) now reports —
  and it passes `noProcessEnv`. `(globalThis as any).eval('1')` passes `noEval` the same way.
- **Origin:** found by the enforcement review of 0297's fix, measured then. The second global
  object (`window.self.eval`) was a limit stated in a source comment since
  [0301](./fixed/0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md), and is
  recorded here with the rest.
- **Reported:** 2026-09-14

## Symptom

One function per spelling; each rule's direct spelling is reported:

| rule                   | reported        | not reported                                                                                                           |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `functionNoProcessEnv` | `process.env.A` | `(globalThis as any).process.env.B`, `(process as { env: object }).env`, `process!.env.C`, `window.self.process.env.D` |
| `functionNoEval`       | `eval('1')`     | `(globalThis as any).eval('1')`                                                                                        |

The class and module variants, and the `Function` and `console` rules, share the name reading.

## Root cause

The rules in `packages/ts/src/rules/security.ts` read a global's name through `chainOf`, which
understands an identifier, parentheses, a property access and a string-keyed element access. A
type assertion (`as`, `<T>`), a `satisfies` expression and a non-null assertion (`!`) read as no
name at all, although none of them changes the value at run time. `globalNameOf` then drops one
leading global object, so `window.self.process.env` reads as `self.process.env`.

## Fix

Not decided, in two parts:

- **Type-only wrappers** — reading through `as`, `<T>`, `satisfies` and `!` changes all four
  rules at once, so it is a release decision for all of them, with the tests for each.
- **A second global object** — how many leading global objects to drop, given that
  `window.self` and `self.window` are both the global in a browser.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/security-rules-miss-a-global-read-through-a-cast.test.ts` ·
      `it('KNOWN GAP — a global read through a type assertion, a non-null assertion or a second global object is not reported')`.
      It asserts each rule's direct spelling IS reported, so it cannot pass over a rule that
      reports nothing.
- [ ] a ruling on both parts
- [ ] the fix, with the KNOWN-GAP test inverted into a red-first test
- [ ] `npm run validate` green.

Deferred: none.
