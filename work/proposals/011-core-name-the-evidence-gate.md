# Proposal 011 — core: name the evidence gate, instead of reaching it through a reporting function

**State:** Draft — **what this proposal produces is a decision, not a change**: ask A cannot be evaluated until root-vs-`/internal` is settled (open question 1), so accepting it schedules that decision rather than an implementation. Surveyed against the repo source at the head of `plan-0263-phase-2`; every call site below was enumerated with `grep -rn "report: 'return'" packages/*/src scripts` rather than recalled. No red test written yet; nothing here is a defect, so there may never be one.
**Priority:** Medium — no false green today. It is a surface-honesty question about a seam that four packages and eight scripts already depend on, which is exactly the kind that gets more expensive to move.
**Origin:** self-found — raised by the architect lens reviewing PR #118 (plan 0263 Phase 2), which declined the `verdictOf` primitive it had itself proposed in the previous round and named this as the complaint that survives.
**Affects:** `packages/core/src/report.ts` (`withEvidenceGate`, `finishPreset`), `packages/core/src/index.ts` (the root surface), `packages/ts/src/cli/commands/check.ts`, `packages/ts/src/cli/commands/baseline.ts`, `packages/ts/src/core/check-all.ts`, `packages/ts/src/presets/shared.ts`, `packages/core/src/preset-dispatch.ts`, and the three dogfood scripts that use the compound this proposal is about — `scripts/check-corpus.mjs`, `scripts/check-ledger.mjs`, `scripts/check-release.mjs`. (An earlier draft said "eight dogfood scripts", a number no reading of the grep produces: six files directly under `scripts/` contain the string, twelve including `scripts/nonvacuity/`, three contain the compound. It was recalled, in the line claiming derivation — the habit [bug 0267](../bugs/0267-the-freeze-checks-links-not-premises.md) is about, caught by a method review.)

## Problem

ADR-014 requires every emitter to refuse a verdict it has no evidence for. The
mechanism is one kernel function, `withEvidenceGate`
(`packages/core/src/report.ts:100`). It is **private** — not exported from the
root, not from `@nielspeter/eess/internal`.

So every caller that wants _"gate this receipt and hand me the findings"_ reaches
it the only way it can: by calling the **preset finisher** in a mode that
suppresses the emission it exists to do.

```ts
const gated = finishPreset(builder.violations(), { report: 'return' })
```

That line appears at three doors in `eess-ts` (`check`, `check --fix`,
`baseline`), inside `checkAll`, inside `presets/shared.ts`, and at both exits of
`check-corpus.mjs`, `check-ledger.mjs` and `check-release.mjs`. None of them is
finishing a preset. Each is asking one question — _is this receipt evidence of
anything?_ — through a function whose name answers a different one, in a mode
chosen to turn off its documented behaviour.

**This is not a bug and nothing is silently green.** ADR-008 is satisfied at
every site: the caller owns emission, the gate runs before the delivery mode,
and there is no double render. The complaint is that the intent is unreadable
at the call site, and that the seam ADR-014 makes load-bearing is reachable
only as a side effect of another function's options object.

## Existing code survey

| Ask                                               | Finding                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A gate primitive on the kernel root               | **Genuinely new as a surface.** The function exists and is tested through its callers; only the export is missing.                                                                                                                                                                                                           |
| `verdictOf(builders)`, proposed in review round 1 | **Withdrawn by its own author**, and the reason is worth keeping: `verdictOf` is the _merge_ shape, and the merge cannot attribute. PR #118 removed a run-wide merge from the CLI precisely because the finding then named no rule file (bug 0026's seam). A primitive shaped like the thing just deleted is not the answer. |
| `mergeCollectResults`                             | **Already public**, already the kernel's one merge (ADR-014 §7). It answers bundling, not gating.                                                                                                                                                                                                                            |
| `collectResult`                                   | **Already public** — the constructor side of the same contract. The gate is its reader, and only one of the two is named.                                                                                                                                                                                                    |

