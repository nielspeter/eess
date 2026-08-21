# Bug 0189: ADR-008's preset-default row is `gated` over an engine that changed

## Status

- **State:** Fixed — 2026-08-21, in the PR that filed it. Both halves closed: the
  engine enforces again, and ADR-008's row cites a mechanism that fails.
- **Severity:** Medium — an ADR faithfulness failure, not a false green in a
  build. The same class as
  [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md),
  and filed at this severity for the same reason: what it breaks is a **binding
  ADR clause marked `gated`**.
- **Origin:** self-found · closing [plan 0165](../../plans/completed/0165-integrate-the-copied-ts-archunit-engine.md),
  whose Phase 3 recorded this as a `deferred→ADR` with no ADR to defer to
- **Reported:** 2026-08-21 · **Fixed:** 2026-08-21

## Symptom

[ADR-008](../../../adr/008-caller-owns-reporting.md) states, twice in prose and once
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

### Resolved 2026-08-21 — **(2)**, and this record argued the wrong way

This section said _"(1) is almost certainly right"_. It was wrong, and left
standing it would have told the next agent to undo the fix that shipped in the
same branch — a Draft record prescribing a reversal is a live hazard in an
agent-first repo, not bookkeeping. Two reviewers of PR #72 flagged exactly that.

What the record missed when it argued for (1):

- **The builder default was never a decision.** Plan 0165 Phase 3 restored
  `report` "additive, by overload"; _additive_ means the default was meant to
  survive. The tell is that `'throw'`, `'return'` and `'warn'` all had names and
  the builder form had none — it was reachable only by saying nothing. Amending
  the ADR would have ratified an accident of overload ordering.
- **Nobody had adopted it.** (2)'s stated cost — "breaking every caller that has
  adopted the builder-returning default" — was zero: it existed only between
  unreleased commits, and published `eess-ts@0.2.1` already throws.
- **(1) meant rewriting three artifacts to match the accident** —
  `docs/getting-started.md`, `packages/ts/README.md`, `docs/presets.md` — where
  (2) made all three true again with no edit.
- **The severity grade was wrong too.** This record said "an ADR faithfulness
  failure, **not a false green in a build**." It was a false green in every
  adopter's build: `docs/getting-started.md` teaches a bare
  `layeredArchitecture(p, {…})` inside an `it()`, and that test passed
  unconditionally on any codebase.

The capability survives, named: `report: 'builders'`.

Either way the Enforcement row had to name a mechanism that **fails when the
clause is violated**, and it now does.

## Verification

- [x] Red test first, against the **eess-ts** preset surface:
      `packages/ts/tests/presets/the-default-enforces.test.ts`, written around the
      shape that regressed — a bare call whose result is discarded. Re-introducing
      the old `deliver()` behaviour fails **112** tests; before this file existed
      it failed none of 3528.
- [x] ADR-008's row now cites that test rather than
      `packages/core/tests/report.test.ts`, which covers the KERNEL's
      `finishPreset` default — a different path, and why the row was green over a
      clause it could not see.
- [x] `npm run check:corpus` and `check:crossval` green on the amended ADR.
- [x] `npm run validate` green.

Deferred: none.
