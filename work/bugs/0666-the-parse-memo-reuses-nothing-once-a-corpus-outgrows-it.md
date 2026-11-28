# Bug 0666: the parse memo reuses nothing once a corpus outgrows it

## Status

- **State:** Draft — found 2026-11-28 while measuring an adopter's corpus; reproduced the same day
  with a counting parser; no fix yet.
- **Severity:** Medium — nothing is judged wrongly. A corpus larger than the memo's limit is parsed
  again in full for every corpus built over it, with no notice, and this repository's own corpus is
  too small to show it.
- **Origin:** self-found · timing a second corpus over an adopter's documents, 2026-11-28.
- **Reported:** 2026-11-28

## Symptom

[Bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md) made eess-md parse a
text once per process, by a memo. On a corpus below the memo's limit that holds: a second corpus over
the same files costs almost nothing. On a corpus above the limit, a second corpus costs what the
first did.

Measured 2026-11-28 with eess-md 0.19.0 at cbc8eed2, Node 24.22.0, on one adopter's documents, three
`corpus({ roots })` built in one process and `documents()` read from each. The machine was under
other load, so the seconds are high; the pattern is what is measured.

| corpus              | characters | first  | second | third  |
| ------------------- | ---------- | ------ | ------ | ------ |
| 1,310 documents     | 8.2 M      | 9.9 s  | 0.15 s | 0.14 s |
| 558 documents       | 11.0 M     | 11.7 s | 0.15 s | 0.16 s |
| those two together  | 19.2 M     | 18.5 s | 15.1 s | 14.8 s |
| all 2,312 documents | 24.6 M     | 23.3 s | 23.8 s | 25.5 s |

This repository's corpus is about 11.5 M characters, so none of its gates reaches the limit.

## Reproduction

`createParseMemo` with a limit of 100,000 characters, a parser that only counts its calls, and
texts of 1,000 characters each, read three times in the same order:

| texts | share of the limit | parses in pass 1 | pass 2 | pass 3 |
| ----- | ------------------ | ---------------- | ------ | ------ |
| 90    | 0.9                | 90               | 0      | 0      |
| 110   | 1.1                | 110              | 110    | 110    |
| 150   | 1.5                | 150              | 150    | 150    |
| 300   | 3                  | 300              | 300    | 300    |

Ten per cent over the limit, not one tree is reused.

## Root cause

The memo is created with a fixed limit of 2^24 characters, about 16.8 M
(`packages/md/src/model/prose.ts:174`). When a new text would pass the limit, the oldest entries
are dropped until it fits (`packages/md/src/model/parse-memo.ts:58`).

A corpus reads its documents in the same order every time. After one pass over a corpus larger than
the limit, the memo holds the last documents read and has dropped the first. The next pass asks for
the first document, misses, parses it, and to make room drops the oldest entry it holds, which is
the document it will ask for next. Every request misses for the same reason. Dropping the oldest
entry is the worst choice for a reader that repeats one order.

The real corpora above are not uniform in size, which is why 19.2 M characters kept about a fifth:
some small documents survive between passes.

## Why it matters

- A corpus this size is where the memo is needed most, and it is where it gives nothing.
- The cost is silent. The gate is correct and slow, and nothing says the memo is full.
- It multiplies. A suite that builds a corpus per test, as a suite of non-vacuity proofs does,
  parses the whole corpus each time.
- [Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) and
  [bug 0657](./fixed/0657-eess-md-copies-every-parsed-tree.md) measured the memo on this
  repository only, so their gains are not evidence for a larger corpus.

## Fix

Not designed. The questions a fix has to answer:

- Whether a fixed limit is right at all, or the memo should hold what the corpora in the process
  hold. The limit exists to bound memory; the run above peaked at 2.6 GB with the trees of one pass
  alive.
- If a limit stays, what is dropped. Dropping the newest entry, or refusing new entries once full,
  keeps the first 16.8 M characters across passes; dropping the oldest keeps none.
- Whether reaching the limit is said out loud, as
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) asks of an
  instrument that can run out. Here running out costs time and no verdict, so the ADR may not bind.

## Verification

- [ ] Red first: with a counting parser and texts totalling 1.1 times the limit, a second pass in
      the same order parses every text again today.
- [ ] A second pass over texts totalling more than the limit parses fewer texts than the first.
- [ ] A second corpus over a corpus larger than 2^24 characters is measured before and after.
- [ ] The memo's own tests in `packages/md/tests/parse-memo.test.ts` cover a read that repeats one
      order over more than the limit.
