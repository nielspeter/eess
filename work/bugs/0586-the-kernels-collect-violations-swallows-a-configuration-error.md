# Bug 0586: the kernel's `collectViolations` swallows a configuration error

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/core/dist` at `bd78b962`; no red test yet.
- **Severity:** High — a false green: a rule that refused to run gives 0 violations and no throw,
  and the documented next step writes a baseline with `count: 0` over it.
- **Origin:** self-found · [proposal 011](../proposals/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01 (all three lenses); reproduced before filing.
- **Reported:** 2026-11-01
- **Part of:** [proposal 011](../proposals/011-core-name-the-evidence-gate.md)'s ask C, which is held; this record owns one of its cases

## Symptom

The kernel's `collectViolations` (`packages/core/src/baseline-generator.ts:26`, on the root at
`packages/core/src/index.ts:89`) calls each builder's `check()` and catches what it throws. It keeps
the error only when `error instanceof ArchRuleError` (`packages/core/src/baseline-generator.ts:33`)
and drops everything else without a word. Three kinds of throw are lost:

- An `ArchConfigError`, which does not extend `ArchRuleError` (`packages/core/src/errors.ts:9`,
  `:83`). That is the error the family throws when a rule is misconfigured, such as the refusal of
  an unknown report mode ([bug 0508](./fixed/0508-an-unknown-report-mode-prints-and-passes.md)).
- Any other error, such as a `TypeError` from a bug in the rule.
- An `ArchRuleError` from a second copy of the kernel. `instanceof` is an identity check, and the
  kernel's own structural test `isArchRuleError` (`packages/core/src/errors.ts:50`) exists for
  exactly that case (`packages/core/src/errors.ts:30`). Here real violations are dropped.

The docstring says the helper "bypasses the evidence gate"
(`packages/core/src/baseline-generator.ts:10`). It says nothing about the swallow. That is an
[ADR-009](../../adr/009-agent-first-failure-surfaces.md) fake green, separate from the gate bypass
that [proposal 011](../proposals/011-core-name-the-evidence-gate.md) ask C is about.

## Reproduction

Throwaway scripts against `packages/core/dist` (built 2026-11-01 08:56; the last commit touching
`packages/core/src` is 2026-10-30, so the build matches the source), on Node 24.22.0.

The first script builds two builders. One ends its `check()` in
`finishPreset(collectResult([], { examined: 3 }), { report: 'retrun' })`, the call every preset
ends in, with a misspelt mode. The other reads a property of `undefined`. It calls each directly,
then through `collectViolations`, then hands the result to `generateBaseline`, as the helper's own
`@example` does. 0.04 s.

```text
direct check(): ArchConfigError - report: 'retrun' is not a report mode; the modes are 'throw', 'return', 'warn'. An unknown mode used to print the violations and pass.
direct check(): TypeError - Cannot read properties of undefined (reading 'rules')
collectViolations(misconfigured, broken): [] | threw: false
baseline written: baseline-0586.json | count: 0 | violations: []
```

The second script copies `packages/core/dist` to a second directory and throws that copy's
`ArchRuleError`, carrying one real violation, from a `check()`. 0.06 s.

```text
isArchRuleError(error from the second copy): true
collectViolations(builder throwing the second copy's ArchRuleError): 0 violations
```

The kernel's own guard calls the error an `ArchRuleError`. The helper drops its violation.

## Root cause

The `catch` keeps one class, by identity, and has no `else`
(`packages/core/src/baseline-generator.ts:33`). An error that is not that class object is neither
harvested nor rethrown.

## Fix

Harvest with `isArchRuleError` and rethrow every other error. A configuration error then fails the
call that generates the baseline, as it fails `check()`, and a second kernel copy's violations are
kept. The docstring keeps its gate-bypass caveat, which is
[proposal 011](../proposals/011-core-name-the-evidence-gate.md) ask C's to close, and stops
describing the helper as harvesting everything a rule throws.

Out of scope here: `generateBaseline` silently drops `bypassFilters` findings
(`packages/core/src/baseline.ts:208`), and eess-ts's own `collectViolations`. Both belong to
[proposal 011](../proposals/011-core-name-the-evidence-gate.md) ask C.

## Verification

- [ ] Red test written first: `collectViolations` over a builder whose `check()` throws
      `ArchConfigError` rethrows it.
- [ ] A builder throwing a `TypeError` rethrows it.
- [ ] An `ArchRuleError` from a second kernel copy is harvested, not dropped.
- [ ] An ordinary `ArchRuleError` is still harvested, and a passing builder still adds nothing.
- [ ] A changeset naming `@nielspeter/eess`. Whether a call that returned `[]` and now throws is
      marked `**Breaking**` is decided in the build, against
      [bug 0508](./fixed/0508-an-unknown-report-mode-prints-and-passes.md)'s precedent (a refusal
      that refuses nothing typed is a patch).
- [ ] `npm run validate` green.

Deferred: none
