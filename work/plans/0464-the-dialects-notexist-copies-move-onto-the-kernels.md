# Plan 0464: the dialects' `notExist` copies move onto the kernel's

## Status

- **State:** Draft — filed 2026-10-18 as the home of plan 0456's deferral. Not reviewed.
- **Priority:** Low — de-duplication only. Bug 0462 (a marked condition stays mutable) is fixed for
  every copy by plan 0456's freeze at marking, so nothing here changes what a gate reports.
- **Effort:** Small — five call sites, one line each, plus their tests.
- **Created:** 2026-10-18
- **Builds after:** [plan 0456](./0456-kernel-notexist-and-dead-glob.md), which adds the kernel's
  `notExistCondition` behind `@nielspeter/eess/internal`, taking the dialect's own violation
  constructor so a code frame and `identifyByArgument` survive.

## Problem

The family carries five implementations of the same condition, each built by hand on
`marksAssertsCardinality`:

- eess-ts: `packages/ts/src/conditions/structural.ts:145` (behind the `classes()`, `types()` and
  `modules()` builders), `packages/ts/src/conditions/function.ts:56`,
  `packages/ts/src/conditions/call.ts:58` and `packages/ts/src/conditions/jsx.ts:36`;
- eess-mermaid: `packages/mermaid/src/conditions/class.ts:110`.

Plan 0456 adds the kernel's `notExistCondition` and builds eess-md's seven builders on it. Without
this plan the family keeps six owners of one rule (ADR-006's "one owner" is the reason 017's
decision 4 put it in the kernel).

## Design

Each copy becomes a call to `notExistCondition`, passing the dialect's existing violation
constructor, so every finding is byte-identical (message, code frame, `identifyByArgument` for
`calls()`). The public names do not change: eess-ts's root `notExist()` and eess-mermaid's builder
method stay as they are.

## Test inventory

- Each dialect's existing `notExist` tests pass unchanged, which is the byte-identity proof.
- Sabotage: replace one migrated copy's violation constructor with the kernel default; the dialect's
  code-frame test reds.

## Release

`'@nielspeter/eess-ts': patch` and `'@nielspeter/eess-mermaid': patch`; no behaviour changes.

## Out of scope

Renaming or re-exporting anything; changing any finding's text.

## Progress ledger

- [ ] eess-ts's four copies on `notExistCondition`
- [ ] eess-mermaid's copy on `notExistCondition`
- [ ] Sabotage row red; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
