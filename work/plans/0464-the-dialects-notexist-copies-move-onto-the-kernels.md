# Plan 0464: the dialects' `notExist` copies move onto the kernel's

## Status

- **State:** Draft — filed 2026-10-18 as the home of [plan 0456](./completed/0456-kernel-notexist-and-dead-glob.md)'s deferral; rewritten the same day
  after PR #235's third review round (method N3, architect minors, coordinator's decision 8).
- **Scope:** de-duplication only: no proposal ask and no bug depend on it.
  [Bug 0462](../bugs/fixed/0462-a-notexist-whose-evaluate-is-replaced-keeps-its-exemption.md) (a marked condition stays mutable) is fixed for every copy by [plan 0456](./completed/0456-kernel-notexist-and-dead-glob.md)'s freeze at
  marking, so nothing here changes what a gate reports.
- **Priority:** Low.
- **Effort:** Small. Five call sites and their characterisation tests, in two packages.
- **Created:** 2026-10-18
- **Builds after:** [plan 0456](./completed/0456-kernel-notexist-and-dead-glob.md), which adds the kernel's
  `notExistCondition` behind `@nielspeter/eess/internal`. It takes a `name(element, ctx)` and the
  dialect's own `toViolation`, so each copy keeps its finding's shape.

## Problem

