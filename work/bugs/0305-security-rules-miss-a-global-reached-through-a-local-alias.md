# Bug 0305: the `eval`, `Function` and `console` rules miss a global reached through a local alias

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test. The fix needs a
  decision shared with [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md).
- **Severity:** High — **false green.** `const F = Function; F('return 1')()` passes the
  `recommended` floor every adopter installs, and `const { log } = console` passes
  `noConsole`, which is an ordinary refactor rather than an evasion.
- **Origin:** self-found · split from
  [0301](./fixed/0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md) when
  it was fixed, because this half needs a design decision and that half did not.
- **Reported:** 2026-09-14

## Symptom

One function per spelling; each rule's direct spelling is reported, the aliased one is not.
Measured by the test under Verification:

| rule                            | reported         | not reported                          |
| ------------------------------- | ---------------- | ------------------------------------- |
| `functionNoEval`                | `eval('1')`      | `const ev = eval; ev('1')`            |
| `functionNoFunctionConstructor` | `new Function()` | `const F = Function; F('return 1')()` |
| `functionNoConsole`             | `console.log(1)` | `const { log } = console; log(1)`     |

The class and module variants share the matchers, so they share the gap.

## Root cause

Since 0301 the rules in `packages/ts/src/rules/security.ts` read the global's name
structurally at the site of use — through a global object, a string-keyed bracket, an
indirect call. A local binding changes the name at the site of use to one that is not the
global's (`ev`, `F`, `log`), and nothing follows the binding back to what initialised it.

## Fix

Not decided. Following a binding means deciding how far:

- a `const` initialised with the global, or destructured from it — the shapes above;
- `let` and later reassignment, parameters, and module-level aliases imported elsewhere;
- and what an unresolved binding means — it must fall back to the lexical match, never to
  "no match".

[0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md) asks the same
question for `const { env } = process` and `import { env } from 'node:process'`. Answer it
once, for both records.

## Verification

- [x] a KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/security-rules-miss-a-global-reached-through-an-alias.test.ts` ·
      `it('KNOWN GAP — an eval, Function or console reached through a local alias or destructuring is not reported')`.
      It asserts each rule's direct spelling IS reported, so it cannot pass over a rule that
      reports nothing.
- [ ] a ruling on how far a binding is followed, shared with 0297
- [ ] the fix, with the KNOWN-GAP test inverted into a red-first test
- [ ] `npm run validate` green.

Deferred: none.
