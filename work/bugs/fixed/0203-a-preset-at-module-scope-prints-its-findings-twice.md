# Bug 0203: a preset at module scope prints its findings twice, and no flag is needed

## Status

- **State:** Fixed — `deliver()` and `check-all.ts` honour the aggregating caller,
  so the double print is gone and the CLI reports each finding once. **Rewritten
  once** before that: the first version framed this as a kernel-only filtering
  concern and got both halves wrong; see "What this record used to say".
- **Deferred:** none
- **Found:** 2026-08-21, split from
  [bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md) once
  its `.check()` half was fixed. Re-scoped by the architecture and product reviews
  of PR #74.

## Symptom — a double print, with no flags at all

`eess-ts check arch.rules.ts`, no `--baseline`, no `--changed`, on a rule file
whose preset enforces at module scope (`export default [...recommended(p)]`):

```
Architecture Violation [1 of 1]        ← the preset's own emission
  src/a.ts:2 — bad
Architecture Violation [1 of 2]        ← the SAME violation, from the CLI
  src/a.ts:2 — bad
Architecture Violation [2 of 2]
  Rule: eess-ts: rule file
✗ eess-ts — 0 rules across 1 file · 1 of 0 rules failing · 1 violation
```

Measured on this repo's own `enforcing-preset.rules.ts` fixture: **13 violation
blocks, 6 of them exact duplicates**, under a summary line claiming `1 violation`.

`finishPreset` emits through the kernel's `reportViolations`; `failureOrViolations`
then collects the same violations off the thrown error and the CLI reports them
again. One violation, two blocks, two contradicting counters.

**This is the flag-independent, primary symptom**, and it is what a migrator sees
on their first `eess-ts check` — the bare `recommended(p)` form is what
`packages/ts/README.md` teaches and what a rule file carried over from
`@nielspeter/ts-archunit` will have.

The filtering consequence is the _secondary_ one: with `--baseline` or `--changed`
the printed copy is also unfiltered, so already-accepted findings reappear. That is
what [bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md)
covers with a notice — **and that notice is gated on those flags, so the
double-print case above gets no notice at all.**

## What this record used to say, and why that is kept

**Version 1 claimed the kernel must grow a new report mode, because
`setCallerAggregatesReports` is ts-dialect state "no dialect flag can reach".**
Both halves are wrong:

1. **A dialect flag CAN reach it.** `deliver()` in
   `packages/ts/src/presets/shared.ts` is ts-package code and the single site all
   five ts presets finish through. **Measured:** having it honour the flag —
   returning violations and throwing itself instead of calling `finishPreset` —
   takes the fixture from **8 blocks with the leak** to **2 with none**. No kernel
   change, no fourth `ReportMode`, no second global.
2. **A new mode nobody passes fixes nothing.** Version 1 listed `'throw-quiet'` and
   an `emit` predicate as candidates 1 and 2. Both require the _leaking call site_
   to opt in — and the leaking call site is `...recommended(p)`, written by someone
   who passed nothing. That is the entire defect. Only a run-level override
   addresses it, which version 1 listed as candidate 3 and "rejected on sight".

Recorded rather than deleted because version 1 would have sent the next reader to
the kernel to design an API that does not solve the case.

## Two more unguarded emitters that no record named

Found by the architecture review of PR #74, and the reason this section exists:

