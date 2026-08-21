# Bug 0199: a bare preset call throws before `--baseline` can filter, so accepted violations resurface

## Status

- **State:** Fixed — the run now says the baseline did not apply, instead of
  failing in silence. Option 2 of the three below, chosen deliberately; the root
  cause is [bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md).
- **Deferred:** [0201](./0201-executecheck-prints-before-the-caller-can-filter.md) — the root cause
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

## Root cause — this record got it wrong TWICE

**Version 1 (as filed):** "the preset throws at module-eval time, before the CLI's
baseline filtering runs; `--baseline` is silently inert." **False.** `runCheck`
collects a thrown terminal's violations off the error (`failureOrViolations`,
`packages/ts/src/cli/commands/check.ts:89`) and filters them. Against a matching
baseline its collection came back **empty** — the filtering worked as designed.

**Version 2 (the first correction):** "`setCallerAggregatesReports` is module-level
state and a rule file loads through jiti's separate registry, so it holds a copy
with the flag `false`." **Also false**, and this one was worse: an entire record
([bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md))
was built on it, and all three of its candidate fixes were aimed at making the flag
cross registries. Disproved three ways by review:

1. **The flag is read at exactly one site.** `packages/ts/src/core/execute-rule.ts`,
   inside `executeWarn`. `executeCheck` never consults it.
2. **jiti is not the default loader.** `packages/ts/src/cli/load-rules.ts` calls
   `importRuleModule`, and `packages/ts/src/cli/import-rule-module.ts` imports
   **natively first**, reaching jiti only on a module-format refusal (a
   `"type": "commonjs"` consumer — bug 0074).
3. **Measured with one shared registry and no jiti at all.** A fixture importing the
   same module graph as the test's `runCheck` — so the flag was fully visible to it
   — printed all four violations unfiltered anyway.

**Version 3, and the measured one:** `executeCheck` calls `writeReport(...)`
**unconditionally** at `packages/ts/src/core/execute-rule.ts`, one line before
`throw new ArchRuleError(...)`. A `.check()` at module scope prints its findings
**always**. No registry, no jiti, no flag. The CLI cannot un-print them, and that is
the whole of it.

**Why both wrong versions are left standing.** By this corpus's own reasoning a
wrong fault attribution is worth recording next to the right one — and version 2 is
the stronger argument for it, because it did not stay a sentence. It became a filed
record with three proposed fixes, two of which could not have worked: options 1 and 2
of 0201 would not stop `executeCheck` from printing, because it never reads the flag.

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
in a bug fix, and it is [bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md).
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

## Corrected again on review — the trigger was a double negative

The first shipped trigger asked _"did we suppress a write?"_ and read **no** as
_"then nothing was written"_. That is unsound, and an enforcement reviewer measured
the case: a rule file that silences one terminal while leaking through another
satisfies it **while leaking**.

```
recommended(p, { report: 'warn' })   // emits 6 violations, does not throw
functions(p).…should().notExist().check()   // silenced by 0201, throws
```

Measured with a baseline in play: **7 violation blocks reached the user unfiltered
and no notice fired.** `report: 'warn'` is a public `ReportMode`, so this needs no
contrivance; a `try { …check() } catch {}` around a tolerated rule reproduces it.

**A silence built on a stale signal is worse than the false claim it replaced**,
because the run says nothing at all — the exact shape ADR-010 exists to reject,
committed while fixing an ADR-010 defect.

The trigger now reads a delta over **emissions**, counted at both emitters —
`writeReport` in the dialect and `reportViolations` in the kernel. That answers the
only question the notice may assert: _did anything print while this module was
loading?_ Three fixtures hold it: the mixed suppressed-and-leaking file above,
`checkAll()` at module scope, and a preset.

**A third leaking path was found doing this.** `checkAll()` calls `writeReport`
unconditionally — the same defect `executeCheck` was fixed for, three files away in
the same package. It is named in
[bug 0203](../0203-a-preset-at-module-scope-prints-its-findings-twice.md). Until
this fixture existed, the dialect-side counter was at **margin 0**: deleting its
increment left the whole suite green.

## Verification

- [x] Red test first — `packages/ts/tests/cli/rule-file-truncation.test.ts`,
      `it('says so when a preset printed findings the baseline never filtered')`.
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
- [x] `dropped-on-purpose` — the break class is **not** registered in
      `scripts/check-nonvacuity.mjs`, and on review that is the right call rather
      than a debt. That script registers **`check:*` repo gates**; not one of the
      ~20 config-finding producers in the census appears in it — not
      `ruleFileTruncated`, not `ruleFileFailure`, none. The harness is not shaped
      for product-CLI findings, and this family's accountability home is the
      census's `verified` claim in
      `packages/ts/tests/core/every-config-finding-is-classified.test.ts`.
      The first version of this box booked it `validation-owed` and deferred it to
      0201 — a debt no peer carries, deferred to a record whose fix does not touch
      it. That was a gap dressed as a disposition.
      **And the blocker first stated here was the wrong one.** It said no fixture
      shape runs the CLI over a rule file with a baseline; `gateFamilyReExportAggregation`
      and `gateDiagram` already run `EESS_TS check <rules>` and assert a fired rule.
      The real blocker is that `firedOn` (`scripts/check-nonvacuity.mjs:293-299`)
      keys strictly on `v.ruleId`, and configuration findings carry no `ruleId` at
      all — so registering ANY `bypassFilters` producer would mean keying on prose,
      which [bug 0110](./0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)
      forbade. That is a checkable statement about all ~16 producers rather than a
      vague one about this producer, and it is recorded in
      [bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md).
- [x] **The remedy remediates**, which is what makes the census's `behavioural:`
      claim true rather than `stated-only`.
      `it('clears once the remedy it names is applied, and the rules then load')`
      runs the same preset with `report: 'builders'` added and asserts the notice
      clears — and that rules actually load, since asserting only the absence would
      also pass on the zero-rules silent green. Added on review: the first version
      asserted the remedy STRING over one fixture and its absence over a different
      one, which is a fire/no-fire pair, not a remediation proof.
- [x] **The false-positive case.** `it('does not fire when the throw carried
nothing the rule file could print')` — `executeWarn` throws the same error
      type while writing nothing, and the first version of the fix fired there
      anyway, asserting a leak that never happened. Found by review, measured, and
      guarded.
- [x] `npm run validate` exits 0.

Deferred: [0201](./0201-executecheck-prints-before-the-caller-can-filter.md) — the root cause only.
