# Bug 0267: the freeze verifies a plan's links, never its premises

## Status

- **State:** Draft — found by the working-method lens reviewing plan 0263's
  Phase 1, and measured against three phases of one plan.
- **Severity:** Medium — not wrong code. A plan promoted to `Ready` promises its
  floor is self-contained, and `/plan-build` refuses a `Draft` on the strength of
  that promise. The freeze checks that every load-bearing artifact is
  internalised and every link resolves. It never asks whether the phase's claim
  about the code is true, so a phase can name a seam that does not exist and
  still be `Ready`.
- **Origin:** self-found · method review of PR #116 (plan 0263 Phase 1)
- **Reported:** 2026-09-07

## Symptom

Three phases of one plan had a premise that was wrong in the same way, and the
plan's own text says so:

> it is the same correction the freeze already made to Phase 2 — made again,
> one phase over, by the same author.

- **Phase 2**, caught at the freeze: `checkAll` was assumed to reach the
  evidence gate. It aggregates with `flatMap` and delivers through
  `writeReport`, so it never does.
- **Phase 4**, caught at the freeze: `cardinality.ts` was assumed to be the sole
  `WeakSet` registry. `owns-empty-discovery.ts` is a second, and says so in its
  own comment. The rule as written would have reddened legitimate kernel code on
  its first run.
- **Phase 2 again**, NOT caught, found only at review: the phase said the fix was
  `checkAll`'s `flatMap`, and item 2 assumed `eess-ts check` already reddened so a
  fixture could simply assert it. Measured, the CLI had the identical hole, and so
  did `eess-ts baseline` — which wrote a baseline artifact from a builder that
  certified nothing. A fourth instance arrived in the same phase's test file,
  which asserted that a case "cannot be tested" without a cast ADR-005 forbids;
  two reviewers each wrote that test independently and both pass.
- **Phase 1**, NOT caught, found only at build: `check-ledger.mjs` and
  `check-release.mjs` were assumed to reach the evidence gate the way
  `check-corpus.mjs` does. Measured, `check-corpus.mjs` carried 17
  `collectResult`/`mergeCollectResults` references and the other two carried
  zero.

The freeze caught two of these because the author happened to measure, not
because the ritual asked. The rest were caught at build or at review, and one of
them — the false ceiling in Phase 2's test file — was written _after_ this bug
was filed, by the author who filed it. The habit is not cured by knowing about
it, which is the argument for a step rather than a note.

## Root cause

`.claude/skills/plan-ready/SKILL.md` and its shipped twin
`kit/skills/plan-ready/SKILL.md` walk seven steps: harvest the refinement,
internalise load-bearing artifacts, downgrade live-source links to dated
provenance, resolve open boxes, set the state, refuse if anything dangles,
report. Every one is about the plan's **inputs**. None is about the plan's
**claims about the code it will change**.

That is the gap. A phase saying "plant a `continue` and assert the finding
fires" is a claim that a finding exists to fire. Nothing in the freeze asks for
it to be run.

## Why it matters

The freeze exists so an agent alone in a worktree can trust a `Ready` plan
without re-fetching anything. A premise that is false is exactly the silent
corruption the freeze is written to refuse, and it is more expensive than a
dangling link: the link fails loudly on the first `check:corpus`, while a false
premise is discovered after the work is built on it. Phase 1 cost a full build,
a PR, five reviews and a close.

`kit/` ships this checklist to other projects, so the gap ships with it.

## Fix

Not decided. The cheapest shape is one more step in both copies of the skill,
between "internalise every load-bearing artifact" and "resolve every open box":

> **Verify each phase's premise against the code.** A phase that says a seam,
> a call site or a mechanism exists is making a claim. Run it, grep it, or open
> the file. A premise nobody checked is a floor that dangles, and it fails later
> and more expensively than a broken link.

Whether that belongs in the skill, in a `check:*` gate (it is not mechanically
decidable, which is the argument `docs/working-method.md` already makes about
`check:ready`), or as a `/plan-ready` report line, is the open question.

## Verification

- [ ] No red test: the subject is a checklist, and the method doc already argues
      that the "right artifacts were internalised" clause is not mechanically
      knowable. The instrument is the ritual, and this record is its falsifier:
      the next plan whose phase premise is wrong should be traceable to a step
      that did or did not exist.
- [ ] Both copies of the skill carry the step, or a recorded decision not to add
      it.
- [ ] `kit/`'s copy matches the repo's.

Deferred: none.

## Related

- [Plan 0263](../plans/0263-adr-014s-residual-enforcement-rows.md) — the three
  phases; its Phase 1 record carries the measurements.
- [0260](./0260-three-lane-declarations-and-nothing-compares-them.md) — the same
  shape one layer over: several declarations of one fact and nothing comparing
  them.
