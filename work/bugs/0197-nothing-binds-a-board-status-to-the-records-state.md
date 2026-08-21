# Bug 0197: nothing binds a board's Status cell to the record's own `State:` token

## Status

- **State:** Draft — one live instance; the gap is the finding, not the count.
- **Deferred:** none
- **Found:** 2026-08-21, testing review of PR #73 (noticed on bug 0186's row,
  which this PR fixed by hand).

## Symptom

`work/bugs/BUGS.md` carries a Status cell per row (`🔴 Draft` / `✅ Fixed →
fixed/`). The record itself carries the authoritative token,
`**State:** Fixed — …`. **Nothing compares them.**

`check:ledger` reads the board for _placement_ — that a done record lives in its
done-folder — but not for _State agreement_. So a row can say `🔴 Draft` over a
record that says `Fixed`, sitting in `fixed/`, struck through on the board.

## Live instance (n=1 today)

```
| ~~[0189](./fixed/0189-…)~~ | … | Medium | 🔴 Draft | … |
```

Struck through, filed under `fixed/`, record reads `**State:** Fixed`. Every
other signal on the row says done; the Status cell says Draft.

Bug 0186 had the identical defect until PR #73 fixed it **by hand** — which is
the reason to file this rather than fix the one cell and move on: the corpus has
now produced this twice, and the second one was only caught because a reviewer
happened to read the row.

## Scope — read this before building a gate

**`work/plans/ROADMAP.md` is NOT in scope, and assuming it was produced a false
count.** The first measurement of this bug reported **27** drifting rows; 26 were
an artefact. ROADMAP's `## Shipped` table has **no Status column at all** —
placement in that table _is_ the status — so a detector looking for a Status cell
finds none and reports disagreement. The real number is **1**.

That mis-measurement is recorded here on purpose: it is the same instrument-shaped
error as [bug 0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md)'s
and the `grep '^✓'` gate-table error in the same PR — an instrument that looks
for one shape and reports absence as a finding. A gate built for this must know
which boards have a Status column and which express status by placement.

## Fix

Not decided. Likely an `eess-md` rule in the honesty-at-close family: for each
board row that links to a record, resolve the record's `**State:**` token and
require the Status cell to agree. It needs a declared per-board policy
(`BUGS.md` has a Status column; `ROADMAP.md`'s `## Shipped` does not) rather than
one rule assuming every board is shaped alike.

## Verification

- [ ] Red test first: flipping 0189's Status cell to `✅ Fixed` is the fix, so
      the red test is the _reverse_ — a fixture board whose cell says Draft over
      a `Fixed` record must red.
- [ ] `ROADMAP.md`'s `## Shipped` table produces **zero** findings — the false
      26 above must not reappear.
- [ ] The break class is registered in `scripts/check-nonvacuity.mjs`.
