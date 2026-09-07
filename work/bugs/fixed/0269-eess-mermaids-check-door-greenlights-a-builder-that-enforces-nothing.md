# Bug 0269: `eess-mermaid check` greenlights a builder that enforces nothing

## Status

- **State:** Fixed — 2026-09-07. The fix was **not the shape this record
  first supposed**; the correction is recorded under Root cause, because the
  wrong supposition is the more useful half.
- **Severity:** Medium — a false green at a published dialect's build gate. Not
  higher only because `eess-mermaid` has far fewer adopters than `eess-ts`; the
  shape is the one ADR-014 exists to refuse, and the family's binding ADR reads
  as though it were covered.
- **Origin:** self-found · product review of PR #118
- **Reported:** 2026-09-07

## Symptom

`@nielspeter/eess-mermaid` is one of only two dialects that publish a binary.
Its `check` command accepts a hand-rolled builder that asserts nothing and
reports a clean gate:

```ts
// m.rules.ts
export default [{ check: () => {} }]
```

```
$ eess-mermaid check m.rules.ts
✓ eess-mermaid — 1 rule across 1 file · 0 failing (51ms)
$ echo $?
0
```

A denominator is printed beside it — `1 rule across 1 file` — which is exactly
the reassurance `CLAUDE.md` warns is not evidence: the count is of rules
_declared_, not of anything _examined_.

## Root cause

**Corrected at the fix, and this is the record's lesson.** This section first
said the dialect's contract has "no receipt … so there is nothing for an evidence
gate to read", and framed the fix as a dialect-wide contract change. Measured,
that was wrong in the way that matters: `ClassRuleBuilder extends RuleBuilder`,
which extends the kernel's `TerminalBuilder`, where `violations(): CollectResult`
has been the contract since ADR-014. **Every real builder already carried a
receipt** — a real rule with a dead selector already reddened, because `.check()`
reaches the kernel's gate. The premise came from reading the CLI's own
`RuleBuilderLike` interface and not the class hierarchy behind it.

The actual fault was the **guard**. `isRuleBuilderLike` keyed on `check`, and any
hand-rolled object satisfies that — so `{ check: () => {} }` was counted as a
rule, contributed a denominator, threw nothing, and earned a tick. `eess-ts`'s
loader keys on `violations`, which is why the same probe reds there.

A second, independent hole sat beside it: a rule file exporting `[]` printed
`✓ eess-mermaid — 0 rules across 1 file · 0 failing` and exited 0.

This is the shape `eess-ts` had before plan 0263 Phase 2, one dialect over. The
kernel work it depends on is already done and published: `CollectResult`,
`collectResult`, `mergeCollectResults` and the emitter findings are all on the
kernel root, and `finishPreset(receipt, { report: 'return' })` is the same seam
the `eess-ts` doors now use.

## Why it matters

ADR-014's enforcement row for this clause is written dialect-neutrally — "a rule
file exporting an evidence-free builder reds `check`, `check --fix`, `baseline`
and `checkAll`" — and is marked `gated`. `check` is also the name of
`eess-mermaid`'s command. A reader of the family's binding ADR has no way to
tell that the clause covers one dialect's `check` and not the other's, and
**standalone sufficiency cuts the same way**: someone who installs only
`eess-mermaid` gets a dialect where the family's headline invariant does not
hold at the door they use.

That is the half this record fixes immediately: the ADR row now names the
dialect. The door itself is the open work.

## Fix

A wiring change in the dialect's CLI, not a contract change — three parts:

1. **The loader keys on the receipt.** `RuleBuilderLike.violations` is required
   and `check` optional, so an object that cannot say what it examined is not a
   rule. Real builders have both and are unaffected.
2. **`check` reads the receipt.** It loads **per rule file** and runs
   `finishPreset(builder.violations(), { report: 'return' })`, attributes an
   unattributed finding to the rule file it came from (bug 0026's seam, which
   this dialect had not learned), then emits through `reportViolations` — the
   kernel seam that gates, prints, and escalates an emitter finding to a throw.
3. **A rule file that contributes no rules reds**, with its own finding, rather
   than ticking over a zero denominator.

**Two defects were introduced by the first cut of this fix**, recorded because
they are the class the fix is about. The gated findings were re-wrapped with the
_raw_ receipt's `examined` — which a bare array does not have — so
`reportViolations`' own gate saw no evidence and appended a **second**
`emitter/no-receipt`: the same finding twice, one attributed and one not. And the
summary read `1 of 0 rules failing`, dressing a zero as a ratio — the shape
`eess-ts` printed as `2 of 1 rule failing` and caught in review. Both are pinned
by assertions now.

## Verification

- [x] Red test first: three, in
      `packages/mermaid/tests/cli/gates-its-builders.test.ts` — a hand-rolled
      no-op builder, a bare-array builder, and a rule file contributing no rules.
      All failed before the fix and pass after.
- [x] `check:nonvacuity` asserts it by rule id:
      `emitter/mermaid-bare-builder-reds-the-cli` drives the real binary and
      asserts `emitter/no-receipt` **by id and by the file it names**, that it is
      reported exactly **once**, that the no-op and the empty rule file both red,
      and that an honest builder stays green.
- [x] Falsifiable, one sabotage at a time: reverting the loader guard, deleting
      the no-rules **branch**, and reverting to `builder.check()` each red the
      fixture, each in its own field. **Corrected after an enforcement review:**
      this line first said "deleting the no-rules finding", and that sabotage was
      never run in the form written — at the time it did NOT red, because the
      fixture asserted those doors by exit code alone. Both new ids are asserted
      by id now, and deleting either finding while keeping its counter reds the
      row (measured).
- [x] The tests pin `--format terminal` where they assert on the summary.
      Without it they passed locally and **failed in CI**: `detectFormat()`
      returns `github` when `GITHUB_ACTIONS` is set, and the summary line is
      written only under `terminal`, so the assertions were about the
      environment wearing the costume of assertions about behaviour. Verified
      both ways (`GITHUB_ACTIONS=true CI=true` and bare).
- [x] A non-builder beside a real builder is rejected **loudly, by index**, not
      dropped. The first cut ported `eess-ts`'s guard without its loudness, and
      an enforcement review measured the regression: a file holding one real
      builder and one hand-rolled `{ check() { throw } }` went from **exit 1** on
      the previous behaviour to `✓ eess-mermaid — 1 rule across 1 file · 0
failing`, exit 0. A rule that ran and failed ceased to exist under a
      denominator that still claimed it. The loader now refuses, and the CLI
      reports it as `cli/rule-file-misconfigured` rather than an uncaught stack
      trace.
- [x] The repo's own `check:diagram` stays green — the control that matters,
      since a gate that reds on everything would satisfy the rest.
- [x] ADR-014's clause names this dialect's door now that it is true of it.

Deferred: none.

## Related

- [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) —
  the clause whose scope this record corrects.
- [Plan 0263](../../plans/0263-adr-014s-residual-enforcement-rows.md) — Phase 2
  closed the identical hole in `eess-ts`; its measurements are the template.
- [0268](../0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md)
  — the same family of false green, on `eess-ts`'s diagnostic rather than a
  sibling's gate.
- [0174](../0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — why a
  printed rule count is not evidence that anything was examined.
