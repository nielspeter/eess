# Bug 0178: the kernel's dead-glob finding cannot fire

## Status

- **State:** Draft — measured unreachable; needs a decision, not just a test.
- **Found:** 2026-08-20, enforcement review of the `fold-audit-0154-0160` branch
  (finding C2).
- **Severity:** an unreachable configuration finding that reads as coverage —
  ADR-009 rule 1's object.

## Symptom

`deadGlobViolation` (`packages/core/src/vacuity-findings.ts:57`) cannot be
produced by any dialect this repo ships.

Its dispatch is in `packages/core/src/terminal-builder.ts`:

```ts
if (deadGlob !== undefined) return [...violations, deadGlobViolation(this.facts(), deadGlob)]
```

`deadGlob` comes from `packages/core/src/rule-builder.ts:368`:

```ts
const deadGlob = sourceEmpty ? undefined : this.deadGlobDiagnosis()
```

and `deadGlobDiagnosis()` is declared once, at `rule-builder.ts:259`, returning
`undefined`:

```
$ grep -rn "deadGlobDiagnosis" packages/{ts,md,mermaid,gherkin,crossvalidate}/src
(no overrides)
```

So the value is `undefined` on every code path in the monorepo, the branch is
dead, and the producer is unreachable. Confirmed by sabotage: disabling the
dispatch leaves `packages/core`, `-md`, `-mermaid` and `-gherkin` fully green.

## The claim it makes while unreachable

`vacuity-findings.ts:44-56` documents it as:

> Strictly more actionable than `zeroExaminedViolation()`'s generic message,
> which this replaces when a diagnosis is available.

Nothing replaces anything. A reader of the kernel sees a dead-glob diagnosis in
the evidence gate and reasonably concludes dead globs are diagnosed there.

## Why this is not simply "add a test"

`eess-ts` **does** diagnose dead globs, well, and with a real break class — via
its own `deadSelectorFindings` in `core/vacuity-diagnosis.ts`, reached through
`terminal-execution.ts`, guarded by
`tests/core/a-dead-discovery-glob-fails.test.ts`. Sabotaging that path reddens 15
tests.

So the kernel's copy is a second, parallel implementation of something the
flagship dialect already does on its own path. The question is which one is
supposed to exist:

1. **Wire it.** A dialect overrides `deadGlobDiagnosis()`, and the kernel's
   version becomes the shared implementation the other four dialects inherit.
   Then `eess-ts`'s private path is the duplicate, and should probably route
   through it.
2. **Delete it.** Remove the producer, the dispatch, the `deadGlob` field on
   `CollectResult` and the `deadGlobDiagnosis()` hook. Dead-glob diagnosis stays
   a dialect concern, and `zeroExaminedViolation` remains the kernel's generic
   answer.

Do not resolve this by adding a stranger-dialect test that overrides
`deadGlobDiagnosis()` and asserts the finding appears. That would prove the
kernel's plumbing works while leaving every shipped dialect unable to reach it —
a break class for a path nothing takes, which is a greener kind of the same
problem.

## Fix

Not built — see the decision above.

## Verification

- [ ] Either a shipped dialect reaches `deadGlobViolation`, with a test that
      fails when the override is removed; or the producer, its dispatch, the
      `CollectResult.deadGlob` field and the `deadGlobDiagnosis()` hook are gone.
- [ ] If wired: `eess-ts`'s parallel path is either routed through it or its
      continued separateness is justified in a comment.
- [ ] If deleted: `zeroExaminedViolation`'s docstring no longer refers to being
      superseded by a more specific diagnosis.
