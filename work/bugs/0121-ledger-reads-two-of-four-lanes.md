# Bug 0121: `check:ledger` reads two of four `work/` lanes — proposals carry `State:` and no lane opens them

## Status

- **State:** Draft — the gap is enumerated against the lane list and the corpus;
  no red test yet.
- **Severity:** Low — proposals remain a small lane, and because the lane has no
  terminal state to reach, nothing is currently mis-stated. It is the same shape
  of blindness as [0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md), one
  lane over.
- **Origin:** self-found · enforcement review of 0119's fix
- **Reported:** 2026-08-12 · **Counts refreshed:** 2026-08-13

## Symptom

`scripts/check-ledger.mjs` declares two lanes, `work/plans/**` and
`work/bugs/**`. `work/` has four (counts as of 2026-08-13):

| lane                | `State:` records | scanned |
| ------------------- | ---------------- | ------- |
| `work/plans/**`     | 29               | yes     |
| `work/bugs/**`      | 46               | yes     |
| `work/proposals/**` | 4                | **no**  |
| `work/spikes/**`    | 0                | no      |

All four of `work/proposals/001`–`004` carry `**State:**` headers and are checked
by nothing. 0118's title was "`check:ledger` reads `work/plans/**` only"; the fix
made that "reads two of four", which is better and still not what the summary
line implies.

Spikes hold no markdown records at all (`work/spikes/0001-eess-over-ts-archunit/`
contains only `node_modules`), so proposals is the live gap.

**The lane has since grown and gained a board.** It was two records when this was
filed and is four now, all of them carrying a recorded ruling, plus
[`PROPOSALS.md`](../proposals/PROPOSALS.md). The board is not a substitute for the
gate — it is hand-maintained, exactly like the lane list this bug is about — but
it does settle part of the Fix's open question below.

## Root cause

The lane list is hand-maintained, and the gate reports what it _did_ scan without
reporting what it did **not** open. Same class as the gate-list drift bug
[0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) fixed one
level up, where `GATE_FOR` gained a reverse check that every gate row is claimed
by some `check:*`.

## Why it matters

Small in itself. It matters because the reader of

```
plans      29 scanned · 29 with a readable State · 16 done (ledger-checked)
bugs       46 scanned · 46 with a readable State · 12 done (ledger-checked)
```

has no way to know that a third lane exists and is unread. The per-lane counts
make the gate look exhaustive precisely because they are itemised.

## Fix

Two parts, and the second is the one that generalises:

1. Add a `proposals` lane. Its vocabulary needed deciding — proposals close by
   being **ruled on**, not by being done, so the plan enum is wrong.
   [`PROPOSALS.md`](../proposals/PROPOSALS.md) now writes that vocabulary down:
   `State` is `Draft | Reviewed`, and the terminal fact is the **`Ruling`** —
   `Ship as-is | Ship with changes | Split and sequence | Rewrite needed |
Docs-only | Reject`. So the lane needs **two** fields, not one, which is why the
   plan enum could never have fitted it. `closeInPlace: true` still holds: the
   lane has no terminal folder, and a declined proposal (002) sits where it is
   with its ruling in its header.
2. **Assert the lane list against `work/`.** Enumerate the directories under
   `work/` and fail when one carries `State:` records and no lane claims it —
   the same reverse check `gateCoverage` now applies to gate rows. Without this,
   part 1 is a fix that lasts until the next lane is created.

## Verification

- [ ] Red test written first: adding a directory under `work/` with a `State:`
      record and no lane fails the gate. Passes today.
- [ ] Proposals are scanned, and the four live records report nothing.
- [ ] The summary line names every lane, scanned or waived, so "not scanned" is
      visible rather than absent.
- [ ] `npm run validate` green.

Deferred: none.
