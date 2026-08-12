# Bug 0121: `check:ledger` reads two of four `work/` lanes — proposals carry `State:` and no lane opens them

## Status

- **State:** Draft — the gap is enumerated against the lane list and the corpus;
  no red test yet.
- **Severity:** Low — proposals are a small lane and the two live records are
  both `Draft`, so nothing is currently mis-stated. It is the same shape of
  blindness as [0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md), one lane
  over.
- **Origin:** self-found · enforcement review of 0119's fix
- **Reported:** 2026-08-12

## Symptom

`scripts/check-ledger.mjs` declares two lanes, `work/plans/**` and
`work/bugs/**`. `work/` has four:

| lane                | `State:` records | scanned |
| ------------------- | ---------------- | ------- |
| `work/plans/**`     | 29               | yes     |
| `work/bugs/**`      | 30               | yes     |
| `work/proposals/**` | 2                | **no**  |
| `work/spikes/**`    | 0                | no      |

`work/proposals/001-md-corpus-rule-coverage.md` and
`002-comment-embedded-links.md` both carry `**State:**` headers and are checked
by nothing. 0118's title was "`check:ledger` reads `work/plans/**` only"; the fix
made that "reads two of four", which is better and still not what the summary
line implies.

Spikes carry no `State:` line today, so proposals is the live gap.

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
bugs       30 scanned · 30 with a readable State ·  9 done (ledger-checked)
```

has no way to know that a third lane exists and is unread. The per-lane counts
make the gate look exhaustive precisely because they are itemised.

## Fix

Two parts, and the second is the one that generalises:

1. Add a `proposals` lane. Its vocabulary needs deciding — proposals close by
   being **ruled on**, not by being done, so the plan enum is probably wrong.
   `Draft | Reviewed | Accepted | Declined` with `Accepted`/`Declined` terminal is
   a starting point, and `closeInPlace: true` since proposals are not moved.
2. **Assert the lane list against `work/`.** Enumerate the directories under
   `work/` and fail when one carries `State:` records and no lane claims it —
   the same reverse check `gateCoverage` now applies to gate rows. Without this,
   part 1 is a fix that lasts until the next lane is created.

## Verification

- [ ] Red test written first: adding a directory under `work/` with a `State:`
      record and no lane fails the gate. Passes today.
- [ ] Proposals are scanned, and the two live records report nothing.
- [ ] The summary line names every lane, scanned or waived, so "not scanned" is
      visible rather than absent.
- [ ] `npm run validate` green.

Deferred: none.
