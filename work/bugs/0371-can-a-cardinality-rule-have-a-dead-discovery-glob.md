# Bug 0371: can a cardinality rule have a dead discovery glob, and would anything report it?

## Status

- **State:** Draft — **not currently constructible**, by a type-level argument rather than a
  measurement, and the first version of this record got there on evidence that was refuted.
  Deferred out of [0363](./fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md).
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

## Fix

None yet, and none until the question is answered. **Do the measurement first.** If a rule of
that shape can be built, this is a false green and the fix follows
[ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) clause 1
and 0355's ruling. If it cannot, close won't-do and record the evidence so the next reader
does not re-derive the question a third time.

## Related

- [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md) —
  the same silence, for selector globs.
- [0363](./fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — carried
  this question and did not need it answered.

## Verification

- [ ] constructible or not, decided by **building one** rather than by reading. The type-level
      argument above says no; it is not the same as having tried.
- [ ] a guard that keeps it unconstructible, or the acceptance that nothing does: a builder
      that stamps a discovery glob and overrides `assertsCardinality()` would reopen this, and
      no mechanism notices.
- [ ] if constructible: a red-first test, then the fix.
- [ ] if not: closed won't-do with the attempt recorded, so the question stops recurring.
