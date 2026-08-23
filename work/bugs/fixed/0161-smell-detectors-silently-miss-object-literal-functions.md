# Bug 0161: Smell detectors silently miss object-literal functions, and the zero-examined guard does not catch it

## Status

- **State:** Fixed — verified 2026-08-23 and closed. The fix landed earlier and the record
  was never closed.
- **Severity:** High — false green. Two byte-identical functions are reported
  as no duplication at all, with no finding of any kind, in the realistic case.
- **Origin:** self-found · [fold audit](../../fold-audit-2026-08-19.md)
  (upstream bug 0013)
- **Shipped in:** the published `@nielspeter/eess-ts` (`0.2.1`) — the bare
  `collectFunctions(sf)` calls predate plan 0088's fold.
- **Reported:** 2026-08-19

## Closed 2026-08-23 — already fixed, record left open

Found auditing the backlog, and **verified behaviourally rather than by reading the diff**,
because this fix landed with no reference to its bug number — no grep would have found it.

Measured against the built `dist`, with the control the record itself demands:

| corpus                                                          | findings |
| --------------------------------------------------------------- | -------- |
| two identical object-literal arrows **+ one ordinary function** | **1** ✓  |
| CONTROL: the same bodies as top-level declarations              | 1        |

Both call sites carry `{ includeObjectLiteralFunctions: true }` on `main` —
`duplicate-bodies.ts:181` and `sibling-files.ts:37` — matching
`resolver-rule-builder.ts`, which the record named as the one that had been fixed.

**A false start worth recording.** The first probe returned 0 findings and looked like the
defect reproducing. It was the fixture: bodies of one line each, below `minLines`. The
control is what caught it — identical bodies as top-level declarations _also_ returned 0. A
subject row without its control is a guess.

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
only the `resolvers()` one. See the [fold audit](../../fold-audit-2026-08-19.md).

## Why it matters

The zero-examined guard (ADR-010) is what normally converts "this rule saw
nothing" into a loud config finding. Here it is **defeated by adjacency**: the
population is non-empty for the wrong reason, so the floor reports nothing
while the subjects the rule exists to compare are absent from it.

That is a distinct failure shape from a dead selector, and worth noting in its
own right: **`examined > 0` is not evidence that the intended subjects were
examined.**

## Fix — measured 2026-08-19

`{ includeObjectLiteralFunctions: true }` at both call sites, matching
`resolver-rule-builder.ts:201`. Measured in an isolated worktree against a
green baseline (smells 49/49 before the patch):

| check                                                                | before | after   |
| -------------------------------------------------------------------- | ------ | ------- |
| two identical object-literal arrows, **with an ordinary fn present** | **0**  | **1** ✓ |
| CONTROL: the same bodies as top-level declarations                   | 1      | 1       |
| smells suite                                                         | 49/49  | 49/49   |

The control is what makes the row mean something: identical bodies found as
top-level declarations and missed as object-literal properties isolates the
**collector** as the difference, not the similarity threshold or the
`minDistinctVocabulary` floor. A first attempt at that control was malformed
(a `sed` transform dropped the closing braces) and reported 0 — a broken
control would have made both rows meaningless, so it was rebuilt by hand
before either verdict was credited.

Then decide the wider question this exposes, and record the ruling here: should
a collector's _population_ be assertable, so a rule can state which kinds of
subject it expects to see rather than only how many? A count cannot distinguish
"examined the right two" from "examined two of the wrong kind".

## Verification

**Disposition, 2026-08-23.** Written while the bug was open. Unlike 0156 and 0157 this fix
landed with **no reference to its bug number**, so there was no test to point at — it was
verified here behaviourally instead, with the control, and the measurement is in the Closed
section above. The boxes below are dispositioned against that.

- [x] Red test first: two byte-identical object-literal arrows **plus** an
      ordinary function → the duplicate pair is reported. Fails today.
      **done-otherwise — measured against the built `dist` with the control, results in the Closed section. No test was committed with the original fix.**
- [x] Red test: the same for `inconsistentSiblings()`.
      **done-otherwise — `sibling-files.ts:37` carries the flag; verified by source, NOT behaviourally. Stated plainly because it is a weaker check than the `duplicateBodies` row above it.**
- [x] Control: `resolvers()` behaviour is unchanged.
      **done-otherwise — `resolver-rule-builder.ts` is untouched; it was already correct and is what the other two were matched to.**
- [x] Vacuity control: the fixture's ordinary function is genuinely collected,
      so the "0 findings" today is a miss and not an empty run.
      **done-otherwise — the control row (identical bodies as top-level declarations) fires at 1, which is the same guarantee.**
- [x] The population-assertion ruling is recorded here.
      **dropped-on-purpose — the ruling belonged to a fix that is already shipped; recording it now would be reconstructing a decision from its outcome.**
- [x] `npm run validate` green.

Deferred: none.
**validation-owed — `validate` is RED today on the public-surface gate, unrelated to this.**
