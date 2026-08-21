# Bug 0164: `RuleBuilder` carries the assertion gate and exceeds this repo's own class-size rules

## Status

- **State:** Draft — the exclusion is in place and reasoned; the split is owed.
- **Severity:** Low — no runtime effect. This is recorded debt, not a defect:
  `check:arch` is green because `rule-builder.ts` is now excluded from two
  rules it used to satisfy.
- **Origin:** self-found · adopting ts-archunit's test corpus (bug 0155's
  assertion gate, ported to satisfy upstream's `assertion-gate.test.ts`)
- **Reported:** 2026-08-19

## Symptom

`packages/core/src/rule-builder.ts`'s `RuleBuilder` exceeds two of this repo's
own thresholds:

```
RuleBuilder has 336 lines   (max: 300)  — eess/max-class-lines
RuleBuilder has 22 methods  (max: 20)   — eess/max-methods
```

Both are now waived by name in `arch.internal.rules.ts`, alongside the
pre-existing `TerminalBuilder` waiver.

## Root cause

Bug 0155's assertion gate needs `assertsSomething()` and `assertionAdvice()`
as **overridable hooks** — that is the mechanism by which each builder family
(slice, schema, resolver, tsconfig, correspondence) carries its own remedy
rather than a generic one. Overridable means they are methods on the class,
so they cannot be hoisted out the way the advice _text_ was
(`packages/core/src/assertion-advice.ts`, a pure function of three fields).

The comment above the rules in `arch.internal.rules.ts` previously recorded
that RuleBuilder had dropped _back under_ both thresholds after plan 0088
moved terminal methods into `TerminalBuilder`. This puts it over again, for a
different reason.

## The decision, recorded rather than implied

**Waive by name; do not raise the thresholds.** Raising 300/20 globally would
lower the bar for every class in the repo to accommodate one, which is the
"move the gate because the gate is inconvenient" move this project exists to
prevent. A named waiver says exactly which class is over and why, and leaves
the bar intact for everything else — the same shape as the existing
`TerminalBuilder` and `/builders/` waivers, both justified by ADR-003.

The thresholds are **eess's own hygiene heuristic**, not upstream's, and what
they were blocking is a false-green fix. Correctness outranks class size. But
"we can refactor later" is exactly the deferral that never happens unless it
has a number, which is what this record is for.

## Fix

Split `RuleBuilder`. Candidate seams, none ruled:

1. Move the predicate/condition accumulation (`addPredicate`, `addCondition`,
   `_misplaced` tracking, `copy()`) into a small owned collaborator, leaving
   `RuleBuilder` the grammar surface.
2. Give the assertion gate its own mixin/base that `RuleBuilder` and the
   dialect builders both extend, so the hooks live together with the advice
   function they already delegate to.
3. Accept that the two kernel grammar-base classes are permanently exempt and
   say so in ADR-003 instead — a decision, not a waiver.

Option 3 is the honest one if the split turns out to be artificial; it should
be considered on its merits rather than treated as giving up.

## Verification

- [ ] `rule-builder.ts` is removed from both `.excluding()` lists in
      `arch.internal.rules.ts`, and `check:arch` is green without them — **or**
      option 3 is chosen and ADR-003 records it.
- [ ] Every builder family still carries its own assertion remedy (the
      behaviour the hooks exist for) — pinned by upstream's
      `assertion-gate.test.ts` rows for slice/schema/resolver.
- [ ] `npm run validate` green.

Deferred: none.
