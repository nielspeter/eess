# Bug 0199: a bare preset call throws before `--baseline` can filter, so accepted violations resurface

## Status

- **State:** Fixed — the run now says the baseline did not apply, instead of
  failing in silence. Option 2 of the three below, chosen deliberately; the root
  cause is [bug 0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md).
- **Deferred:** [0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md) — the root cause, and the non-vacuity fixture with it
- **Found:** 2026-08-21, while measuring ts-archunit → eess-ts baseline
  compatibility for [bug 0198](../0198-no-migration-path-from-ts-archunit.md).

## Symptom

A rules file that calls a preset **without** `report: 'builders'`:

```ts
export default [...recommended(p)]
```

evaluates the preset at **module-evaluation time**. `deliver()` defaults to
`report: 'throw'` (ADR-008), so the preset throws the moment it finds a
violation — **before** the CLI's baseline filtering ever runs. The `--baseline`
flag is silently inert.

Measured: a project with a full, byte-matching baseline covering **all 5** of its
violations still exits **1**, reporting 2 of the 5 as failures.

```
npx eess-ts check arch.rules.ts --baseline arch-baseline.json
→ exit 1
  src/services/order-service.ts:4 — OrderService.place     ← in the baseline
  src/services/report-service.ts:6 — ReportService.todo    ← in the baseline
```

Both are present in `arch-baseline.json` at exactly those positions. The same
project with `report: 'builders'` added exits **0** with all 5 suppressed.

## Why the failure is quiet in the worst way

The user gets a red build listing violations they have already accepted, and
**nothing in the output mentions the baseline at all**. The rule-file finding
says the file "stopped evaluating", which is true and useless — it points at
evaluation order, not at the reason their accepted debt reappeared. Nothing says
"your preset call is enforcing directly, so `--baseline` did not apply."

It also truncates the run: the throw stops the file, so every rule declared after
the first throwing preset never runs. In the measurement, `agentGuardrails(...)`
on the next line was never evaluated and its 3 violations went unreported — a
**silent under-report** sitting beside a red build.

## Who hits it

- **Every `@nielspeter/ts-archunit` migrator, with certainty.** ts-archunit's
  `recommended()` returns builders directly — it has no `deliver()` and never
  throws. eess-ts's routes through `deliver()`. So the identical rules file,
  with only the import specifier changed, behaves differently. See 0198.
- **Anyone hand-writing rules from the README.** `packages/ts/README.md:175`
  describes `recommended(p)` in exactly the bare form that triggers this.
- **Not** users of `eess-ts init` — it scaffolds `report: 'builders'` on all 8
  preset calls, which is why this never showed up in the repo's own dogfooding.

## Root cause — and this record's first diagnosis was WRONG

**What this bug originally said:** "the preset throws at module-eval time, before
the CLI's baseline filtering runs; the `--baseline` flag is silently inert."

**That is false, and it would have sent the next reader to the wrong layer.**
Measured while fixing it: `runCheck` **does** collect a thrown terminal's
violations off the error (`failureOrViolations`, `check.ts:88`) and **does** filter
them. Against a matching baseline the CLI's own collection came back **empty** —
the filtering worked exactly as designed, and the run's own summary counted zero
violations from it.

**What actually leaks is the rule file's own printing.**
`setCallerAggregatesReports` exists so a self-executing rule file's terminals stay
quiet and the CLI reports once. It is **module-level state**
(`packages/ts/src/core/execute-rule.ts:419`), and a rule file loads through
**jiti's separate module registry** — the same boundary that already makes
`error instanceof ArchRuleError` false and forced `isArchRuleError` into existence.
So the rule file holds its own copy of that module with the flag `false`, its
terminal writes an **unfiltered** report, and only then throws.

The user therefore reads violations they have already accepted, while the CLI
quietly agrees those violations were accepted and prints nothing about them.

That root cause is [bug 0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md).
It also means `--changed` and comment suppression have the same hole; neither has
been measured.

