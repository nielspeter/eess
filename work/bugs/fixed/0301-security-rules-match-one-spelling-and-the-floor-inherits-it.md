# Bug 0301: the `eval`, `Function` and `console` rules match one spelling, and the `recommended` floor inherits it

## Status

- **State:** Fixed — every variant of the three rules, and the `recommended` floor, reads the
  global however its name is spelled at the site of use; red test first. The spellings that
  reach the global through a local alias are split to
  [0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md).
- **Severity:** High — **false green in the preset every adopter installs.**
  `recommended()` passed `Function('return 1')()`, which is the same operation as
  `new Function('return 1')()` — the rule's own docs describe it as "equivalent to
  eval". It also passed `globalThis.eval('1')`.
- **Origin:** found by review of
  [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md), and
  measured then.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-14

## Symptom

As reported. Function variants, one function per spelling:

| rule                            | reported                      | not reported                                                                        |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `functionNoEval`                | `eval('1')`                   | `globalThis.eval('1')`, `(0, eval)('1')`, `const ev = eval; ev('1')`                |
| `functionNoFunctionConstructor` | `new Function()`              | `Function()`, `new globalThis.Function()`                                           |
| `functionNoConsole`             | `console.log(1)`              | `const { log } = console; log(1)`, `console['log'](1)`, `globalThis.console.log(1)` |
| `functionNoConsoleLog`          | `console.log(1)`              | the same three                                                                      |
| `recommended()`                 | `eval('1')`, `new Function()` | the other five `eval` and `Function` spellings                                      |

## Root cause

Each rule in `packages/ts/src/rules/security.ts` was a lexical matcher over the callee's
text: `call('eval')`, `newExpr('Function')` — which matches only a `NewExpression`, so a
call without `new` was invisible — `access(/^console\./)` and `call('console.log')`. The
class, function and module variants shared them, and `recommended()` uses the eval and
Function rules (`packages/ts/src/presets/recommended.ts:48`, `:58`). The line pointers this
record carried into `security.ts` were removed at close: the matchers they named no longer
exist.

## Fix

The rules read the name structurally, through matchers private to `security.ts` — the public
`call()` and `access()` keep promising a text match, because adopters' own rules depend on it:

- `chainOf` reads an expression as a dotted name: `x?.y` and a string-keyed `x['y']` read as
  `x.y`, the indirect `(0, x)` reads as `x`, and `this.x` or a computed key reads as nothing.
- `globalNameOf` drops a leading global object — `globalThis`, `window`, `self`, `global` —
  and nothing else, so `obj.eval` is never the global `eval`.
- `globalCall` backs `noEval` and both `console.log` rules; `functionConstructor` matches the
  global `Function` as a call **or** a `new`; `consoleAccess` matches property and bracketed
  members of the global `console`.

`noEval`, `noConsoleLog` and `noConsole` keep their descriptions, so their messages and
baseline identities are unchanged. `noFunctionConstructor`'s description changes from
`new 'Function'` to `Function constructor`, because it now matches a call too; the changeset
says a baselined finding of that rule is reported once more. `docs/standard-rules.md` and
`docs/api-reference.md` describe the spellings covered and the one that is not. The changeset
is a `minor` marked breaking: the floor reports more.

## Verification

- [x] Red test first — `packages/ts/tests/rules/security-rule-spellings.test.ts`, run against
      the shipped matchers before the fix: five tests failed for the reason they exist —
      `functionNoEval` reported `{evalCall, evalOptionalCall}` of five spellings,
      `functionNoFunctionConstructor` `{functionNew}` of four, both console rules
      `{consoleLog}` of four, the floor three of nine, and the class and module variants
      nothing — while
      `it('CONTROL — a member named eval, Function or console on an ordinary object is not the global')`
      passed, as it must before and after.
- [x] The fix turns them green:
      `it('functionNoEval reports eval through a global object, a bracket, an optional call and an indirect call')`,
      `it('functionNoFunctionConstructor reports Function with or without new, and through a global object')`,
      `it('functionNoConsole and functionNoConsoleLog report console through a bracket and a global object')`,
      `it('the recommended floor reports every eval and Function spelling')` and
      `it('the class and module variants read the same spellings')`. The existing security
      tests, including the description pins in `packages/ts/tests/rules/security.test.ts`,
      pass unchanged.
- [x] The KNOWN-GAP file that pinned this record (`security-rules-match-one-spelling.test.ts`)
      is removed; its alias assertions moved to 0305's pin.
- [x] Sabotage matrix in an isolated worktree (per-entry `node_modules`, `@nielspeter/eess`
      proven to resolve inside it, verdicts read by test title), 8 rows over the two test files:
      removing the global-object strip, the indirect-call unwrap, the bracket reading, the
      `Function` call kind or the bracketed console member each reds exactly the tests that
      depend on it; a total break reds every guard including 0305's anchors. The over-broad row —
      stripping any leading name — reds the lookalike CONTROL. Its expected set was first
      written without the two tests it also reds, because stripping `console.` breaks the
      console rules as well; the set was corrected from that reasoning and the row re-run.
- [x] `npm run validate` green.
- [x] Independent review (enforcement lens, a different model than the author), no critical
      findings, each disposed:
  - **A false positive this fix opened.** A local function named `Function`, called without
    `new`, is now reported as the constructor; before, only `new Function(…)` was matched, so
    that bare call was never checked. A local `class Function` used with `new`, and a local
    `const console = {…}`, were reported before this fix and still are. All three are the other
    direction of the question 0305 holds — a local binding decides whether a name is the
    global — so they are recorded there and pinned by a KNOWN-GAP test, not fixed here.
  - **A stale doc row.** `docs/api-reference.md` still described `functionNoFunctionConstructor`
    as `new Function()` only; corrected in this change.
  - **A limit, stated rather than filed** (filed later as [0308](./0308-security-rules-miss-a-global-read-through-a-cast.md), and fixed): only one leading global object is read through, so
    `window.self.eval('1')` is not reported. Nothing but a deliberate evasion writes a doubled
    global chain, and the rule is not a defence against a determined author.
- [ ] deferred→[0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md) —
      `const ev = eval`, `const F = Function` and `const { log } = console` reach the global
      through a local binding, which needs the binding followed: the design question 0297
      raises, answered once. Pinned there by a KNOWN-GAP test.

Deferred: [0305](../0305-security-rules-miss-a-global-reached-through-a-local-alias.md)