The family carries five implementations of one condition, each built by hand on
`marksAssertsCardinality`. [Proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s decision 4 is why it belongs in the kernel: "mermaid and
six ts builders each carry a copy, and md would be the next". After [plan 0456](./completed/0456-kernel-notexist-and-dead-glob.md), md is built on the
kernel's `notExistCondition` and these five are not.

Each copy builds its finding differently. Measured 2026-10-18 on main:

| copy                                                        | name in the message                                                                                        | finding built by                                                                              | code frame |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| eess-ts `packages/ts/src/conditions/structural.ts:145`      | `getElementName(element)`                                                                                  | `createViolation` (`packages/ts/src/core/violation.ts`)                                       | yes        |
| eess-ts `packages/ts/src/conditions/function.ts:56`         | `fn.getName() ?? '<anonymous>'`                                                                            | a literal: `rule`, `element`, `file`, `line`, `message`, `because` only                       | no         |
| eess-ts `packages/ts/src/conditions/call.ts:58`             | `callNameForMessage(archCall, context)`, reading `context.identifyByArgument` (`conditions/call.ts:50-52`) | `createCallViolation` (`conditions/call.ts:19`), a literal of the same six fields             | no         |
| eess-ts `packages/ts/src/conditions/jsx.ts:36`              | `` `<${el.getName()}>` ``                                                                                  | `createJsxViolation`, over `createViolation`                                                  | yes        |
| eess-mermaid `packages/mermaid/src/conditions/class.ts:110` | `` `class ${c.name}` ``                                                                                    | `classViolation`, over mermaid's `createViolation` (`packages/mermaid/src/core/violation.ts`) | yes        |

So the migration is one call per copy, but not "one line each": each passes its own `name` and its
own `toViolation`, and `function.ts`'s literal becomes a local constructor.

**What holds the text today.** To measure it, run
`git grep -c "should not exist" -- packages/ts/tests packages/mermaid/tests` and read which
assertions name a code frame or `identifyByArgument`. On 2026-10-18 that showed:

- eess-ts: assertions on the message text, none on a code frame, and none on the `calls()` message
  with `identifyByArgument` set;
- eess-mermaid: none. Its `notExist` tests
  (`packages/mermaid/tests/builders/class-rule-builder.test.ts:27-57`, and `:61`) assert only that
  the rule throws or passes.

So "the existing tests pass unchanged" would prove nothing about mermaid's text, any code frame, or
`calls()` naming by argument.

## Design

Each copy becomes a call to `notExistCondition`:

```ts
// packages/ts/src/conditions/call.ts
export function notExist(): Condition<ArchCall> {
  return notExistCondition({
    name: (archCall, context) => callNameForMessage(archCall, context),
    toViolation: createCallViolation,
  })
}
```

```ts
// packages/ts/src/conditions/function.ts: the literal becomes a named constructor, unchanged
function functionViolation(
  fn: ArchFunction,
  message: string,
  context: ConditionContext,
): ArchViolation {
  return {
    rule: context.rule,
    element: fn.getName() ?? '<anonymous>',
    file: fn.getSourceFile().getFilePath(),
    line: fn.getStartLineNumber(),
    message,
    because: context.because,
  }
}

export function notExist(): Condition<ArchFunction> {
  return notExistCondition({
    name: (fn) => fn.getName() ?? '<anonymous>',
    toViolation: functionViolation,
  })
}
```

The other three follow the same shape with their existing constructors. The public names do not
change: eess-ts's root `notExist()` and eess-mermaid's builder method stay as they are. Nothing is
renamed or re-exported, and `notExistCondition` is not reachable from either dialect's root
([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) §2).

This plan does not make the five shapes the same: `function.ts` and `call.ts` still carry no
`ruleId`, `suggestion`, `docs` or code frame. Whether they should is a behaviour change, out of
scope.

## Phases

### Phase 1: pin each copy's finding, on main

Characterisation tests, written and green **before** any copy moves, so the migration is checked
against what main actually emits rather than against what the old tests happened to assert:

- `packages/ts/tests/conditions/not-exist-shape.test.ts` (new): for each of the four eess-ts
  copies, a rule selecting exactly one element, asserted twice with `toStrictEqual`, which tells an
  absent key from one holding `undefined` (decision 3, round five):
  - **bare** (no `.rule()`, no `.because()`): no metadata, so eess-ts's `applyFilters` stamps
    nothing (`packages/ts/src/core/execute-rule.ts:112-133` runs only when the rule has an id,
    reason, `because`, `suggestion` or `docs`). The expected object is exactly the copy's own keys
    plus the terminal's `severity`. Measured on main for the `function.ts` copy:
    `rule, element, file, line, message, because, severity`, with `because` holding `undefined` and
    no `ruleId` key. Sabotage row 2 points at this variant.
  - **full** (`.rule({ id, because, suggestion, docs })`, a value each): asserted by value, with the
    `ruleId`, `suggestion` and `docs` that `applyFilters` stamps. Measured on main for the
    `function.ts` copy: the bare keys plus `ruleId`, `suggestion` and `docs`, and `ruleId` is the
    declared id.

  The `structural.ts` and `jsx.ts` copies emit what `createViolation` emits, `codeFrame` included;
  the `function.ts` and `call.ts` copies emit no `codeFrame`. Each copy's two expected objects are
  measured on main in Phase 1 and written down, not derived from this plan.

- The `calls()` row with `identifyByArgument` set (coordinator's decision 4): a `calls()` rule
  selecting a call whose argument is a string literal, with `identifyByArgument: 0`, asserting the
  message names the call with its argument, and that an argument longer than 80 characters is
  elided in the message and not in `element` (`conditions/call.ts:44-48`).
- `packages/mermaid/tests/builders/class-rule-builder.test.ts`: the same two variants with
  `toStrictEqual`, over
  `classes(diagram(…)).that().haveNameMatching(/^Legacy$/).should().notExist()`. Measured on main:
  mermaid's `createViolation` always writes `ruleId`, `suggestion`, `docs` and `codeFrame`, so under
  a bare rule `ruleId`, `because`, `suggestion` and `docs` are present holding `undefined`; under
  full metadata they hold the declared values. The message is `class Legacy should not exist`, with
  its code frame. These are the first assertions on mermaid's text.

### Phase 2: migrate

The five copies onto `notExistCondition`. Every Phase 1 test passes unedited: that is the
byte-identity proof.

## Files changed

| file                                                         | change                                   |
| ------------------------------------------------------------ | ---------------------------------------- |
| `packages/ts/src/conditions/structural.ts`                   | `notExist` on `notExistCondition`        |
| `packages/ts/src/conditions/function.ts`                     | the same; the literal becomes a function |
| `packages/ts/src/conditions/call.ts`                         | the same, `name` reading `ctx`           |
| `packages/ts/src/conditions/jsx.ts`                          | the same                                 |
| `packages/mermaid/src/conditions/class.ts`                   | the same                                 |
| `packages/ts/tests/conditions/not-exist-shape.test.ts`       | new (Phase 1)                            |
| `packages/mermaid/tests/builders/class-rule-builder.test.ts` | one whole-finding test (Phase 1)         |
| `.changeset/not-exist-on-the-kernel.md`                      | eess-ts and eess-mermaid, patch          |

## Test inventory

- Phase 1's tests, green on main before Phase 2 and unedited after it.
- Each dialect's existing `notExist` tests, green.
- eess-ts's `it('no symbol behind @nielspeter/eess/internal is reachable from eess-ts')`
  (`packages/ts/tests/standalone-surface.test.ts:91`), green: nothing new is exported.

**Sabotage rows**, run in a worktree after Phase 2. Each must turn its named test red:

1. `call.ts` passes a `name` that ignores `ctx` (`archCall.getName() ?? '<call>'`): the
   `identifyByArgument` row reds.
2. `function.ts`'s `functionViolation` adds `ruleId: context.ruleId`: its **bare** row reds,
   because the finding gains a `ruleId` key holding `undefined` that `toStrictEqual` sees. Under
   full metadata the row would stay green (the sabotaged value equals what `applyFilters` stamps),
   which is why it points at the bare variant. The difference is invisible in output
   (`JSON.stringify` drops an `undefined` key); the row guards the finding's shape, which an adapter
   iterating `Object.keys` would see.
3. mermaid's `classViolation` drops `sourceText` (no code frame): mermaid's whole-finding test reds.
4. `jsx.ts` passes `name: (el) => el.getName()` (no angle brackets): its whole-finding row reds.

## Release

`@nielspeter/eess-ts` and `@nielspeter/eess-mermaid`, patch: no finding changes, which Phase 1's
tests prove.

## Out of scope

- Renaming or re-exporting anything.
- Changing any finding: in particular, giving `function.ts` and `call.ts` a code frame or the
  rule's `ruleId`, `suggestion` and `docs`.

## Review response — 2026-10-18 (round three, before this plan's own review)

- **method N3 / testing m8** (the byte-identity proof rests on tests that do not assert the text,
  and the sabotage row swaps in a default that does not exist): Phase 1 writes whole-finding tests
  on main first, mermaid's first included; four sabotage rows, each against a named test.
- **architect N-2 / coordinator decision 4** (`calls()` names by context): [plan 0456](./completed/0456-kernel-notexist-and-dead-glob.md)'s `name` takes
  `ctx`; a `calls()` row with `identifyByArgument` set.
- **method N3** (`function.ts` has no code frame): measured per copy, in the table above; three
  copies attach one, two do not.
- **architect m-new-3 / method N8** ("[ADR-006](../../adr/006-framework-rules-architecture.md)'s one owner"): [ADR-006](../../adr/006-framework-rules-architecture.md) says nothing of an owner;
  the reason cited is [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s decision 4.
- **architect m-new-4** (no `Implements` line): the Status says it implements nothing.

### Round four

- **enforcement R4-3 / testing I3 / method R4-3 / coordinator decision 5** (`toEqual` ignores an
  `undefined` key, so sabotage row 2 could fire nothing): Phase 1's rules declare `id`, `because`,
  `suggestion` and `docs`, and every whole-finding assertion uses `toStrictEqual`.
- **enforcement m-3** (a live assertion count pinned in the plan): dropped; the plan says how to
  measure it instead.

### Round five

- **testing N1 / coordinator decision 3** (under declared metadata `applyFilters` stamps `ruleId`,
  `suggestion` and `docs`, so the expected objects were wrong and row 2 could not red): each row runs
  bare and with full metadata, measured on main for eess-ts and eess-mermaid; row 2 points at the
  bare variant, and the plan says the difference is a key holding `undefined`.

## Progress ledger

- [ ] Phase 1: whole-finding tests for the five copies and the `calls()` argument row, green on main
- [ ] Phase 2: the five copies on `notExistCondition`, Phase 1 green unedited
- [ ] Sabotage rows 1–4, each red on its named test; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