**Why the wrong version is left standing above rather than edited away:** the
symptom section was written from a black-box measurement and was accurate about
what a user sees. Only the mechanism was invented, and by the reasoning this
corpus applies elsewhere, a wrong fault attribution is worth recording next to the
right one.

## Fix — Option 2, deliberately

The CLI cannot filter output another module instance already wrote, so it says so:
`baselineNotApplied()` in `packages/ts/src/cli/rule-file-findings.ts`, pushed at
the same `isArchRuleError` boundary as `ruleFileTruncated()` and only when
`--baseline` was actually passed.

```
  Rule: eess-ts: baseline

  This rule file reported findings itself, and `--baseline` was NOT applied to
  them — any violation printed above reached you unfiltered by
  `arch-baseline.json` … The rules the CLI collected were filtered normally.
  Fix: Pass `report: 'builders'` to the preset(s) in this file …
```

**Option 1 or 3 would be the real repair and both are blocked on a decision.**
Making the flag cross registries needs a `globalThis` singleton — a pattern this
codebase uses **nowhere** today, and process-global mutable state in a library
whose ADR-008 is about not doing reporting implicitly. That belongs in an ADR, not
in a bug fix, and it is [bug 0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md).
Until then a wrong-looking build that explains itself beats one that does not.

**One thing the fix nearly lost.** The first version reused
`rule: 'eess-ts: rule file'`, and `dedupeConfigFindings` keys on
`file + rule + element` — so it merged into `ruleFileTruncated()` and the notice
vanished entirely, with the test still red and the cause invisible. It carries its
own `rule: 'eess-ts: baseline'` for that reason, and the comment in the source says
so.

### The options as originally stated

The design question is which layer owns it:

1. **The preset consults the baseline** — requires the baseline path to be
   reachable from `deliver()`, which crosses the boundary ADR-008 draws between
   detection and emission.
2. **The CLI refuses the combination** — if `--baseline` is passed and a rule
   file throws out of a preset, report that specifically: "`--baseline` was not
   applied; this preset enforces inline — pass `report: 'builders'`." Cheap,
   honest, and fails loudly instead of quietly.
3. **The CLI sets the mode** — when invoked via `eess-ts check`, presets default
   to `'builders'`, since the CLI is the caller that owns reporting.

Option 2 is the smallest thing that removes the silence. Option 3 is closest to
ADR-008's "caller owns reporting" but changes a default again.

## Verification

- [x] Red test first — `packages/ts/tests/cli/rule-file-truncation.test.ts`,
      `it('says the baseline could not be applied, instead of failing in silence')`.
      Verified red before the fix: `expected 'Architecture Violation [1 of 4]…' to
contain '--baseline'`, i.e. four already-accepted violations reported with no
      mention of the baseline. Green after.
- [x] **The discriminator**, in the same file: `it('does not warn when the rule
file lets the CLI do the reporting')` — a run whose rules the CLI executes
      must carry NO such notice and must exit 0. A fix that printed the notice
      whenever `--baseline` was passed would satisfy the positive test and fail
      this one.
- [x] Verified **end-to-end from packed tarballs**, not only in-process: a fresh
      project with `@nielspeter/eess-ts@0.3.0` installed from a tarball, a bare
      `recommended(p)` and a generated baseline now prints the notice and its
      remedy; the same project with `report: 'builders'` exits **0** with
      `✓ eess-ts — 4 rules across 1 file · 0 failing` and no notice.
- [x] The producer is classified in
      `packages/ts/tests/core/every-config-finding-is-classified.test.ts`
      (plan 0078) — the repo's own gate caught it unclassified on the first run.
- [ ] `validation-owed` — the break class is NOT registered in
      `scripts/check-nonvacuity.mjs`. The two behavioural tests above are the
      guard today. Registering it needs a fixture that runs the CLI over a rule
      file with a baseline, which no existing non-vacuity fixture shape does;
      deferred→[bug 0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md),
      whose fix has to revisit this notice anyway.
- [x] `npm run validate` exits 0.

Deferred: [0201](../0201-caller-aggregates-reports-does-not-cross-the-jiti-registry.md)
(the root cause, and the non-vacuity fixture with it).
