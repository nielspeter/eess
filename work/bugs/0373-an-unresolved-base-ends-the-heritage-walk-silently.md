# Bug 0373: an unresolved base ends the heritage walk silently

## Status

- **State:** Draft — the mechanism is measured; no red test yet, and whether it is a defect
  or a stated limit is the open question.
- **Severity:** Medium — **a silent narrowing of selection.** Not High: the direct check had
  the same blind spot one level down, so nothing that was selected before
  [bug 0295](./fixed/0295-extend-and-implement-read-only-the-direct-clause.md) is dropped
  now. But it is the ADR-016 shape — an instrument that stops short, and says nothing.
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

`examined` stays non-zero whenever some other subclass is resolved, so the ADR-010 floor
does not fire.

## Fix

Not decided. ADR-016 clause 1 says an instrument that stops short reports it. The question
is whether "the checker could not resolve this base" is an instrument limit — reported once
per run, naming the unresolved base — or a project misconfiguration the existing tsconfig
findings already own. Measure first: how often does a real adopter's heritage chain cross an
unresolved base?

## Verification

- [ ] a red test: a rule over a class whose chain crosses an unresolved base, naming the
      ancestor beyond it, reports nothing about the gap
- [ ] the fix, per ADR-016
- [ ] `npm run validate` green.

Deferred: none.
