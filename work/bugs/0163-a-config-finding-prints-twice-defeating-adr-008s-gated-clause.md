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

`packages/core/src/execute-rule.ts:186` — `executeWarn` writes the report
unconditionally before throwing, and the CLI then renders the aggregated set
again. Upstream's fix introduced a `setCallerAggregatesReports` switch so the
inner path stays silent when a caller will aggregate; eess has no equivalent
(`grep -rn "setCallerAggregatesReports" packages/` returns nothing).

Predates plan 0088's fold. See the [fold audit](../fold-audit-2026-08-19.md).

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

1. Give the kernel one emitter for this path too — a `setCallerAggregatesReports`
   equivalent, or restructure so `executeWarn` never reports directly when a
   caller will aggregate.
2. Update ADR-008's Enforcement row so its Mechanism column names something
   that would fail if this regressed. If no such mechanism is available, the
   row's Status is not `gated` and should say so.

## Verification

- [ ] Red test first: a throwing `.warn()` plus a failing `.check()` in one
      rule file emits each configuration finding **once**, and `--format json`
      reports the true total. Fails today.
- [ ] Control: the ordinary (non-throwing) path still reports exactly once.
- [ ] ADR-008's Enforcement row either cites a mechanism that covers this path,
      or its Status is corrected.
- [ ] `npm run validate` green, `check:corpus` green on the amended ADR.

Deferred: none.