## Asks

**A. Export the gate under its own name.** Root or `/internal` is the open
question; ADR-011 governs that line and this proposal does not settle it. The
call sites become a statement of intent rather than a mode flag, and ADR-014's
mechanism becomes citable by name.

**B. Decide what `finishPreset(x, { report: 'return' })` then means.** If the
gate is nameable, that call is the compound of two things a caller can now say
separately. Keeping both is fine; what is not fine is leaving the compound as
the _only_ spelling and then citing the gate in a binding ADR.

**C. The `collectViolations` residual.** `packages/ts/src/index.ts:317` exports
a helper typed to accept a bare array and documented as not throwing, so an
adopter calling it with `generateBaseline` by hand still bypasses the gate. PR
#118 states this rather than closing it, deliberately: closing it is a
public-API decision. It is the same question as A — _what is the supported way
to obtain a gated verdict?_ — and should be answered with it, not separately.

## Acceptance criteria

Per ask: the break class it must catch, and what keeps that non-vacuous. Nothing
here is a new _way to fail a build_ — the gate already fails builds today, and A
only names it — so the criteria are about the seam not going quietly inert.

**A — the exported gate.**

- **Break class:** the exported symbol accepts a receipt with no evidence and
  hands back no finding. That is the whole point of the seam, and an export that
  can be emptied without anything reddening would be a worse surface than the
  private function it replaces.
- **Non-vacuity:** the export must be the symbol at least one existing
  `emitter/*` probe drives, by name, rather than a wrapper the probes reach only
  through `finishPreset`. `scripts/vacuity-matrix.mjs` already carries five
  `EMITTER_PROBES` entries; if the named gate is not on the path they exercise, the
  export is decorative and the criterion is not met.
- **Tier:** 1 for the signature, 2 for the behaviour. No new tier is claimed.

**B — what `finishPreset(x, { report: 'return' })` means afterwards.**

- **Break class:** none, and that is the point to state. If both spellings
  survive, the criterion is that they cannot disagree: the same receipt through
  either path yields the same findings. A test that pins the equivalence, or the
  compound implemented in terms of the named gate so divergence is impossible by
  construction.

**C — the `collectViolations` residual.**

- **Break class:** an adopter calls `collectViolations(builders)` with a
  hand-rolled builder and `generateBaseline` writes a baseline from it. Measured
  today: that path is open, by signature and by documented contract.
- **Non-vacuity:** whatever closes it must be driven by the probe rule file
  `check:nonvacuity` already plants, through the helper rather than through the
  CLI — the CLI door is gated and would pass regardless, which is exactly the
  false-green shape that made this residual worth stating.
- **Explicitly deferred:** if the answer is "document it, do not close it", the
  criterion is that the docstring states the hole rather than describing the
  helper as safe. A wrong reassurance is worse than the hole.

## Open questions

These are the author's to settle, and this proposal deliberately does not.

1. **Root or `/internal`?** ADR-011 says the kernel root is public API and
   family plumbing lives behind `/internal`. The gate is arguably both: adopters
   writing rule files never call it, but the dogfood scripts are not family
   plumbing either.
2. **Does naming it invite hand-assembly?** A public gate is also a public way
   to ask "would this pass?" without running anything. Proposal 009's whole
   subject is that hand-assembled verdicts are the failure mode.
3. **Is C in scope for A, or its own break?** Tightening `collectViolations`
   moves a break to adopters' compilers without closing the runtime hole for JS
   callers, which is why PR #118 declined it.

## Out of scope

- The bundling rule itself (_a door that can attribute gates each member and
  never bundles; a door that cannot, merges_). That is a binding decision about
  where the merge applies, and it belongs in ADR-014 §7, which is where PR #118
  writes it — not here.
- Anything about `doctor`, which is [bug 0268](../bugs/0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md).
