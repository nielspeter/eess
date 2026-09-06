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

## Corrected again — the first guard was itself a fake green

**`checkAll()` throws only the ERROR-severity subset**, so its warn-severity
findings ride nothing. The first version of this fix suppressed _all_ violations
under aggregation, which meant those warn findings were written by nobody and
carried by nothing.

Measured independently by two reviewers and reproduced: four warn findings produced
and discarded, under `✓ eess-ts — 4 rules across 1 file · 0 failing`, **exit 0**.
A fake green arriving through this package's own CLI — the exact class it exists to
prevent — introduced by the fix for a different bug.

Worse than a plain loss: with no write, the dialect's emission counter does not
advance, so the "output you could not filter" notice could not fire either. The run
was silent about the silence.

This is precisely the invariant the ADR amendment below names — **suppress exactly
what rides the throw, and nothing else** — and the reasoning was already written
correctly one file over, in `deliver()`'s comment about `'warn'`, and not applied
here. `check-all.ts` now splits the same way `executeWarn` does.

**The test that should have caught it did not exist**, and the one that looked like
it did was vacuous: the converted `checkAll` test asserted only an absence, so
replacing its fixture with a module calling no `checkAll` at all left it green. Both
are fixed — a positive anchor restored, and a dedicated warn-severity fixture added.

**And the dialect emission counter was back at margin 0.** Converting that test to a
pure absence removed the only thing exercising `writeReport`'s increment. It has its
own fixture now — `checkall-warn-leaks-under-baseline.rules.ts` — because after this
fix `checkAll`'s warn write is the only leak in the suite that flows through the
dialect emitter rather than the kernel's.

## The remedy on the migrator's actual path was a no-op

With a full baseline, the naive migration reds with **zero findings shown** — the
baseline filtered them all, while `ruleFileTruncated` survives it (`bypassFilters`)
and says "the finding above". Its remedy then said _"move its rules into
`export default [rule1, rule2]`"_ over a file that already **is** an array export,
because `export default [...recommended(p)]` spreads a preset that still enforces at
module scope.

So the reader was told to do what they had already done, and `report: 'builders'` —
the actual fix — appeared **nowhere** in the output, since this PR correctly stopped
the notice that used to carry it. ADR-009 rule 2: a failure that states no usable
remedy is one where the reader invents one.

`ruleFileTruncated`'s suggestion now names the preset case first, states that a
spread does not avoid the problem and why, and keeps the array-export advice for the
shape it actually fits.

## Follow-ups filed rather than absorbed

- [**0205**](../0205-four-emitters-restate-the-suppression-rule-and-disagree.md) —
  the invariant this bug's fix depends on ("suppress exactly what rides the throw")
  is restated inline at four emitters and enforced by nothing. It already went wrong
  at one of them **inside this fix** and shipped as a fake green until review caught
  it, so this is a demonstrated failure mode rather than a tidiness concern.
- [**0206**](./0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md) —
  `deliver()` throws `ArchRuleError` itself rather than delegating to
  `finishPreset`, because the kernel has no mode meaning "run, throw, and let my
  caller emit". **Corrected 2026-09-06 — "latent today" was wrong**, and 0206's
  own record says so at close: the drift was live, and the test written to prove
  it found the flagship dialect's default path already skipping the kernel
  finisher. Fixed under [plan 0235](../../plans/completed/0235-the-emitter-takes-a-receipt.md);
  the exposure was exactly as described, just not hypothetical.

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
