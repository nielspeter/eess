# Proposal 011 — core: name the evidence gate, instead of reaching it through a reporting function

**State:** Draft — reviewed 2026-11-01 (architect · product · enforcement), ruling `Split and sequence`; see `## Review — 2026-11-01` below. Asks A and B rejected; ask C held, with two of its cases recorded as [bug 0586](../bugs/0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and [bug 0595](../bugs/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md). **What this proposal produces is a decision, not a change**: ask A cannot be evaluated until root-vs-`/internal` is settled (open question 1), so accepting it schedules that decision rather than an implementation. Surveyed against the repo source at the head of `plan-0263-phase-2`; every call site below was enumerated with `grep -rn "report: 'return'" packages/*/src scripts` rather than recalled. No red test written yet; nothing here is a defect, so there may never be one.
**Priority:** Medium — no false green today. It is a surface-honesty question about a seam that four packages and eight scripts already depend on, which is exactly the kind that gets more expensive to move.
**Origin:** self-found — raised by the architect lens reviewing PR #118 ([plan 0263](../plans/completed/0263-adr-014s-residual-enforcement-rows.md) Phase 2), which declined the `verdictOf` primitive it had itself proposed in the previous round and named this as the complaint that survives.
**Affects:** `packages/core/src/report.ts` (`withEvidenceGate`, `finishPreset`), `packages/core/src/index.ts` (the root surface), `packages/ts/src/cli/commands/check.ts`, `packages/ts/src/cli/commands/baseline.ts`, `packages/ts/src/core/check-all.ts`, `packages/ts/src/presets/shared.ts`, `packages/core/src/preset-dispatch.ts`, and the three dogfood scripts that use the compound this proposal is about — `scripts/check-corpus.mjs`, `scripts/check-ledger.mjs`, `scripts/check-release.mjs`. (An earlier draft said "eight dogfood scripts", a number no reading of the grep produces: six files directly under `scripts/` contain the string, twelve including `scripts/nonvacuity/`, three contain the compound. It was recalled, in the line claiming derivation — the habit [bug 0267](../bugs/0267-the-freeze-checks-links-not-premises.md) is about, caught by a method review.)

## Problem

[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) requires every emitter to refuse a verdict it has no evidence for. The
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

**This is not a bug and nothing is silently green.** [ADR-008](../../adr/008-caller-owns-reporting.md) is satisfied at
every site: the caller owns emission, the gate runs before the delivery mode,
and there is no double render. The complaint is that the intent is unreadable
at the call site, and that the seam [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) makes load-bearing is reachable
only as a side effect of another function's options object.

## Existing code survey

| Ask                                               | Finding                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A gate primitive on the kernel root               | **Genuinely new as a surface.** The function exists and is tested through its callers; only the export is missing.                                                                                                                                                                                                                       |
| `verdictOf(builders)`, proposed in review round 1 | **Withdrawn by its own author**, and the reason is worth keeping: `verdictOf` is the _merge_ shape, and the merge cannot attribute. PR #118 removed a run-wide merge from the CLI precisely because the finding then named no rule file (ts-archunit bug 0026's seam). A primitive shaped like the thing just deleted is not the answer. |
| `mergeCollectResults`                             | **Already public**, already the kernel's one merge ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7). It answers bundling, not gating.                                                                                                                                                                     |
| `collectResult`                                   | **Already public** — the constructor side of the same contract. The gate is its reader, and only one of the two is named.                                                                                                                                                                                                                |

## Asks

**A. Export the gate under its own name.** Root or `/internal` is the open
question; [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) governs that line and this proposal does not settle it. The
call sites become a statement of intent rather than a mode flag, and [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s
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

1. **Root or `/internal`?** [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) says the kernel root is public API and
   family plumbing lives behind `/internal`. The gate is arguably both: adopters
   writing rule files never call it, but the dogfood scripts are not family
   plumbing either.
2. **Does naming it invite hand-assembly?** A public gate is also a public way
   to ask "would this pass?" without running anything. [Proposal 009](./009-core-a-verdict-cannot-be-assembled-by-hand.md)'s whole
   subject is that hand-assembled verdicts are the failure mode.
3. **Is C in scope for A, or its own break?** Tightening `collectViolations`
   moves a break to adopters' compilers without closing the runtime hole for JS
   callers, which is why PR #118 declined it.

## Out of scope

- The bundling rule itself (_a door that can attribute gates each member and
  never bundles; a door that cannot, merges_). That is a binding decision about
  where the merge applies, and it belongs in [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7, which is where PR #118
  writes it — not here.
- Anything about `doctor`, which is [bug 0268](../bugs/0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md).

## Review — 2026-11-01

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, each on its own reading of the code at
`bd78b962`. Each lens on its own said ship with changes, and each made the same change its
condition: the proposal holds two decisions, not one. A and B are one decision, because B holds by
construction once A exists. C is a separate decision. It has a different release class (a behaviour
break, where A is additive), a different sink, and the proposal's only open fail-open. A root
placement for A is also an amendment to
[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) before it is a plan.

The verdict is a split rather than `Ship with changes` because the split is the change. It leans on
measured evidence about open question 3, which stays the author's. If the author rules that C stays
bundled with A, the honest verdict becomes `Ship with changes`. The measurements were throwaway
scripts against `packages/core/dist`, 0.04 to 0.26 s each, and no tracked file was touched.

### Existing code survey, corrected

- **A is new as a surface, not as a capability.** `withEvidenceGate`
  (`packages/core/src/report.ts:101`) is in neither the root nor `/internal`, and no dialect names
  one. But `finishPreset(x, { report: 'return' })` is root-public and already answers "would this
  pass?": the gate runs at `packages/core/src/report.ts:305`. Naming it adds discoverability, not
  power. It is already written by hand once, as the inline `gate` in
  `scripts/nonvacuity/bad-emitter-remedies.mjs:27`.
- **B is already true by construction, with one caveat.** The compound equals the gate only when
  `expectEmpty` is not passed, because `finishPreset` folds `expectEmpty` into `declaredEmpty`
  first. None of the 12 call sites passes `expectEmpty`, `format` or `reason`, so a migration is
  drop-in.
- **C is two helpers, not one.** Core's `collectViolations`
  (`packages/core/src/baseline-generator.ts:26`) takes builders whose `check()` throws. eess-ts's
  (`packages/ts/src/helpers/baseline-generator.ts:26`, exported at `packages/ts/src/index.ts:319`)
  takes `violations()` builders and drops `examined`.
- **The call sites at HEAD** are 5 in eess-ts, 1 in eess-mermaid
  (`packages/mermaid/src/cli/commands/check.ts:154`, from
  [bug 0269](../bugs/fixed/0269-eess-mermaids-check-door-greenlights-a-builder-that-enforces-nothing.md)),
  6 in scripts, and the nonvacuity helper.
- **Since 2026-09-07**, [plan 0235](../plans/completed/0235-the-emitter-takes-a-receipt.md) retyped
  every emitter to take a receipt, with the gate before the mode. So the compound is fail-closed, as
  the proposal says. Nothing since has named or exported the gate.

### Placement

- **A lives in `packages/core` and nowhere else.** Every door in eess-ts and eess-mermaid wants it,
  and so does every script that loads no dialect. No dialect should own a copy.
- **Root or `/internal` is open question 1, and it stays the author's.** The lenses agree on the
  evidence:
  - For `/internal`: every measured caller is family code or this repository's scripts, and the
    scripts already import `/internal`. `readReportMode`, from the same module, is already there.
    Moving from `/internal` to the root is additive, and the reverse is a break, so `/internal`
    keeps the other option open.
  - For the root: eess-md, eess-gherkin and eess-crossvalidate ship no binary, and their adopters
    cannot reach `/internal` through a re-export
    ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) §2). [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s Alternatives
    section rejected moving emitters to `/internal` because "a hidden seam is not an honest one".
    And every forcing function applies only on the root: `check:surface`, the family re-export
    gate, `receipt-constructors.test.mjs` and the vacuity classification. In `/internal` the gate
    would be the first verdict door that no instrument enumerates.
- **C is closed in the package that owns each helper**, core and eess-ts. Neither needs an export:
  core's helper sits beside the private gate, and eess-ts's can gate per member as its `baseline`
  command already does.
- **`isEmitterFinding` and `EMITTER_IDS` do not follow the gate onto the root by default.**
  [Proposal 009](./009-core-a-verdict-cannot-be-assembled-by-hand.md)'s reason for keeping them
  internal stands. The proposal should say whether they move.

### Critical (must be settled before a plan)

1. **A on the root is the shape [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
   already rejected, and the proposal does not engage it.** `throwIfViolations` was deleted as "a
   second name for the same seam", one that hides the `report` option
   [ADR-008](../../adr/008-caller-owns-reporting.md) made the caller's to choose. A named gate is
   `finishPreset` with the mode pinned to `'return'`, just as `throwIfViolations` pinned `'throw'`.
   The architect found a real distinguishing argument: pinning `'throw'` hid an emission choice,
   while a pure gate removes emission and names the detection half of [ADR-008](../../adr/008-caller-owns-reporting.md). The proposal must
   make that argument itself, and say that A on the root amends [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §1 (its count of "two"
   exports on the kernel root) and its Alternatives section. That amendment is a binding decision:
   the ADR comes first, the plan after. A in `/internal` is still bound by §1 ("every exported
   path") but needs no change to its text. All three lenses raised this.
2. **A's non-vacuity criterion names an instrument that cannot score a correct gate.** `classify()`
   in `scripts/vacuity-matrix.mjs:67` reads only a throw as red. A gate that returns its findings,
   which is what all 12 sites need, scores `fail-open` (measured on the compound). `EMITTER_PROBES`
   also has no falsifier of its own
   ([bug 0270](../bugs/0270-the-vacuity-matrix-reports-zero-fail-open-doors-while-one-is-stated-open.md)),
   and no probe of `finishPreset` can tell "calls the export" from "calls a private copy". The
   instrument that already does this job is `scripts/nonvacuity/bad-emitter-remedies.mjs`. It
   asserts by rule id, its cases are bound to `EMITTER_IDS` in both directions, and it covers all
   six branches of the gate. Measured: a copy with one branch filtered out went red in 0.06 s. The
   criterion becomes: the named export replaces the inline `gate` at
   `scripts/nonvacuity/bad-emitter-remedies.mjs:27`, by import.
3. **C names the wrong sink, so its criterion can be met while the break stays open.**
   `generateBaseline` drops `bypassFilters` findings without a word and writes the file anyway
   (`packages/core/src/baseline.ts:203-208`). Measured: a gated `emitter/no-receipt` receipt
   produced a `count: 0` baseline and did not throw. So gating `collectViolations` alone satisfies
   "driven through the helper" and closes nothing. The CLI door refuses here
   (`packages/ts/src/cli/commands/baseline.ts:101`); the library sink does not. C is restated as two
   break classes, each with its own falsifier:
   - the helper's return value reads as a pass for a builder that certified nothing;
   - `generateBaseline` writes a baseline over a receipt that carries a configuration finding.

   The closure must **refuse** (throw), not hand the finding back. It must also keep each builder's
   receipt, by gating per member ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §7) or through `mergeCollectResults`. Flattening and then
   gating is not acceptable: it stacks an `emitter/no-receipt` whose remedy blames the adopter for
   what the helper threw away, [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4's "false second remedy" (measured). The architect and
   enforcement lenses both raised this.

### Important

1. **C does not depend on A, and this is what the split turns on.** Both of C's real break classes
   sit in functions that do not call the gate and do not need its name to be fixed. Open question
   3's premise is also weaker than stated: a runtime gate inside the helper works on a bare array,
   so closing C is a behaviour break, not a compile break, and it closes the JavaScript hole too.
   C's release class is a `minor` with a `**Breaking**` changeset that names every re-exporting
   dialect ([bug 0185](../bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md)).
   A is additive. This is evidence for the author's question, not a ruling on it.
2. **A named gate that does not throw is a silent green when its result is thrown away**, and the
   proposal does not name that break class. `reportViolations` throws on an emitter finding for
   exactly this reason (`packages/core/src/report.ts:230-235`, [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §5). The author picks a
   precedent: return only, like the compound, paired with a Tier-1 rule in `arch.rules.ts` against
   a bare call as a statement and a stated adopter ceiling; or return and throw on an emitter
   finding, like `reportViolations`, saying which of the 12 sites must catch to keep per-file
   attribution. Either way the name reads as a function that returns a value.
3. **The gate is not idempotent, and a named gate makes `gate(gate(x))` a contract.** Measured and
   reproduced: `{ examined: 3, declaredEmpty, sourceEmpty }` gains `emitter/contradictory-evidence`
   on a second pass, and `{ examined: 3, notRun, sourceEmpty }` gains it twice. Each contradiction
   branch reports the first contradiction it finds and carries the next one forward, against
   [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4 and the gate's own docstring. The review took it to be reachable wherever a script gates and then calls `reportViolations`
   (`scripts/check-corpus.mjs:1667-1668`); [bug 0587](../bugs/0587-the-evidence-gate-adds-a-finding-again-on-a-second-pass.md) then measured otherwise: both scripts build
   their receipt with `mergeCollectResults`, and none of 33,824 merged receipts differed after a
   second pass. It is red either way, so it is not a false green.
   Recorded as
   [bug 0587](../bugs/0587-the-evidence-gate-adds-a-finding-again-on-a-second-pass.md). A's
   acceptance criteria pin idempotence.
4. **Core's `collectViolations` swallows every throw that is not an `ArchRuleError`, and its
   docstring does not say so.** It keeps only `instanceof ArchRuleError`
   (`packages/core/src/baseline-generator.ts:29-37`), and `ArchConfigError` is not a subclass
   (`packages/core/src/errors.ts:83`). Measured and reproduced: a builder throwing `ArchConfigError`,
   beside one throwing `TypeError`, gives 0 violations and no throw, so a misconfigured rule writes a
   clean baseline through the documented programmatic route. This is an
   [ADR-009](../../adr/009-agent-first-failure-surfaces.md) fake green, separate from the gate
   bypass. All three lenses found it. Recorded as
   [bug 0586](../bugs/0586-the-kernels-collect-violations-swallows-a-configuration-error.md), linked
   from C and not folded into this proposal.
5. **The defect an adopter can see is in the docs of root-public API.** `finishPreset`'s docstring
   says `return` "hands the violations back untouched" (`packages/core/src/report.ts:282-283`), and
   `docs/api-reference.md` says the emitters "hand the same value back" and describes `return`
   without the gate. Since [plan 0235](../plans/completed/0235-the-emitter-takes-a-receipt.md) all
   three are false whenever the gate fires, and they invert the truth: a reader concludes that the
   compound bypasses the gate. Recorded as
   [bug 0585](../bugs/0585-finish-presets-docs-say-report-return-hands-back-the-violations-untouched.md),
   a core patch, whatever the ruling on A.
6. **B's equivalence is stated over the right options, and "by construction" gets a falsifier.**
   The equivalence holds without `expectEmpty`, and covers `reportViolations` as a third spelling.
   "Divergence impossible by construction" is code reading (Tier 5) unless it is pinned: either a
   Tier-1 rule in `arch.rules.ts` that `finishPreset` and `reportViolations` call the gate, or a
   Tier-2 run of the remedies fixture's cases over both spellings (about 0.06 s, in process).
7. **The gate's signature, if A ships:** a `CollectResult` in and a `CollectResult` out; no
   `expectEmpty` option, because a declaration travels on the receipt ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §3); the runtime
   guard for a bare array kept; and no branded "gated" type, which would be a type-level registry
   [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) rules out. The name is not `with…`, which reads as a wrapper; not "verdict", given
   [proposal 009](./009-core-a-verdict-cannot-be-assembled-by-hand.md); not "check", which throws;
   and nothing a stranger could confuse with `hasEvidence`. `docs/api-reference.md` says how the
   gate differs from `hasEvidence`.
8. **A gate on the root moves eess-ts too.** `agentGuardrails` finds emitters by callee name
   (`packages/ts/src/presets/agent-guardrails.ts:142`), so a new name is a rule change an adopter can
   see. Its import leg still catches a runtime import outside rule files, so there is no hole, but
   the callee list goes stale. On the root, A is a minor for core, eess-ts and eess-mermaid. In
   `/internal`, it is a core minor and a patch for eess-ts and eess-mermaid.
9. **Open question 2's risk is smaller than stated.** Naming the gate adds no power to forge:
   `collectResult` plus `finishPreset(x, { report: 'return' })` already answers "would this pass?"
   from the root, and a forged `examined: 1` passes either spelling, which is [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s Tier-5
   ceiling. The new hazard is Important 2, not hand-assembly. Evidence for the author, not a ruling.
10. **A deferred C leaves the instrument reporting zero debt.** `KNOWN_FAIL_OPEN` in
    `scripts/vacuity-matrix.mjs` lists neither helper, and the vacuity classification files eess-ts's
    `collectViolations` under `NOT_CHECKS`. A deferral is honest only if
    [bug 0270](../bugs/0270-the-vacuity-matrix-reports-zero-fail-open-doors-while-one-is-stated-open.md)'s
    first move travels with it. C also carries no tier: a closure driven by a fixture is Tier 2, and a
    docstring deferral is Tier 5.

### Minor

- [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s Enforcement row for zero examined at the emitter still counts five probes. The fix goes
  with whatever amends §1, not under this review.
- Three scripts reimplement `isEmitterFinding` as `ruleId.startsWith('emitter/')`, a different
  predicate from the kernel's membership test. It shows callers want "gate, then tell me what the
  gate added". Whether `isEmitterFinding` moves with the gate is part of open question 1.
- `docs/presets.md` composes `finishPreset(recommended(p, { report: 'return' }), …)`. That is a real
  preset finish and is correctly not a migration target, as are the finishes in
  `scripts/check-guardrails.mjs`, `scripts/check-baseline.mjs` and the preset finishes in
  `scripts/check-corpus.mjs` and `scripts/check-ledger.mjs`.

### Corrections to the submission

Recorded here, not fixed in the text above:

- The Priority line still says "four packages and eight scripts", although the Affects paragraph
  retracts the eight as recalled. The correction was made once and the claim survives beside it,
  which is [bug 0267](../bugs/0267-the-freeze-checks-links-not-premises.md)'s habit.
- `packages/core/src/report.ts:100` is now `:101`, and `packages/ts/src/index.ts:317` is now `:319`.
- "Five `EMITTER_PROBES`" is now six.
- Affects misses `packages/mermaid/src/cli/commands/check.ts` and
  `scripts/nonvacuity/bad-emitter-remedies.mjs`, and the second is the migration that matters most.
  It lists `packages/core/src/preset-dispatch.ts`, which has no call site, only a doc comment.
- Ask B's premise, "citing the gate in a binding ADR", is hypothetical: [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) never names
  `withEvidenceGate`; it cites `finishPreset`.
- Ask C names `collectViolations` as the sink, but the silent drop is in `generateBaseline`
  (Critical 3). Its "explicitly deferred" criterion is met for the gate bypass in both docstrings,
  but not for core's swallow of a configuration error (Important 4).

### Disposition

| Ask                                                               | Disposition | What would unhold it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — export the gate under its own name                            | `Rejected`  | Decided after the review (2026-11-01), overrulable: no caller lacks the capability. `finishPreset(x, { report: 'return' })` runs the gate and returns the result on the root today (`packages/core/src/report.ts:305`), and all twelve measured call sites use it. A second root name is what [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) removed with `throwIfViolations`. In `/internal` it is allowed ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §1 binds it as written), but its only callers are family code and this repository's scripts, which already have the working spelling. The docs gap that motivated A, `report: 'return'` described as returning the violations untouched, is [bug 0585](../bugs/0585-finish-presets-docs-say-report-return-hands-back-the-violations-untouched.md)'s to fix                                                                                                                 |
| B — what `finishPreset(x, { report: 'return' })` means afterwards | `Rejected`  | Nothing to do: it already holds, since `finishPreset` calls the gate (`packages/core/src/report.ts:305`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| C — the `collectViolations` residual                              | `Held`      | C is restated against all three sinks with a falsifier each, and keeps each builder's receipt. Two of its cases are recorded and owned: [bug 0586](../bugs/0586-the-kernels-collect-violations-swallows-a-configuration-error.md) (core's `collectViolations` swallows a configuration error) and [bug 0595](../bugs/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md) (`generateBaseline` drops a configuration finding without a word). The third is C's own: eess-ts's `collectViolations` flattens each builder's result to a bare list, so a rule that examined nothing reaches `generateBaseline` as `[]` with no finding and the baseline writes `count: 0` (measured 2026-11-01 by PR #290's method review). [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s ceiling row, `docs/core-concepts.md` and the helper's docstring name this ask as the one that closes it. Unheld when C is restated against the three, then re-reviewed |

The review left open where a named gate would live (open question 1). With A rejected, the question
does not arise: neither placement serves a caller that lacks the capability.

### Recorded outside this proposal

Each was found by measurement during this review and is its own record, independent of the ruling:

- [Bug 0585](../bugs/0585-finish-presets-docs-say-report-return-hands-back-the-violations-untouched.md):
  `finishPreset`'s docs say `report: 'return'` hands the violations back untouched.
- [Bug 0586](../bugs/0586-the-kernels-collect-violations-swallows-a-configuration-error.md): the
  kernel's `collectViolations` swallows a configuration error.
- [Bug 0587](../bugs/0587-the-evidence-gate-adds-a-finding-again-on-a-second-pass.md): the evidence
  gate adds a finding again on a second pass.

**Recommended next step:** A and B are rejected (the disposition above), so open questions 1 and 2
no longer arise. C is restated against its three sinks: core's `collectViolations` and
`generateBaseline`, each with a bug of its own, and eess-ts's `collectViolations`, which drops a
builder's evidence. It keeps each builder's receipt and gives each sink a falsifier. Then C alone
is re-reviewed. [Bug 0586](../bugs/0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and [bug 0595](../bugs/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md) can be fixed before that, since neither depends on the restated
ask.
