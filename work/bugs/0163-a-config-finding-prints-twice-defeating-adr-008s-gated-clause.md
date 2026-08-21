# Bug 0163: A configuration finding prints twice, defeating ADR-008's gated one-emitter clause

## Status

- **State:** Draft — reproduced through the shipped CLI; no red test yet.
- **Severity:** Medium — honesty gap, not a false green: the finding is
  reported, twice, and the JSON count is inflated. It is filed at this severity
  because what it breaks is a **binding ADR clause marked `gated`**.
- **Origin:** self-found · [fold audit](../fold-audit-2026-08-19.md)
  (upstream bug 0029)
- **Reported:** 2026-08-19

## Symptom

A rule file whose `.warn()` throws emits its configuration finding twice in
terminal output — once from `executeWarn`, once from the CLI's own re-render —
and `--format json` reports `total: 2` for one finding.

## Reproduction

A rule file with a throwing `.warn()` followed by a `.check()` producing four
violations, run through `packages/ts/dist/cli/bin.js check`:

```
terminal: the config finding appears as "[1 of 1]" and again as "[1 of 2]"
--format json: total: 2
```

## Root cause

`packages/core/src/execute-rule.ts` — `executeWarn` writes the report
unconditionally before throwing, and the CLI then renders the aggregated set
again. Upstream's fix introduced a `setCallerAggregatesReports` switch so the
inner path stays silent when a caller will aggregate.

Predates plan 0088's fold. See the [fold audit](../fold-audit-2026-08-19.md).

### Restated 2026-08-21 — half of this is now fixed, on one of two copies

**This section said "eess has no equivalent (`grep -rn
"setCallerAggregatesReports" packages/` returns nothing)". That is no longer
true.** Re-run today, that grep returns four hits. The switch arrived with the
engine copy ([plan 0165](../plans/completed/0165-integrate-the-copied-ts-archunit-engine.md))
and is wired end to end on the **eess-ts** path:

- `packages/ts/src/core/execute-rule.ts` declares and exports it;
- `packages/ts/src/cli/commands/check.ts` calls `setCallerAggregatesReports(true)`;
- and the same file's warn path honours it, filtering exactly the findings that
  ride on the throw: `callerAggregatesReports ? stamped.filter((v) =>
v.bypassFilters !== true) : stamped`.

**The kernel copy did not get it.** `packages/core/src/execute-rule.ts`'s
`executeWarn` still calls `reportViolations()` unconditionally — the behaviour
this record was filed about, at the line it cites.

This is a consequence of a state plan 0165 Phase 2 names: **27 ts-morph-tainted
modules remain duplicated** between `packages/core/src` and
`packages/ts/src/core`, `execute-rule` among them. A fix applied to one copy
silently leaves the other alone, and nothing in the corpus recorded that this
bug had become half-fixed.

**Reachability, measured rather than assumed.** The defect needs an aggregating
caller driving rules through the _kernel_ copy. Today there is none:
`eess-ts check` is the only aggregating CLI and it drives eess-ts rules through
the ts copy, which honours the flag; `eess-md` ships no CLI at all, and
`eess-mermaid`'s does not call `reportViolations`. So the kernel half is
**latent** — a real defect with no current trigger, which is why this record
stays open at Medium rather than closing.

What has **not** changed is the second half of this bug, and it is the half the
severity was argued from: ADR-008's Enforcement row still claims `gated` over a
mechanism that does not cover this path. The row is now additionally misleading,
because the path it fails to cover is one where two implementations disagree.

## Why it matters — this is an ADR faithfulness failure, not just noise

[ADR-008](../../adr/008-caller-owns-reporting.md) names double render as its
**motivating defect**, and its Enforcement table carries the clause _"One
emitter shared by both paths"_ at **Tier 1, `gated`**, with the mechanism
stated statically as "`executeCheck` and `finishPreset` both call
`reportViolations`".

That mechanism does not cover the config-finding path. So the row is green over
a real double render — an Enforcement-table row asserting more than its
mechanism checks. That is the class this repo files bugs about (0116, 0128) and
the class `check:corpus`/`check:crossval` exist to prevent.

Fixing the behaviour is half the work; the other half is making ADR-008's row
honest — either by widening the mechanism to cover this path, or by narrowing
the clause to what it actually gates.

## Fix

1. Give the kernel one emitter for this path too. **Restated 2026-08-21:** the
   eess-ts half of this is already done, so what remains is either porting the
   switch to `packages/core/src/execute-rule.ts` or — better, and the reason
   this is not simply "copy it across" — unifying the two `execute-rule` copies,
   which is plan 0165's named remainder and blocked on an ADR-shaped decision.
   Porting the switch fixes the symptom while doubling the duplication that
   caused it.
2. Update ADR-008's Enforcement row so its Mechanism column names something
   that would fail if this regressed. If no such mechanism is available, the
   row's Status is not `gated` and should say so.

## Verification

- [ ] Red test first: a throwing `.warn()` plus a failing `.check()` in one
      rule file emits each configuration finding **once**, and `--format json`
      reports the true total. **Restated 2026-08-21:** this must be written
      against the KERNEL path — through `eess-ts` it now passes, and a test
      written the obvious way would be green on arrival and prove nothing.
- [ ] Control: the ordinary (non-throwing) path still reports exactly once.
- [ ] ADR-008's Enforcement row either cites a mechanism that covers this path,
      or its Status is corrected.
- [ ] `npm run validate` green, `check:corpus` green on the amended ADR.

Deferred: none.
