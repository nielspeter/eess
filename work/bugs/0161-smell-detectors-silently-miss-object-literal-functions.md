# Bug 0161: Smell detectors silently miss object-literal functions, and the zero-examined guard does not catch it

## Status

- **State:** Draft — reproduced against the built dist, including the case that
  defeats the ADR-010 floor; no red test yet.
- **Severity:** High — false green. Two byte-identical functions are reported
  as no duplication at all, with no finding of any kind, in the realistic case.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bug 0013)
- **Shipped in:** the published `@nielspeter/eess-ts` (`0.2.1`) — the bare
  `collectFunctions(sf)` calls predate plan 0088's fold.
- **Reported:** 2026-08-19

## Symptom

`smells.duplicateBodies()` and `smells.inconsistentSiblings()` do not collect
functions defined as object-literal properties. Duplicated or inconsistent
object-literal functions are invisible to both.

`resolvers()` was fixed (`packages/ts/src/graphql/resolver-rule-builder.ts:201`
passes `{ includeObjectLiteralFunctions: true }`); these two were not.

## Reproduction

Against `packages/ts/dist`, two byte-identical object-literal arrows:

| corpus                                   | examined | findings                                   |
| ---------------------------------------- | -------- | ------------------------------------------ |
| object-literal functions **only**        | 0        | 1 — ADR-010's zero-examined config finding |
| the same, **plus one ordinary function** | 2        | 0 — **silent**                             |

The second row is the dangerous one and the realistic one. Any non-object-
literal function in scope makes `examined` non-zero, so the fail-closed floor
is satisfied and the missed duplicates are reported as nothing at all.

## Root cause

`packages/ts/src/smells/duplicate-bodies.ts:125` and
`packages/ts/src/smells/inconsistent-siblings.ts:39` call `collectFunctions(sf)`
without the `{ includeObjectLiteralFunctions: true }` option the collector
supports.

Predates plan 0088's fold; upstream fixed all three call sites, eess carried
only the `resolvers()` one. See the [fold audit](../fold-audit-2026-08-19.md).

## Why it matters

The zero-examined guard (ADR-010) is what normally converts "this rule saw
nothing" into a loud config finding. Here it is **defeated by adjacency**: the
population is non-empty for the wrong reason, so the floor reports nothing
while the subjects the rule exists to compare are absent from it.

That is a distinct failure shape from a dead selector, and worth noting in its
own right: **`examined > 0` is not evidence that the intended subjects were
examined.**

## Fix

Pass `{ includeObjectLiteralFunctions: true }` at both call sites, matching
`resolver-rule-builder.ts:201`.

Then decide the wider question this exposes, and record the ruling here: should
a collector's _population_ be assertable, so a rule can state which kinds of
subject it expects to see rather than only how many? A count cannot distinguish
"examined the right two" from "examined two of the wrong kind".

## Verification

- [ ] Red test first: two byte-identical object-literal arrows **plus** an
      ordinary function → the duplicate pair is reported. Fails today.
- [ ] Red test: the same for `inconsistentSiblings()`.
- [ ] Control: `resolvers()` behaviour is unchanged.
- [ ] Vacuity control: the fixture's ordinary function is genuinely collected,
      so the "0 findings" today is a miss and not an empty run.
- [ ] The population-assertion ruling is recorded here.
- [ ] `npm run validate` green.

Deferred: none.
