# Bug 0576: [ADR-008](../../adr/008-caller-owns-reporting.md)'s preset clause is gated by a kernel unit test only

## Status

- **State:** Draft — re-homed from [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  deferral, 2026-11-01; no red test yet.
- **Severity:** Medium — the Enforcement row reads `gated` for a clause about every preset, while
  its mechanism exercises the kernel's `finishPreset` alone; a dialect preset that never calls it
  is invisible, which is how [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s two presets went unseen for months.
- **Origin:** self-found · [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
  Deferred list, whose home ([plan 0101](../plans/completed/0101-sibling-gates-go-fail-closed.md))
  closed without taking it.
- **Reported:** 2026-11-01

## Symptom

[ADR-008](../../adr/008-caller-owns-reporting.md)'s Enforcement table states "Presets return
violations, don't force emission" as `gated`, with `packages/core/tests/report.test.ts`, the
`report: return` case, as its mechanism (`adr/008-caller-owns-reporting.md:145`). That test calls
`finishPreset` directly. A preset in any dialect that ends in a builder's `.check()`, or returns
`void`, satisfies the row while breaking the clause: [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)'s `diagramMatchesCode` and
`adrCitationsResolve` did exactly that from [plan 0070](../plans/completed/0070-caller-owns-reporting.md) until 2026-11-01.

## Fix

Not designed. The direction [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md) named: a Tier-1 rule over `packages/*/src/**` that every
exported preset returns the kernel's receipt and accepts `PresetReportOptions`, authored and
validated through `.claude/workflows/adr-enforce.mjs`, with the row citing it. "Exported preset"
needs a definition the rule can select on (the modules listed in each package's `exports`, less
builders and helpers), which is the design question, so the work starts as a spike. The rule needs
no new scanner: eess-ts's condition `functions(p).should().haveReturnTypeMatching(…)`
(`packages/ts/src/builders/function-rule-builder.ts:483`, `docs/functions.md`) can state it in
`arch.rules.ts`. It would also back a second claim: the `eess-crossvalidate` README and guide say
"Every preset here reports the same way" (added by [bug 0097](./fixed/0097-crossval-presets-bypass-caller-owns-reporting.md)).

## Verification

- [ ] Red test written first: a fixture preset ending in `.check()`, or returning `void`, reds the
      new rule.
- [ ] The rule examines every preset the family exports today and passes.
- [ ] [ADR-008](../../adr/008-caller-owns-reporting.md)'s row cites the rule; `check:corpus`'s `adrEnforcement` resolves it.
- [ ] `npm run validate` green.

Deferred: none
