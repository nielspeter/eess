# Bug 0125: five builders thread rule metadata through `ConditionContext` that `applyFilters` now stamps anyway — dead weight that can only drift

## Status

- **State:** Draft — enumerated against the source; no red test yet.
- **Severity:** Low — nothing is wrong today. It is duplication that became
  redundant rather than merely repeated, and its only possible future is drift.
- **Origin:** self-found · architect review of
  [0122](./fixed/0122-violations-path-drops-because.md)'s fix
- **Reported:** 2026-08-12

## Symptom

The same four fields are threaded into `ConditionContext` in five places:

| builder               | file                                               |
| --------------------- | -------------------------------------------------- |
| `RuleBuilder`         | `packages/core/src/rule-builder.ts`                |
| `SliceRuleBuilder`    | `packages/ts/src/builders/slice-rule-builder.ts`   |
| `CrossLayerBuilder`   | `packages/ts/src/builders/cross-layer-builder.ts`  |
| `ResolverRuleBuilder` | `packages/ts/src/graphql/resolver-rule-builder.ts` |
| `SchemaRuleBuilder`   | `packages/ts/src/graphql/schema-rule-builder.ts`   |

Each condition then copies `context.because` / `suggestion` / `docs` / `ruleId`
onto every violation it builds. Since 0122, `applyFilters` stamps exactly those
four onto any violation that lacks them — so every one of those copies now
produces an identical result to doing nothing.

## Root cause

0122 introduced a second, lower source for the same data, deliberately: the
`TerminalBuilder` subclasses had no context to thread. The kernel now has two
answers to "where does rule metadata come from", and only one of them is
reachable from every builder.

## Why it matters

Not correctness — consistency that can only decay. A condition that forgets to
thread a field is now silently corrected, so the omission is undetectable. A
condition that threads a _different_ value silently wins, and the difference is
invisible unless someone reads both sites. Of `ConditionContext`'s five fields,
only `rule` (the description) still has an independent reason to exist; nothing
stamps that.

The duplication predates 0122. What 0122 changed is that it is now dead weight
rather than the mechanism.

## Fix

Decide which is the source, then make the other one impossible:

1. **Keep the stamp as the single source.** Drop `because`/`ruleId`/`suggestion`/
   `docs` from `ConditionContext` and from the five builders that populate it,
   leaving `rule`. Conditions stop copying them. Largest diff, smallest surface.
2. **Keep the context for conditions that _compose_.** A condition that builds a
   message incorporating the rationale needs to read it. If any does, keep the
   fields as documented read-only inputs and say so — a condition may read them,
   never stamp them.

(1) is preferable unless (2) has a real consumer; that is the thing to check
first. Either way, an arch rule can then enforce it: no condition assigns
`because`/`suggestion`/`docs` from a context field.

## Verification

- [ ] Survey: does any condition READ `context.because`/`suggestion`/`docs` for
      anything other than copying it onto a violation? That answer picks the fix.
- [ ] Red test written first: a condition that omits the fields still produces
      violations carrying them (passes today, via the stamp — so the test must
      assert the _absence of the copy_, e.g. an arch rule over the sources).
- [ ] The five duplicated blocks are gone, or documented as read-only inputs.
- [ ] `npm run validate` green, with no output change from any gate.

Deferred: none.
