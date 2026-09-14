# Bug 0305: the `eval`, `Function` and `console` rules read names, not bindings — they miss an alias and report a shadow

## Status

- **State:** Draft — reproduced in both directions, and pinned by KNOWN-GAP tests. The fix
  needs a decision shared with
  [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md).
- **Severity:** High — **false green.** `const F = Function; F('return 1')()` passes the
  `recommended` floor every adopter installs, and `const { log } = console` passes
  `noConsole`, which is an ordinary refactor rather than an evasion. The other direction is a
  **false red**: a local declaration that shadows a global is reported as the global.
- **Origin:** self-found · split from
  [0301](./fixed/0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md) when it
  was fixed, because this half needs a design decision and that half did not. The
  false-positive direction was added from 0301's independent review.
- **Reported:** 2026-09-14

## Symptom

**A global bound to a local name is missed.** One function per spelling; each rule's direct
spelling is reported, the aliased one is not:

| rule                            | reported         | not reported                          |
| ------------------------------- | ---------------- | ------------------------------------- |
| `functionNoEval`                | `eval('1')`      | `const ev = eval; ev('1')`            |
| `functionNoFunctionConstructor` | `new Function()` | `const F = Function; F('return 1')()` |
| `functionNoConsole`             | `console.log(1)` | `const { log } = console; log(1)`     |

**A local name that shadows a global is reported.** None of these touches a global:

| rule                            | reported, wrongly                                           | since       |
| ------------------------------- | ----------------------------------------------------------- | ----------- |
| `functionNoFunctionConstructor` | `function Function(a: number) { … }; Function(1)`           | 0301's fix  |
| `functionNoFunctionConstructor` | `class Function { … }; new Function(1)`                     | before 0301 |
| `functionNoConsole`             | `const console = { log: (n: number) => n }; console.log(1)` | before 0301 |

The bare call is new: before 0301 only `new Function(…)` was matched, so a call to a local
`Function` was never checked. The class and module variants share the matchers, so they share
both directions.

## Root cause

Since 0301 the rules in `packages/ts/src/rules/security.ts` read the global's name structurally
at the site of use — through a global object, a string-keyed bracket, an indirect call. They do
not ask what the name is bound to. A local binding changes the name at the site of use to one
that is not the global's (`ev`, `F`, `log`), so an alias is missed; and a local declaration keeps
the global's name while binding something else, so a shadow is reported.

## Fix

Not decided. Following a binding means deciding how far:

- a `const` initialised with the global, or destructured from it — the aliases above;
- `let` and later reassignment, parameters, and module-level aliases imported elsewhere;
- a local declaration of the same name — a function, class, variable or parameter — which is
  not the global;
- and what an unresolved binding means — it must fall back to the lexical match, never to
  "no match", so a missing type definition cannot turn a rule off.

[0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md) asks the same question
for `const { env } = process` and `import { env } from 'node:process'`. Answer it once, for both
records.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour, one per direction —
      `packages/ts/tests/rules/security-rules-miss-a-global-reached-through-an-alias.test.ts` ·
      `it('KNOWN GAP — an eval, Function or console reached through a local alias or destructuring is not reported')`
      and
      `it('KNOWN GAP — a local declaration that shadows Function or console is reported as the global')`.
      The first asserts each rule's direct spelling IS reported, so it cannot pass over a rule
      that reports nothing; the second asserts exact sets that exclude an unrelated function.
- [ ] a ruling on how far a binding is followed, shared with 0297
- [ ] the fix, with both KNOWN-GAP tests inverted into red-first tests
- [ ] `npm run validate` green.

Deferred: none.
