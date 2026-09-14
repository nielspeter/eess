# Bug 0308: the security rules miss a global read through a cast, a non-null assertion or a second global object

## Status

- **State:** Fixed — the name reading reads through `as`, `<T>`, `satisfies` and `!`, and drops
  every leading global object, for all four rules; red test first.
- **Severity:** High — **false green.** Without Node's types, `globalThis.process` does not
  type-check, so `(globalThis as any).process.env` is the ordinary TypeScript spelling of the
  global-object read that
  [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md) reports — and it
  passed `noProcessEnv`. `(globalThis as any).eval('1')` passed `noEval` the same way.
- **Origin:** found by the enforcement review of 0297's fix, measured then. The second global
  object (`window.self.eval`) was a limit stated in a source comment since
  [0301](./0301-security-rules-match-one-spelling-and-the-floor-inherits-it.md).
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. One function per spelling; each rule's direct spelling was reported:

| rule                   | reported        | not reported                                                                                                           |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `functionNoProcessEnv` | `process.env.A` | `(globalThis as any).process.env.B`, `(process as { env: object }).env`, `process!.env.C`, `window.self.process.env.D` |
| `functionNoEval`       | `eval('1')`     | `(globalThis as any).eval('1')`                                                                                        |

The class and module variants, and the `Function` and `console` rules, share the name reading.

## Root cause

The rules in `packages/ts/src/rules/security.ts` read a global's name through `chainOf`, which
understood an identifier, parentheses, a property access and a string-keyed element access. A
type assertion (`as`, `<T>`), a `satisfies` expression and a non-null assertion (`!`) read as no
name at all, although none of them changes the value at run time. `globalNameOf` then dropped one
leading global object, so `window.self.process.env` read as `self.process.env`.

## Fix

The record left two parts undecided. The rulings, and what was built:

- **Type-only wrappers — read through, for all four rules at once.** `chainOf` reads an `as`
  expression, a `<T>` assertion, a `satisfies` expression and a non-null assertion as the
  expression each wraps. The record called this a release decision for all four rules; it is
  taken here with a test per rule and a `minor` changeset marked breaking, which names every rule
  and the `recommended` floor.
- **Leading global objects — drop all of them.** Each name in the set is the global in some
  runtime, and a run of them still is: `window.self`, `self.window`, `globalThis.window`.
  `globalNameOf` drops leading global objects until the chain starts with another name. Only
  leading names: `settings.window.process.env` is not the global, and a CONTROL pins it.

The CONTROL also pins what reading through a cast must not do: a cast of a local
(`(settings as any).env`) or of `this` is not the global, and neither is a method of a cast object
(`(obj as any).eval('1')`).

Not changed: the rules read names, not bindings, so a local named `window` or `process` is still
read as the global, cast or not — that is
[0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md).

## Verification

- [x] Red test first — `packages/ts/tests/rules/security-rules-read-through-casts.test.ts`, the
      KNOWN-GAP test inverted into one test per rule and a CONTROL, and run before the fix:
      `functionNoProcessEnv` reported `[envDot]` of seven, `functionNoEval` `[evalDirect]` of five,
      `functionNoFunctionConstructor` `[fnNew]` of four, `functionNoConsole` `[logDirect]` of four;
      the CONTROL passed.
- [x] The fix turns them green —
      `it('functionNoProcessEnv reads process.env through a type assertion, a non-null assertion and a second global object')`,
      `it('functionNoEval reads eval through a type assertion, a non-null assertion and a second global object')`,
      `it('functionNoFunctionConstructor reads Function through a type assertion, a non-null assertion and a second global object')`
      and
      `it('functionNoConsole and functionNoConsoleLog read console through a type assertion, a non-null assertion and a second global object')`,
      each an exact sorted list, with
      `it('CONTROL — a cast of a local or of this, a global name after the first segment, and a method of a cast object are not the global')`
      still green. The full `packages/ts` suite passes.
- [x] Sabotage matrix in the 0308 worktree (per-entry `node_modules`, `@nielspeter/eess` resolved
      to the worktree’s `packages/core`, literal replacements in `security.ts` restored by sha256
      after every row, verdicts read by test title over this file, 0297’s spelling tests and
      0305’s tests): **10 rows, 0 mismatches**, every row as predicted on its first run. Baseline
      green. Both halves reverted reds the four rule tests only. Leaving `as` or the non-null
      assertion unread reds all four; leaving `satisfies` or `<T>` unread reds the `process.env`
      test, the only one with those spellings; dropping one leading global object reds all four.
      Over-broad — dropping a name that precedes a global object, or reading `this` as the global —
      reds the CONTROL only. A total break reds the four rule tests and every 0297 and 0305 test
      but the `import.meta.env` CONTROL. 0297’s and 0305’s tests stay green in every other row.
- [x] `npm run validate` green.

Deferred: none.