| unguarded emitter                                    | status                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/core/src/report.ts` — `finishPreset`       | this bug                                                                             |
| `packages/core/src/execute-rule.ts` — `executeCheck` | **this bug** — added on review                                                       |
| `packages/ts/src/core/check-all.ts` — `writeReport`  | **this bug** — added on review                                                       |
| `packages/core/src/execute-rule.ts` — `executeWarn`  | [bug 0163](../0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md) |

**The kernel's `executeCheck` is the same defect 0201 fixed in the dialect copy**,
and 0201 fixed only the ts one. Before that the two copies had identical emission
semantics; now they diverge **behaviourally**, which is precisely what
[plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md) was raised to
**High** for on 2026-08-21 — "the fix had landed in `packages/ts` with the engine
copy and never reached the kernel". Latent today (bug 0163 measured that no
aggregating caller drives the kernel copy), but it is the second instance in two
days and it was unrecorded until review caught it.

## Fix — in the dialect, at both remaining emitters

`deliver()` (`packages/ts/src/presets/shared.ts`) and `checkAll()`
(`packages/ts/src/core/check-all.ts`) now honour `callerAggregates()`, the same
contract `executeCheck` took in
[bug 0201](./0201-executecheck-prints-before-the-caller-can-filter.md).

**The throw is unchanged in both.** The caller still learns the run failed and the
violations still ride the error; only the emission moves. And the flag defaults to
`false` and is set only by `eess-ts check`, so a preset or a `checkAll()` in a
**test file** prints exactly as before.

**Only the default `'throw'` mode.** `'warn'` and `'return'` are explicit choices a
caller made about emission — and `'warn'`'s violations do **not** ride a throw
(`executeWarn` puts only the configuration findings on the error), so suppressing
them would lose them.

That last point decides the notice's fate. **`baselineNotApplied` is NOT removed**,
because exactly one path can still leak: a `.warn()` at module scope, whose
advisory violations must be written directly or vanish. It is named and tested —
`warn-leaks-under-changed.rules.ts` and `mixed-quiet-and-leaking.rules.ts`. Three
tests that previously asserted the notice over the preset, `checkAll()` and
`--changed` paths are now regression tests that those paths no longer leak.

**The kernel copy stays divergent, knowingly.** `packages/core/src/execute-rule.ts`'s
own `executeCheck` still emits unconditionally. It has no flag to read —
`callerAggregatesReports` is ts-dialect state the kernel cannot see and should not —
and bug 0163 measured that no aggregating caller drives it. Converging the two
copies is [plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md)'s job,
and this is now a second recorded instance for it.

## Corrected on review — the aggregation flag was a latch

`setCallerAggregatesReports(true)` was called once by `runCheck` and **never set
back**. That was invisible while `executeCheck` was its only reader — the CLI wants
suppression for its whole life — and stopped being invisible the moment this fix
made `deliver()` and `checkAll()` read it too.

Measured by an architecture reviewer and reproduced: a preset called **directly**,
in a process that had already run `runCheck` once, emitted **6 violation blocks
before and 0 after**. It still threw, so nothing went falsely green; what vanished
was the report — the messages, the `Why:`, the `Fix:` — with no signal that anything
had been swallowed. The suite runs many tests in one process, so this is the shape
of this repo's own test files, not a hypothetical.

`withCallerAggregating` replaces it: a dynamic extent that restores the previous
value in a `finally`, so the invariant is "aggregation lasts as long as the run"
rather than "aggregation is whatever the last caller left behind".
`setCallerAggregatesReports` is deleted — the repo's own `no-unused-exports` rule
caught it going dead on the first `check:arch`.

The changeset said "Nothing changes outside the CLI", which was the claim that
would have shipped to npm and was false for exactly this reason. Corrected.

## ADR-008 amended, because the code now contradicts it

ADR-008 stated "The default stays print-then-throw" and gated a Tier-2 row reading
"Default preset behavior unchanged (emit + throw)". Under an aggregating caller the
default is now **throw without emit**, and that row's cited test asserts only the
throw — so it would have stayed green over a clause the code no longer holds. That
is bug 0189's shape, in the ADR that narrates bug 0189.

The amendment states the real rule, names the invariant every read site must
satisfy — **suppress exactly what rides the throw, and nothing else** — and adds two
gated rows: one for the aggregating default, one for the invariant, cited to the
tests that hold them. `executeWarn` is the case that gives the invariant content:
its warn-severity violations do not ride the throw, so it must keep writing them.

## Verification

- [x] Red test first — `packages/ts/tests/cli/preset-double-print.test.ts`,
      `it('reports each finding once, not twice')`. Verified red with 6 duplicated
      subject lines; green after. Sabotage-verified: removing the guard reds both
      tests in that file.
- [x] The summary accounts for every block printed —
      `it('the summary accounts for every block it printed')`. Before the fix it
      read `1 violation · 6 warnings` over **13** blocks; the six unaccounted ones
      were the preset's duplicate print.
- [x] A preset in a **test file** still prints. By construction — the flag defaults
      to `false` and only `runCheck` sets it — and the whole suite (3553 tests)
      is green, including every preset test that depends on today's behaviour.
- [x] `--baseline` and `--changed` now apply to a preset-enforcing rule file's
      findings, because the CLI is the only thing reporting them.
- [x] `baselineNotApplied` is **kept**, and its one remaining reachable path is
      named and tested: a `.warn()` at module scope. Its three tests over the
      now-fixed paths were converted into regression tests that those paths no
      longer leak.
- [x] The kernel `executeCheck` is recorded as knowingly divergent above, with
      [plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md) owning the
      convergence; `check-all.ts` is fixed.
- [x] `npm run validate` exits 0 — 3553 tests.

**Two fixtures per property, not one.** Each test here has its own rule file
because a module is not reliably re-executed between tests in a run — measured:
sabotaging the fix reddened only one of two tests while they shared a fixture.
