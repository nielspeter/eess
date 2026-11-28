# Bug 0666: the parse memo reuses nothing once a corpus outgrows it

## Status

- **State:** Draft — found 2026-11-28 while measuring an adopter's corpus; reproduced the same day
  with a counting parser; reviewed the same day by the architect and method lenses ("Review,
  2026-11-28"); no fix yet. The fix starts as a spike.
- **Severity:** Medium — nothing is judged wrongly. A corpus larger than the memo's bound is parsed
  again in full for every corpus built over it, with no notice. [Bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)'s
  "one parse per distinct text per process" is then false, and nothing says so.
- **Origin:** self-found · timing a second corpus over an adopter's documents, 2026-11-28. Filed in a
  separate clone by another session; brought into this repository unchanged, then revised against its
  review.
- **Reported:** 2026-11-28

## Symptom

[Bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md) made eess-md parse a
text once per process, by a memo. On a corpus below the memo's bound that holds: a second corpus over
the same files costs almost nothing. On a corpus above the bound, a second corpus costs what the
first did.

Measured 2026-11-28 with eess-md 0.19.0 at cbc8eed2, Node 24.22.0, on one adopter's documents: three
`corpus({ roots })` built in one process and `documents()` read from each. The machine was under
other load, so the seconds are high; the pattern is what is measured. Not recorded: whether the four
rows ran in one process or four, and with what instrument the 2.6 GB peak below was read. The
adopter's documents are not in this repository, so the table cannot be repeated from it; the
reproduction below can.

| corpus              | characters | first  | second | third  |
| ------------------- | ---------- | ------ | ------ | ------ |
| 1,310 documents     | 8.2 M      | 9.9 s  | 0.15 s | 0.14 s |
| 558 documents       | 11.0 M     | 11.7 s | 0.15 s | 0.16 s |
| those two together  | 19.2 M     | 18.5 s | 15.1 s | 14.8 s |
| all 2,312 documents | 24.6 M     | 23.3 s | 23.8 s | 25.5 s |

**This repository.** The gates' roots hold 10,425,441 characters in 704 files at 890a2cea (every
tracked Markdown file, 11,451,423 in 1,513, is not what any gate reads). They held 8,101,076 at
[spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) (2026-10-25), so they grow about
68,000 characters a day. The bound, 16,777,216, is 1.61 times today's corpus, not the "twice" of
`packages/md/src/model/prose.ts:172-173`, and at that rate is reached in about three months. Measured
by the method and architect reviews. `packages/md/src` is unchanged from cbc8eed2 to 890a2cea, so the
memo measured above is the one this record is about.

## Reproduction

`createParseMemo` with a bound of 100,000 characters, a parser that only counts its calls, and texts
of 1,000 characters each, read three times in the same order:

| texts | share of the bound | parses in pass 1 | pass 2 | pass 3 |
| ----- | ------------------ | ---------------- | ------ | ------ |
| 90    | 0.9                | 90               | 0      | 0      |
| 101   | 1.01               | 101              | 101    | 101    |
| 110   | 1.1                | 110              | 110    | 110    |
| 150   | 1.5                | 150              | 150    | 150    |
| 300   | 3                  | 300              | 300    | 300    |

Reproduced exactly by both reviews, against the built `packages/md/dist/model/parse-memo.js` and the
source: at 1.00 times the bound every text is reused, at 1.01 none is.

## Root cause

