# Bug 0373: an unresolved base ends the heritage walk silently

## Status

- **State:** Draft — the mechanism is measured; no red test yet, and whether it is a defect
  or a stated limit is the open question.
- **Severity:** Medium — **a silent narrowing of selection**, the shape
  [bug 0295](./fixed/0295-extend-and-implement-read-only-the-direct-clause.md) was rated High
  for. Medium on reach, not on kind: it needs a base without types in the middle of a chain,
  and in the configuration findings' own terms a project that cannot resolve its base classes
  has a gap those findings may already report. Measure that before treating it as narrow.
- **Origin:** self-found while fixing 0295, recorded rather than folded in.
- **Reported:** 2026-10-04

## Symptom

[ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) makes
`extend`, `implement` and `extendType` walk the chain. The walk can only climb through
classes and interfaces the checker resolves. `getBaseClass()` returns nothing for a base it
cannot resolve — measured in 0295, where `UnresolvedEntity extends Model` (from an
uninstalled package) has an empty chain.

So for `class OrderRepository extends ScopedBase`, where `ScopedBase` comes from a package
the project cannot resolve and itself extends `BaseRepository`:

- `extend('ScopedBase')` selects it — the level is matched by its text.
- `extend('BaseRepository')` does **not**, and nothing says the walk stopped.

`examined` stays non-zero whenever some other subclass is resolved, so the [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) floor
does not fire.

## Also here

Matching by text at every level ([ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) rule 4) means a condition can pass a class whose
distant ancestor, in a library's declarations, names an unrelated class with the same name.
[Bug 0296](./fixed/0296-heritage-predicates-compare-the-clause-text.md) kept the text match for unresolved bases; the walk widens where it applies. Whatever
this record decides about unresolved levels should decide whether text matching is limited to
them.

## Fix

**A mechanism now exists (2026-10-18).** [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)
lets a predicate say it cannot judge a subject (`Predicate.undecided`), reported wherever the rule's
verdict depends on it. A heritage walk that stops short is that case; whether this bug's fix uses it
is this record's to decide, and eess-ts would then honour the member rather than refuse it
([plan 0486](../plans/completed/0486-a-predicate-that-cannot-judge-says-so.md)'s Out of scope).

Not decided. [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) clause 1 says an instrument that stops short reports it. The question
is whether "the checker could not resolve this base" is an instrument limit — reported once
per run, naming the unresolved base — or a project misconfiguration the existing tsconfig
findings already own. Measure first: how often does a real adopter's heritage chain cross an
unresolved base?

## Verification

- [ ] a red test: a rule over a class whose chain crosses an unresolved base, naming the
      ancestor beyond it, reports nothing about the gap
- [ ] the fix, per [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)
- [ ] `npm run validate` green.

Deferred: none.
