# Bug 0205: four emitters restate the suppression rule inline, and they disagree

## Status

- **State:** Draft — the rule already went wrong once at one of the four sites, and
  that instance shipped as a fake green before review caught it.
- **Deferred:** none
- **Found:** 2026-08-21, architecture review of PR #75.

## Symptom

[ADR-008's amendment](../../adr/008-caller-owns-reporting.md) states one invariant
for every emitter under a run-level aggregating caller:

> **Suppress exactly what rides the throw, and nothing else.**

Nothing enforces it. It is restated inline, in prose, at four sites — and they do
not agree:

| site                                                    | policy                                          |
| ------------------------------------------------------- | ----------------------------------------------- |
| `packages/ts/src/core/execute-rule.ts` — `executeCheck` | suppress everything                             |
| `packages/ts/src/core/execute-rule.ts` — `executeWarn`  | suppress only `bypassFilters`; write the rest   |
| `packages/ts/src/core/check-all.ts`                     | suppress only error-severity; write the rest    |
| `packages/ts/src/presets/shared.ts` — `deliver()`       | suppress everything, and only in `'throw'` mode |

Each is individually correct **today**, because each throws a different subset —
`executeCheck` throws everything, `executeWarn` throws only the configuration
findings, `checkAll` throws only error-severity, `deliver()` throws everything. The
divergence is not a bug in any one of them. The bug is that the rule connecting them
lives in four comments and is checked by nothing.

## This is not hypothetical — it already happened

`check-all.ts`'s guard was added in PR #75 suppressing **all** violations, exactly
like its two neighbours, while its throw carried only the error-severity subset. The
warn findings were written by nobody and carried by nothing: measured, four findings
produced and discarded under `✓ eess-ts — 4 rules across 1 file · 0 failing`,
exit 0.

The correct reasoning was already written, one file over, in `deliver()`'s comment
about `'warn'` — and it was not applied. Two reviewers found it independently; no
test did. The fix landed in the same PR, and the fixture that holds it had to be
written from scratch because the warn path through `checkAll` had no coverage at all.

**A fifth emitter added by the next author gets it wrong the same way**, and the
failure direction is silent: findings that exist nowhere, under a green tick with a
non-vacuous denominator.

## Two things, not one: the DECISION and the COUNT

Review of this record found a **third live instance** while judging it —
[bug 0207](./fixed/0207-a-rule-level-warn-emits-uncounted-so-the-leak-notice-stays-silent.md):
`executeWarn` emitted without incrementing the emission counter, so a `.warn()`
leaked in total silence. That is not a suppression-decision bug; it is the same
sites failing a _second_ shared contract.

So the fix has two halves and the first version of this record named only one:

1. **Every emitter suppresses exactly what rides its throw** — the decision.
2. **Every emitter counts what it emits** — so an aggregating caller's leak
   detector can see it. `executeWarn` writes through `writeStderr`, not
   `writeReport`, and was invisible until 0207.

A helper that centralises (1) and leaves (2) at each site leaves half the class
open.

## Fix

Not decided. The shape first proposed here — a helper taking a `ridesTheThrow`
predicate — **does not close the drift, and review was right about why.**

```ts
emitUnlessAggregated(violations, { format, reason, ridesTheThrow }) // NOT this
```

The predicate must agree with a throw the _same function_ performs a few lines
later, and that agreement is unchecked — which is exactly what the four prose
comments were. It moves the restatement from a comment into an argument without
making it derivable. `executeWarn` is the proof: it already spells the partition
twice (`v.bypassFilters === true` and `v.bypassFilters !== true`), and this helper
would make it three spellings of one fact in one function.

**Derive it instead, by inverting control** — one primitive owning both halves:

```ts
emitAndThrow(violations, { format, reason, ridesTheThrow })
// emits:  aggregating ? violations.filter(v => !p(v)) : violations   — and COUNTS it
// throws: new ArchRuleError(violations.filter(p), reason)            — if non-empty
```

The predicate is consumed twice by one function, complementarily, so the two uses
cannot disagree by construction. Checked against all four sites and it fits:
`executeCheck` `p = () => true`, `executeWarn` `p = v => v.bypassFilters === true`,
`checkAll` `p = v => (v.severity ?? 'error') === 'error'`, `deliver()` `p = () => true`.

`check-all.ts` already demonstrates the safe shape — it names its predicate once and
consumes it for both the suppression complement and the throw payload.

A weaker sound variant, if inverting control is unacceptable somewhere: construct
the `ArchRuleError` first and pass **it**, deriving the emitted set from
`error.violations` by identity.

Open questions before it is built:

- **`executeWarn`'s emit is not `writeReport`.** It has its own json/github/terminal
  branching that routes json to **stderr**, deliberately, so an aggregating caller's
  stdout document stays machine-clean. `writeReport` sends json to stdout. The
  helper has to preserve that difference or state why it may collapse.
- **`check-all.ts` carries extra payload** — the diff notice and `untestedRules()`.
- **Where it lives decides plan 0188's outcome, and the pessimism first written
  here was backwards.** This said a ts-side helper "is the right scope today and the
  wrong one" once [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)
  converges the copies. The opposite holds if it is placed correctly. 0188's stated
  blocker for this module is that `execute-rule.ts` carries module-level state the
  kernel copy has no equivalent for. Put the flag **and** the primitive in their own
  module — `packages/ts/src/core/aggregation.ts` — leaving `execute-rule.ts` calling
  an injected policy, and that blocker converts from "the ts copy carries extra
  state" to "the kernel's `executeCheck` takes an emission policy; eess-ts installs
  an aggregating one." Put the helper _inside_ `execute-rule.ts`, which is the
  obvious place because that is where the flag already lives, and 0188 has to unpick
  it. **This is a one-line constraint that decides the outcome.**

## 0205 and 0206 prescribe opposite fixes for the same site

[Bug 0206](./fixed/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md)'s
option 2 — give the kernel a non-emitting throw path so `deliver()` delegates again
— **deletes** `deliver()`'s aggregation branch, removing it from this record's four
sites entirely. Conversely, wiring `deliver()` into a ts-side primitive deepens the
bypass 0206 records: the kernel finisher stays skipped on the flagship's default
path, and the dialect gains a second copy of throw semantics behind a helper that
looks canonical.

**Whichever ships first makes the other's stated fix wrong.** Decide 0206 first, or
decide them together. Both records now say so.

## The general shape would be an ADR, the narrow one is not

A ts-only helper is a refactor and needs no ADR. But _"the kernel gains a run-scoped
emission policy the caller installs"_ constrains all five dialects, and 0206 names
the gap it fills: the kernel has no mode meaning "run, throw, and let my caller
emit". That is an amendment to
[ADR-008](../../adr/008-caller-owns-reporting.md), not a Fix section in a bug record
— the same rule that made plan 0188's first phase two ADRs.

Draw that line before building, or the decision lands buried.

## The ADR row for this clause was `gated` over a mechanism that could not fail

[ADR-008](../../adr/008-caller-owns-reporting.md)'s Enforcement table carried one
Tier-2 row for this invariant, `gated`, whose Mechanism cell asserted in prose that
it covered `executeWarn` — cited against a test whose fixture leaks through the
**kernel preset path** and never exercises `executeWarn` at all.

Measured: gutting `executeWarn`'s aggregation branch to suppress everything left the
cited test file green at 14/14 and the whole suite green. **Margin 0.**

That is bug 0189's exact shape — a `gated` row resolving against a different path —
inside the ADR whose own Enforcement preamble tells bug 0189's story, and it was
introduced by the amendment written for bug 0203. ADR-009 rule 5's question answered
wrong: _what would this check do if the thing it guards were completely broken?_
Pass.

Split into three rows, one per site, each cited against a mechanism that can see it
— and the `executeCheck`/`deliver()` row states plainly that the clause as written is
vacuous for them and names the proposition that is not.

## The fifth-emitter catch is buildable, and the repo has the precedent

The earlier text left this as an open either/or. It resolves: the population is
small and enumerable — roughly 7 emit call sites in `packages/ts/src` and 3 in
`packages/core/src`, all reached through six symbols (`writeReport`,
`formatViolations`, `formatViolationsJson`, `formatViolationsGitHub`,
`reportViolations`, `finishPreset`).

The shape is `packages/ts/tests/core/every-config-finding-is-classified.test.ts`,
keyed by `path::enclosingFunction` exactly as that census is:

- every emit call site appears in a `CLASSIFIED` table declaring its `ridesTheThrow`
  predicate (or `'never runs under aggregation'`) **and** whether it advances the
  counter;
- unclassified fails — that is the fifth-emitter catch; stale entries fail too;
- a **"the scan cannot be bypassed"** row, the analogue of the census's
  `bypassFilters`-is-always-literal row: flag any `writeStderr` /
  `process.stdout.write` in `packages/*/src` whose argument derives from an
  `ArchViolation[]` and whose enclosing function is not in the table. Resolved
  through ts-morph symbols, as that census already does — not a spelling list.

Without this, the fix is centralisation and the record should not claim more.

## Verification

- [ ] Red test first, **and the per-site proposition differs** — the first version
      of this box wrote one sentence for four sites and was vacuous at two of them.
      "Findings that ride no throw" is **empty by construction** at `executeCheck`
      and `deliver()`, whose throws carry everything, so a fixture written to that
      spec there matches zero elements and passes on any implementation, including
      one deleted outright. The propositions with content: - `executeWarn`, `checkAll` — _the non-riding subset is still written exactly
      once_. `checkAll`'s holds (`checkall-warn-only.rules.ts`); `executeWarn`'s
      holds only since [bug 0207](./fixed/0207-a-rule-level-warn-emits-uncounted-so-the-leak-notice-stays-silent.md)
      added `warn-terminal-leaks.rules.ts`, and before that its margin was **0**. - `executeCheck`, `deliver()` — _nothing is written twice_. Both hold today
      (`preset-double-print.test.ts`; `deliver()`'s margin measured at 2).
- [ ] Sabotage: widening any one emitter's suppression to "everything" reds a test.
      Measured today — doing that to `check-all.ts` reds exactly one, and doing it
      to `executeWarn` is unmeasured.
- [ ] The invariant is stated in ONE place that the four sites reference, rather
      than four times in prose.
- [ ] **Every emitter is counted**, not just consistent — the second half this
      record originally missed. A fixture per emitter asserting that its output
      advances `violationsWritten()`. `executeWarn`'s exists
      (`warn-terminal-leaks.rules.ts`, from bug 0207); `writeReport`'s is
      `checkall-warn-leaks-under-baseline.rules.ts`; the kernel's is
      `mixed-quiet-and-leaking.rules.ts`.
- [ ] A FIFTH emitter that calls neither the helper nor the counter is caught by
      the census below. **A helper makes the sites consistent; it does not make the
      invariant enforceable** — those are different, and only the census closes the
      second.