The memo is created with a fixed bound of 2^24 characters (`packages/md/src/model/prose.ts:174`) and
drops the **least recently used** entry when a new text would pass it
(`packages/md/src/model/parse-memo.ts:58`; its test is titled "…evicts the least recently used, not the
oldest", `packages/md/tests/parse-memo.test.ts:127`).

That this policy reuses nothing over a repeated scan larger than the bound was known and decided. The
memo's comment says so (`packages/md/src/model/parse-memo.ts:17-20`: "The bound must hold a corpus,
since LRU over a repeated scan larger than itself keeps nothing"), and so does [spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md)'s decision
(`work/spikes/0546-where-a-corpus-check-spends-its-time.md:140-143`). The bound was accepted on the
premise that it holds a corpus, sized against this repository alone, at twice its corpus then. The
defect is that the premise fails, silently: an adopter's corpus is larger than the bound, and this
repository's is on course to be.

A corpus reads its documents in one order each time. After one pass over more than the bound, the
memo holds the most recently read texts and has dropped the first; the next pass asks for the first,
misses, and to make room drops the least recently used, which is the next one it will ask for. With
distinct texts read in one order, nothing survives, whatever their sizes: the reviews' runs with uneven
sizes at 1.19, 1.91 and 3.24 times the bound, and 3,000 simulated trials, reused nothing. The partial
speed-up of the 19.2 M row is a ratio of seconds under load, not a count of parses; it can come only
from identical texts within one pass, a different order between passes, or time that is not parsing,
and which it is was not measured.

## Why it matters

- A corpus this size is where the memo is needed most, and it is where it gives nothing.
- The cost is silent. The gate is correct and slow, and nothing says the memo is full.
- **[Plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md) rests on it.** Its CI
  saving is the memo staying warm across in-process gate runs. Past the bound, each in-process corpus
  row would go back to a full parse, about 8 s, and the shards toward their 20-minute timeout
  ([bug 0552](./0552-nonvacuity-shard-3-runs-near-its-timeout.md)). Its shard-end agreement check
  (`scripts/check-nonvacuity.mjs:2404`) masks elapsed time and compares output, so it cannot see a
  cold memo.
- [Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) and
  [bug 0657](./fixed/0657-eess-md-copies-every-parsed-tree.md) measured the memo on this repository
  only, so their gains are not evidence for a larger corpus.

## Fix

Not designed. It reopens [spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md)'s decision and is a performance design, so it starts as a
time-boxed spike that brings a design back. The questions it must answer:

- **The policy.** Dropping the newest entry, or refusing new entries once full, reuses about
  bound ÷ total of a repeated scan, where dropping the least recently used reuses none. Either keeps
  whatever came first in the process, which costs the workloads that read one corpus after another:
  a watch session, a test worker.
- **The bound.** Whether it stays fixed, follows the largest corpus built in the process (by analogy
  to [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s clause 6),
  or is an option. An option does not go on `corpus()`, since the memo is process-wide and it would
  add public surface ([ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md),
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)); on eess-md's `/internal`, if
  anywhere. The bound exists to bound memory, and the measurements disagree: the memo's own estimate
  of 10–12.5 bytes a character puts 24.6 M at about 250–310 MB, against the 2.6 GB peak above. Retained
  heap per character needs measuring on a corpus that large; trees a live corpus still holds cost the
  memo nothing extra.
- **Saying it.** [Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) ruled the memo "no [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) instrument" (running out costs time, never a
  verdict), so a finding would be wrong. A notice is allowed: a fact the caller prints, as
  `commentSuppressionNotice()` is, since the memo must not print itself
  ([ADR-008](../../adr/008-caller-owns-reporting.md)).
- **Counting it.** Hit, miss and eviction counts on eess-md's `/internal`, and a `check:nonvacuity`
  assertion that a warm in-process corpus run parses at most a stated number of texts: the one check
  that would see [plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md)'s saving go.
- **Placement:** eess-md. The memo is mdast's, no sibling dialect has one, and the kernel already
  supplies `registerCacheReset`.

## Verification

- [ ] Red first: with a counting parser and texts totalling 1.01 times the bound, a second pass in the
      same order parses every text again today.
- [ ] After the fix, a second pass over texts totalling 1.5 times the bound parses at most
      (total − bound) worth of texts, the number the chosen policy states, and the same holds through a
      public entry (`corpusFromText` built twice), which needs the bound settable from a test.
- [ ] A synthetic corpus of more than 2^24 characters, generated so anyone can repeat it, measured
      before and after: parses counted and retained heap read with a named instrument.
- [ ] `check:nonvacuity` asserts a warm in-process corpus run parses at most a stated number of texts,
      with a sabotage row: the bound set below the corpus reds it.
- [ ] The tests a policy change rewrites are rewritten on purpose: the LRU test at
      `packages/md/tests/parse-memo.test.ts:127` and [bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)'s M13 mutant. A case covers identical
      texts within one pass.

## Review, 2026-11-28

Reviewed by the architect and method lenses ([PR #349](https://github.com/nielspeter/eess/pull/349));
their full reviews were written to the session's scratchpad. Neither found a critical defect; both
reproduced the table. Answered in this revision:

- **The 19.2 M row's explanation was impossible** (both): with distinct texts in one order, LRU keeps
  nothing whatever the sizes; the sentence is replaced by what can and cannot explain it.
- **A decided limit read as a discovery** (both): the memo's comment and [spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md)'s decision are
  quoted, and the defect is stated as their premise failing; "oldest" is now "least recently used".
- **[Plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md)'s dependence and this repository's real margin** (both): 10.43 M characters against
  16.78 M, 1.61x, growing about 68,000 a day; the agreement check cannot see a cold memo; a counting
  question added.
- **The memory figures disagree** (architect): stated, with what to measure.
- **The fix is a performance design** (architect): a spike first.
- **Verification was partly unfalsifiable** (method): each item now names a number or a red.
- **Unsourced figures** (method): 11.5 M replaced by the gates' own corpus, and what the adopter table
  does not record is said.
