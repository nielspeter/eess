# Bug 0226: the non-vacuity harness tells you to trust a table nothing checks — and 34 of its 58 rows are missing from it

## Status

- **State:** Draft — measured, not fixed. Both halves below are reproducible
  from `scripts/check-nonvacuity.mjs` as it stands.
- **Severity:** Medium — nothing goes red that should stay green, and no gate is
  weakened. What is wrong is the instrument a reader is explicitly told to use
  when judging how strong a gate is, which makes it the same class as the
  defects this harness exists to catch, one level up.
- **Origin:** self-found · noticed while auditing `GATE_FOR` after adding the
  `finished-not-closed` row (PR #88) and the raw-NUL row
  ([0099](./fixed/0099-nul-bytes-make-md-gherkin-unsearchable.md), PR #89)
- **Reported:** 2026-08-24

## Symptom

`scripts/check-nonvacuity.mjs` opens with a `Gate → violating input → rule that
must fire` table, and its own text makes that table load-bearing:

```
 * […] Neither the per-row output nor "N fixtures fired" below distinguishes
 * the two — read the tier from this list, not from a fixture having exited 1
```

That is a direct instruction: the per-row `OK` output cannot tell you whether a
fixture drove the production script or only its own condition, so consult the
table. The table is the only place that answer exists.

**It is missing most of the fixtures.** Measured against `GATE_FOR` in the same
file:

|                                                     |        |
| --------------------------------------------------- | ------ |
| rows in `GATE_FOR`                                  | 58     |
| rows named in the header table                      | 24     |
| rows absent by name                                 | **34** |
| …of those, absent under **any** name or description | **27** |

The 7-row difference is rows the table describes under a different label —
`arch (root rules)` appears as `arch`, `crossval/gherkin-ts` as `crossval/gk`,
three `release/*` rows as one `release` block. That mismatch is itself part of
the defect: there is no naming correspondence between the two lists, so nothing
mechanical could reconcile them even if someone wanted to.

The 27 with no description at all, grouped:

- `family re-export (index)`, `(crossvalidate)`, `(aggregation)`,
  `family kernel-imports emptied` — the whole `check:family` gate (plan 0089)
- `corpus/ledger/box`, `placement`, `state`, `deferred-lie`, `dead-selector`,
  `uncovered-lane`, `lane-done-vacuous`, `finished-not-closed` — the whole
  `check:ledger` gate
- `corpus/proposal-board-ruling`, `-missing`, `-unreadable`,
  `-examined-nothing`, `corpus/proposal-missing-from-board`,
  `corpus/proposal-board-row-unresolved` — the proposals board cluster
- `corpus/promoted-names-no-owner`, `-not-dispatchable`, `-has-held-asks`
- `corpus/proposal-number-duplicated`, `corpus/accepted-denominator-empty`,
  `corpus/proposal-criteria`, `corpus/docs-only-owner`, `corpus/link-routing`,
  `crossval/md-ts`, `release/break-names-dependents`, `gates/formerly-waived`

`gates/formerly-waived` is the one that stings: it is the row answering for
**four** `check:*` scripts (`integrity`, `examples`, `docs-code`, `surface`),
and a reader following the file's own instruction will not find it.

## Root cause

Two lists, one gated and one not.

`gateCoverage()` asserts that every `check:*` script in `package.json` has a
`GATE_FOR` row or a stated waiver, so **deleting a row is caught**. Nothing
asserts the reverse for the prose table: **adding** a row leaves the table
silently behind. Every fixture added since the table was written — and that is
most of them — went in without it.

So the file gates the machine-readable list and trusts the human-readable one,
while instructing humans to read the human-readable one. The load-bearing
artifact is the ungated one.

## Why it matters

This is not cosmetic, and the reason is written in the file itself. Bug 0127
found that "every gate actually FAILS" was an over-claim: most fixtures prove
their own condition fires, or prove a shipped preset fires over a hand-built
corpus, and only some drive the real `check:*` invocation. Those are different
strengths of evidence and the run output cannot tell them apart. The table is
how a reader recovers the difference.

With 27 rows undescribed, a reader auditing `check:ledger` or `check:family`
finds nothing and has to read the fixture source to learn what tier it proves —
which is exactly the work the table exists to save, and exactly the work a
reader under time pressure skips. A green `check:nonvacuity` then reads as
uniform, strong evidence across all 58 rows, which it is not.

It is the shape this repo keeps finding in itself: an instrument that is trusted
because it is named, not because it is checked.

## Fix

Two halves, and the second is the one that matters — writing the 27 rows without
gating the table repeats the mistake in the same file, one commit later.

1. **Write the missing rows**, in the existing style: gate → violating input →
   rule that must fire, plus the tier the fixture actually reaches (drives the
   production script / drives a shipped preset over a fixture corpus / asserts
   the module directly).

2. **Gate the table against `GATE_FOR`.** A check — most naturally inside
   `gateCoverage()`, which already owns the coverage question — that every
   `GATE_FOR` row is described in the header docstring, and reds naming any that
   is not. This requires settling the naming mismatch first: either the table
   keys on the exact row names, or `GATE_FOR` rows carry their description and
   the table is generated from them. The second removes the drift class outright
   rather than detecting it, and is the better answer if it is not too invasive.

## Verification

- [ ] Red test written first — a fixture (or a `gateCoverage()` assertion) that
      fails on the tree as it stands today, naming the 27 undescribed rows. It
      must fail BEFORE the rows are written, or it proves nothing.
- [ ] Non-vacuity coverage for the new check itself. `check:nonvacuity` is its
      own harness and `NO_GATE_NEEDED` waives it, so the meta-check needs to be
      exercised by `harness self-check`, not by a new `check:*` row.
- [ ] All 58 `GATE_FOR` rows described, with the tier stated per row.
- [ ] The naming mismatch resolved — `arch (root rules)` / `arch`,
      `crossval/gherkin-ts` / `crossval/gk`, the `release/*` block — so the two
      lists can be compared mechanically at all.
- [ ] `npm run validate` green.

Deferred: none.

## Out of scope

- **The tiers themselves.** This record says the table is incomplete and
  ungated. It does not re-audit whether the 24 rows it does describe are
  described _accurately_ — that is a separate question and a harder one.
- **Bug 0174's open half.** The CLIs still print a rule/file denominator rather
  than `examined`. Different instrument, different record.
