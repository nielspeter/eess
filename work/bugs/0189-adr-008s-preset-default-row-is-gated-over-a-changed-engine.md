# Bug 0189: ADR-008's preset-default row is `gated` over an engine that changed

## Status

- **State:** Draft — reproduced by reading the ADR against the code; no red test yet.
- **Severity:** Medium — an ADR faithfulness failure, not a false green in a
  build. The same class as
  [bug 0163](./0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md),
  and filed at this severity for the same reason: what it breaks is a **binding
  ADR clause marked `gated`**.
- **Origin:** self-found · closing [plan 0165](../plans/completed/0165-integrate-the-copied-ts-archunit-engine.md),
  whose Phase 3 recorded this as a `deferred→ADR` with no ADR to defer to
- **Reported:** 2026-08-21

## Symptom

[ADR-008](../../adr/008-caller-owns-reporting.md) states, twice in prose and once
as a `gated` Enforcement row, that the **default preset behaviour is emit + throw**:

> The default stays print-then-throw, so no CLI change is required; a caller opts
> in…

| Clause                                           | Tier | Mechanism                                                          | Status  |
| ------------------------------------------------ | ---- | ------------------------------------------------------------------ | ------- |
| Default preset behavior unchanged (emit + throw) | 2    | `packages/core/tests/report.test.ts` — the default throw-mode case | `gated` |

The adopted engine does not do that. `recommended(p, options?)` with no `report`
option returns `RuleBuilderLike[]` — builders for the caller to run — and only
the `{ report: ReportMode }` overload returns `ArchViolation[]`:

```ts
export function recommended(
  p: ArchProject,
  options: RecommendedOptions & { report: ReportMode },
): ArchViolation[]
export function recommended(p: ArchProject, options?: RecommendedOptions): RuleBuilderLike[]
```

## Why the gate does not catch it

The cited mechanism is real and passes — and it is testing something else.
`packages/core/tests/report.test.ts` exercises the **kernel's** reporting default.
The behaviour that changed is **eess-ts's preset surface**. So the row is green
over a path it does not reach.

That is the identical shape as 0163's second half: a `gated` row whose mechanism
column names something that would not fail if the clause were violated — which is
the class this repo files bugs about (0116, 0128) and the class `check:crossval`
exists to prevent.

## Root cause

Plan 0165 Phase 3 restored `report` on all five presets **additively, by
overload**, which was the right call: restoring the option must not silently
change a documented default. But that leaves ADR-008 describing a default the
engine no longer has, and 0165 recorded it as `deferred→ADR` — to an ADR that was
never written. This record is that home.

## Fix

Two candidates, and picking between them **is** the decision:

1. **Change the ADR** to describe the engine as adopted — the default returns
   builders, `report` opts into emit+throw — and re-derive the Enforcement row
   against a mechanism that covers the ts preset surface.
2. **Change the engine** back to emit+throw by default, making the ADR true again
   and breaking every caller that has adopted the builder-returning default.

(1) is almost certainly right, but it is a binding change to a ratified ADR and
the reasoning belongs in the ADR's own history, not in a bug record.

Either way the Enforcement row must end up naming a mechanism that **fails when
the clause is violated**, or its Status must stop saying `gated`.

## Verification

- [ ] Red test first: an assertion that a preset called with no `report` option
      behaves as ADR-008's row claims. Must fail today, against the **eess-ts**
      preset surface — written against the kernel it passes and proves nothing.
- [ ] ADR-008's row cites a mechanism that covers the preset path, or its Status
      is corrected to what it actually is.
- [ ] `npm run check:corpus` and `check:crossval` green on the amended ADR.
- [ ] `npm run validate` green.

Deferred: none.
