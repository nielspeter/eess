# Bug 0201: `setCallerAggregatesReports` is module state that does not cross jiti's registry

## Status

- **State:** Draft — root cause of [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md),
  which shipped a notice rather than this fix.
- **Deferred:** none
- **Found:** 2026-08-21, while fixing 0199.

## Symptom

`eess-ts check` sets `setCallerAggregatesReports(true)` so that a self-executing
rule file's terminals stay silent and the CLI reports once, at the end, across
every rule file. The flag is **module-level state**:

`packages/ts/src/core/execute-rule.ts:419`

```ts
let callerAggregatesReports = false
```

A rule file does **not** load through the same module registry as the CLI that
loads it — `load-rules.ts` uses jiti (bug 0074: a `.ts` rule file must load
inside a `"type": "commonjs"` consumer project), and jiti keeps its own registry.
So the rule file gets its **own copy** of `execute-rule.js`, with
`callerAggregatesReports` still `false`.

Its terminals therefore write their own report. The CLI's `setCallerAggregatesReports(true)`
never reaches them.

## Consequences

1. **Findings print twice in principle, and unfiltered in practice.** The rule
   file's copy writes the raw violations; the CLI then collects the same
   violations off the thrown `ArchRuleError` and filters them (baseline, diff-aware,
   comment suppression) — so what the user reads is the _unfiltered_ set, followed by
   a report that legitimately omits them. That is [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md),
   whose measured symptom was accepted violations appearing as failures against a
   baseline that matched them 5/5.
2. **Every other CLI-side filter has the same hole.** `--changed` (diff-aware) and
   comment suppression run in the same place as the baseline. Nothing has measured
   those two; the mechanism says they leak identically.

## This is the same boundary that already bit `instanceof`

`packages/core/src/errors.ts` carries `isArchRuleError` precisely because
`error instanceof ArchRuleError` is **false** across the jiti boundary, and its
docblock records that the false negative made `check.ts` skip `ruleFileTruncated()`.
The identity problem was solved there by duck-typing. The **state** problem is the
same boundary and is unsolved.

## Fix

Not decided, and it is a design decision rather than a patch — which is why 0199
shipped a notice instead.

The obvious mechanism is a `globalThis`-keyed singleton, so both module copies read
one flag. **This codebase currently uses `globalThis` nowhere** (measured: zero hits
across `packages/*/src`), so adopting it is a new cross-cutting pattern that wants an
ADR — it introduces process-global mutable state into a library whose ADR-008 is
specifically about not doing reporting implicitly.

Alternatives worth weighing in that ADR:

1. **`globalThis` singleton** — smallest code change, new global-state pattern.
2. **Pass the flag through the loader** — `load-rules.ts` could hand the imported
   module's own `setCallerAggregatesReports` the value, since it holds the jiti
   instance. No global state; requires the rule module to expose it.
3. **Let the CLI own reporting by construction** — if the CLI always invoked rules
   rather than letting module scope self-execute, the flag would be unnecessary.
   That is the largest change and closest to ADR-008's intent.

## Verification

- [ ] Red test first: a self-executing rule file under `eess-ts check` must not
      write its own report — asserted on the rule file's output, not the CLI's.
- [ ] `--changed` and comment suppression are measured for the same leak, and the
      result recorded either way.
- [ ] With the fix, [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)'s
      `baselineNotApplied` notice becomes unreachable — so either it is removed, or
      its test is re-pointed at a case that can still occur. A notice that can no
      longer fire is a vacuous rule (ADR-010).
