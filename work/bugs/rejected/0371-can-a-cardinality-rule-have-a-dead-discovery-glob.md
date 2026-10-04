# Bug 0371: can a cardinality rule have a dead discovery glob, and would anything report it?

## Status

- **State:** Rejected — **built, and the shape cannot be constructed.** Not a defect: the two
  exemptions that would have produced the silence are gated on `assertsCardinality()`, which is a
  constant `false` for every builder that stamps a discovery glob, and a dead discovery glob is
  reported by the ordinary path. Both halves are now pinned by a test, so the combination fails
  loudly if a future builder changes either. Deferred out of
  [0363](../fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md).
- **Severity:** Unknown — and that is the finding. If the shape is constructible it is a
  silent false green in the family 0355 is named for; if it is not constructible there is
  nothing here and this record closes won't-do.
- **Origin:** asked by enforcement review of 0362's second fix, carried in 0363's record,
  and still unanswered after 0363 shipped.
- **Reported:** 2026-10-01

## The question

`cardinalitySelectorMissedDisk` returns `deadSitesIn(...).selector` and **discards
`.discovery`**; `deadSelectorFindings` returns empty for a cardinality rule outright. So a
cardinality rule whose **discovery** glob is dead appears to report in neither path — which
would be the same silence bug 0355 closed for selector globs, surviving one position over.

## What is measured — and the correction that got it there

**The first version of this section was false, and it was false in the way this project
records about its own documentation: it searched one spelling and reported absence.** It said
the only `position: 'discovery'` construction was a preset's internal diagnostic. Grepping that
exact string finds one; grepping `'discovery'` finds **five more, all public builders**, which
pass the position as a bare argument rather than a named property:

| builder                                            | site                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/ts/src/builders/slice-rule-builder.ts`   | `:149` and `:174`                                                       |
| `packages/ts/src/builders/cross-layer-builder.ts`  | `:229`                                                                  |
| `packages/ts/src/smells/smell-builder.ts`          | `:148` — which answers the question the first version listed as unknown |
| `packages/ts/src/graphql/resolver-rule-builder.ts` | `:110`                                                                  |

So discovery globs are ordinary, not exotic. Caught by method review, which ran one grep.

**The conclusion survives, for a reason the first version never stated.** A discovery glob and
a cardinality assertion cannot meet, because `assertsCardinality()` is a constant `false` on
`TerminalBuilder` (`packages/ts/src/core/terminal-builder.ts:507`) and is overridden in exactly
one place, `RuleBuilder` (`packages/ts/src/core/rule-builder.ts:221`) — and **every one of the
five builders above extends `TerminalBuilder` (or `GraphqlRuleBuilder`) directly and overrides
nothing.** A rule that stamps a discovery glob therefore always answers `false` to
`assertsCardinality()`, so it never enters the cardinality path whose exemptions this record
worried about.

That is a type-level argument, not a measurement. What it still does not establish:

- whether a future builder could override `assertsCardinality()` _and_ stamp a discovery glob,
  which is the state this record exists to catch — nothing prevents it;
- whether the two paths' exemptions would in fact compose to silence if one did.

## Measured: the shape cannot be built

The record said to build one rather than read, because a type-level argument is not the same as
having tried. Built, through the public entry points, and the answer is the same as the argument
predicted — which was worth confirming rather than assuming, since the first survey in this record
was already wrong once.

`packages/ts/tests/core/a-cardinality-rule-cannot-have-a-discovery-glob.test.ts` constructs
`slices(p).matching(DEAD).should().beFreeOfCycles()` and
`smells.duplicateBodies(p).inFolder(DEAD)` — two of the five discovery-stamping builders, reached
the way an adopter reaches them — and asserts the two facts that together make the silence
impossible:

1. **Both answer `false` to `assertsCardinality()`**, so neither exemption can engage. Guarded
   against vacuity: the same rules are asserted to carry globs, or the loop would pass over an
   empty set.
2. **A dead discovery glob is reported by `check`** — one unsuppressable finding,
   `matching("**/no-such-area/**") resolved no slices` — and `doctor` agrees, so the two tools do
   not disagree about a broken rule (bug 0357's invariant).

Only the pair is the safety property, which is why both are asserted: if a future builder gains
the `assertsCardinality()` override while still stamping a discovery glob, (1) reds; if `check`
stops reporting discovery globs, (2) reds. Measured as a two-row matrix —
`TerminalBuilder.assertsCardinality()` forced to `true` reds two assertions, and dropping
`check`'s discovery reporting reds one.

**A correction to this file's own first test.** The second assertion originally read
`diagnose([rule])` — doctor — and a sabotage row dropping `check`'s discovery reporting fired
nothing against it, because doctor has its own path. The silence this record feared was in
`check`, so asserting doctor tested the wrong surface. Now asserts `violations()`, keeping doctor
as the agreement check.

## Why it is not a fix

There is nothing to fix. What there was, and what this record delivers, is a question asked three
times across three reviews and answered none — now answered, with the reason pinned rather than
written down, so it does not have to be asked a fourth time.

## Related

- [0355](../fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md) —
  the same silence, for selector globs.
- [0363](../fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — carried
  this question and did not need it answered.

## Verification

- [x] constructible or not, decided by **building one** rather than by reading — two of the five
      discovery-stamping builders, through their public entry points.
- [x] a guard that keeps it unconstructible: both halves pinned, so a builder that gains the
      `assertsCardinality()` override while stamping a discovery glob reds the first assertion
      rather than reopening the hole silently. This is what the Draft version said nothing
      noticed; now something does.
- [x] not constructible, so **closed `Rejected` with the attempt recorded**, including the
      correction to the first test's surface.
- [x] `npm run validate` green.

Deferred: none.
