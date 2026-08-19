# Bug 0160: `within()` creates an import cycle in eess-ts, and no rule watches for cycles at all

## Status

- **State:** Draft — cycle reproduced live over eess-ts's own source; no red
  test yet.
- **Severity:** Medium — not a false green in a shipped gate, but an
  architectural defect in this repo's own source that its own tool would
  catch, and does not, because the rule was never written.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bug 0054)
- **Reported:** 2026-08-19

## Symptom

`packages/ts/src/helpers/within.ts` value-imports `ScopedFunctionRuleBuilder`
from the builders layer, so `helpers` depends on `builders` while `builders`
already depends on `helpers`. eess-ts's own source contains a genuine import
cycle.

The second half is the one that matters more: **nothing in this repo checks for
cycles.** `grep beFreeOfCycles *.rules.ts` returns nothing. So the cycle is
neither fixed nor deliberately waived — it is unobserved.

## Reproduction

Run against `packages/ts/dist`:

```js
slices(project('packages/ts/tsconfig.json'))
  .assignedFrom({ builders, conditions, helpers, predicates, models, core })
  .should()
  .beFreeOfCycles()
// → 6 violations
// component: [builders, conditions, helpers, predicates]
// closing edge: helpers -> builders … at within.ts:2
```

The capability works. It has simply never been pointed at this repo.

## Root cause

`packages/ts/src/helpers/within.ts:2` imports `ScopedFunctionRuleBuilder` as a
**value** (it constructs one), not as a type, so the edge is real at runtime
rather than erased.

Upstream restructured `within()` so the helper does not reach back into the
builders layer. That fix predates plan 0088's fold and was not carried across
— see the [fold audit](../fold-audit-2026-08-19.md).

The missing dogfood rule is eess's own gap, not inherited: `arch.rules.ts` and
`arch.internal.rules.ts` gate layering, kernel purity, unused exports and
type-assertions, but never cycles.

## Why it matters

The cycle itself is survivable — ESM tolerates it and nothing is currently
broken. What is not survivable, for a product whose thesis is "drift fails the
build", is that **the repo ships a cycle detector and does not run it on
itself**. That is a dogfooding hole of exactly the kind
[bug 0152](./0152-no-guardrail-against-hand-rolled-presets-recurring.md) is
about.

## Fix

Two parts, and the second is the durable one:

1. Break the cycle — make `within()` not depend on the builders layer (a type-
   only import, an injected factory, or moving the shared piece down a layer).
   Decide which and record it here; upstream's shape is a starting point, not
   automatically the right answer for eess's layering.
2. **Add a cycle rule to the dogfood gates**, so this cannot recur silently.
   That rule is what makes part 1 stay fixed, and it is the reason this is
   filed rather than quietly patched.

If part 1 turns out to be more invasive than expected, part 2 can still land
first with the current cycle waived by an explicit, reasoned
`// eess-exclude` — a documented waiver is honest; silence is not. (Note
[bug 0158](./0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md):
a waiver written without a reason currently suppresses silently, so give it
one.)

## Verification

- [ ] Red test first: a cycle rule over `packages/ts` fails on today's source,
      naming the `helpers -> builders` edge.
- [ ] The cycle is broken, and the same rule then passes.
- [ ] The cycle rule is wired into `npm run validate` (via `check:arch` or its
      own gate) and appears in `scripts/check-nonvacuity.mjs`, so an emptied
      version cannot stay green.
- [ ] Vacuity control: the rule genuinely examines a non-zero number of slices.
- [ ] `npm run validate` green.

Deferred: none.
