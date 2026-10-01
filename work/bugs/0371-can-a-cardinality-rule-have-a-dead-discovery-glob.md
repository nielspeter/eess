# Bug 0371: can a cardinality rule have a dead discovery glob, and would anything report it?

## Status

- **State:** Draft — a measurement owed, not a defect confirmed. Deferred out of
  [0363](./fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md).
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

## What is measured so far

The only construction of `position: 'discovery'` in the dialect's source is a hand-built site
inside `packages/ts/src/presets/agent-guardrails.ts`, a preset's internal diagnostic over its
own `ruleFiles` entries — not a shape a user chains `.satisfy(notExist())` onto. So the
combination may not be constructible through the public builders at all.

That is a survey, not a proof. What it does not establish:

- whether any builder reachable from the public API attaches a discovery glob to a rule that
  can also assert cardinality;
- whether `smells.*().inFolder(...)` globs are tagged `discovery` or something else;
- whether the two paths' exemptions actually compose to silence, or whether one of them
  reports first for an unrelated reason.

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

- [ ] constructible or not, decided by building one rather than by reading.
- [ ] if constructible: a red-first test, then the fix.
- [ ] if not: closed won't-do with the attempt recorded, so the question stops recurring.
