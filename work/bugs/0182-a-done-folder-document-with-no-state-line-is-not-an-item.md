# Bug 0182: a done-folder document with no State line is not an item

## Status

- **State:** Draft — reproduced by sabotage.
- **Found:** 2026-08-20, architect review of the bug 0179 fix; re-measured
  independently before filing.
- **Severity:** a hole, not a break. Nothing is red today — all 26 completed
  plans carry a `State:` line.

## Symptom

`check:ledger` enforces that a plan in `work/plans/completed/` says it is done.
It catches a **wrong** state and misses an **absent** one.

Measured, by deleting the `- **State:**` line from a plan in `completed/`:

```
$ npm run check:ledger
  ✓ honesty at close — 51 done-items across 124 records …, 123 with a readable State, 0 findings
exit 0
```

Compare with setting that same plan's state to `Draft`, which is caught:

```
work/plans/completed/0058-…:3  ledger/state-folder-mismatch
  State: Draft but filed in a done-folder — move it back to the active lane or close it out.
```

So the header can contradict the folder and be caught, or say nothing at all and
not be. The only trace is the summary's `124 records · 123 with a readable
State` — a delta nothing asserts.

## Root cause

`packages/md/src/rules/ledger.ts` — `headerStateViolation` returns `null` when no
`State:` line is found, with the comment "no State line at all → this document is
not an item".

That is **correct in general**: `work/plans/ROADMAP.md` and `work/bugs/BUGS.md`
are boards, not items, and they carry no state. It is wrong for a document
sitting in a terminal folder, where the folder itself is the claim that the work
is finished.

## How it surfaced

Bug 0179 deleted an adopted test (`completed-plans-are-marked-done`) as redundant
with `check:ledger`. The disposition was right, and the redundancy holds for the
contradiction case — but that test reported the missing-header case by identity,
and this one does not. The hole predates the deletion; the deletion is what made
it worth measuring.

## Fix

Not built. The narrow form is the right one: a document in a **done-folder**
(`plans/completed/`, `bugs/fixed/`, `support/delivered/`, `wont-do/`) with no
readable `State:` line is a `ledger/missing-state` finding. Documents elsewhere
keep the current "not an item" behaviour, which the boards depend on.

Resist the broad form. Asserting `scanned === withReadableState` globally would
flag every board in `work/` and get suppressed, which is ADR-009 rule 3's warning.

## Verification

- [ ] Deleting the `State:` line from a plan in `completed/` reddens
      `check:ledger`, naming the file.
- [ ] `work/plans/ROADMAP.md` and `work/bugs/BUGS.md` stay silent.
- [ ] The finding names the file, not a count (ADR-009 rule 4).
