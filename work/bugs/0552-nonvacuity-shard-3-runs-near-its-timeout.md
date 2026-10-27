# Bug 0552: the slowest nonvacuity shard runs near its 20-minute timeout

## Status

- **State:** Draft — found 2026-10-27 reading the CI shard times of PR #268; measured from CI's own
  job, step and per-row times; no fix chosen.
- **Severity:** Medium — nothing passes that should not: a shard that times out is red, and a rerun
  clears it. But it reds a PR for a reason the PR did not cause, and already can on an unchanged tree:
  two runs of one tree differed 1.6x (below), and the slowest shard needs about 17 minutes on a fast
  runner. Its cost grows with every row added and every time `check:corpus` or the eess-md examples
  grow, with no row added. This is the second shard timeout this week, after
  [bug 0547](./fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)'s (PR #260, shard 2).
- **Origin:** self-found, 2026-10-27, while building
  [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s Phase 1. Recorded
  rather than fixed there: it is CI capacity, not that plan's work.
- **Reported:** 2026-10-27

## Symptom

`check:nonvacuity` runs as four shards in CI ([plan 0509](../plans/completed/0509-shard-check-nonvacuity-in-ci.md)),
each with `timeout-minutes: 20` (`.github/workflows/ci.yml:127`). The `npm run check:nonvacuity`
step per shard, on `main` and on #268 (run ids in the Evidence section):

| commit (PR)         | shard 1 | shard 2 | shard 3    | shard 4 |
| ------------------- | ------- | ------- | ---------- | ------- |
| 62473535 (pre-#260) | 8m38s   | 12m18s  | 7m54s      | 9m08s   |
| 49f4a343 (#260)     | 5m24s   | 8m09s   | 11m02s     | 9m36s   |
| c9e55336 (#262)     | 8m19s   | 8m59s   | 14m39s     | 6m40s   |
| acfd806c (#263)     | 8m09s   | 5m38s   | 8m59s      | 9m59s   |
| 8e1c2b33 (#264)     | 8m15s   | 8m03s   | 9m58s      | 9m57s   |
| 10a71839 (#265)     | 9m39s   | 7m36s   | **14m00s** | 10m19s  |
| 11cbfd95 (#266)     | 6m25s   | 9m03s   | **14m49s** | 10m39s  |
| c6e7b8f9 (#267)     | 6m36s   | 8m53s   | **14m54s** | 10m53s  |
| ae030ed2 (#268, PR) | 9m37s   | 8m53s   | **17m01s** | 11m32s  |

Since #265 shard 3 has been 14–15 minutes on four runners in a row, then 17m01s; its job on #268 ran
17m40s with checkout, `npm ci` and the build. Each shard held 64 fixtures on #268, so the gap is cost,
not count. Which shard is slowest is this week's: `k mod N` moves every later row to another shard
when one is inserted ([plan 0509](../plans/completed/0509-shard-check-nonvacuity-in-ci.md)'s
Decisions), so it was shard 2 on #260. The workflow's comment still says "About 10.5 min in CI at
the slowest shard" (`.github/workflows/ci.yml:125`), the drift
[bug 0378](./0378-ci-jobs-have-no-timeout.md)'s rule (a timeout set from a measured green run)
exists to stop.

#267's first attempt timed out on shard 3 from both causes at once: `actions/setup-node` took 10
minutes there (3 seconds on shard 1), a runner flake, and the shard then needed more than the
remaining 10. Its fixtures had run 9m47s and were four rows short.

## Cause

`selectShard` assigns fixture `k` to shard `k mod N` by position (`scripts/lib/nonvacuity-shards.mjs:53`);
a fixture's cost does not enter. On #268, each shard's fixture seconds, rebuilt from the log's
per-row timestamps:

| #268 shard | rows | fixture s | rows over 30 s (their s) | other rows' s |
| ---------- | ---- | --------- | ------------------------ | ------------- |
| 1          | 64   | 574       | 1 (73)                   | 501           |
| 2          | 64   | 530       | 1 (49)                   | 481           |
| 3          | 64   | 1,017     | **6 (531)**              | 486           |
| 4          | 64   | 689       | 2 (154)                  | 535           |

Without its heavy rows shard 3 costs what the others do: the whole imbalance is six rows.
`examples/md-fixtures-are-load-bearing` took 213 s (it prints its own time: 65 judgements proven
load-bearing both ways), then `corpus/record-mention/production-base` 87 s,
`arch/no-new-kernel-registry` 82 s, `corpus/record-mention/raised-from-zero` 58 s,
`arch/examples-md-public-blocks-only` 50 s and `corpus/record-mention/ts-archunit-skipped` 42 s (added
by [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s Phase 1).

The rows also cost more over time: at #265 shard 3 kept its 63 rows and went from 596 s to 837 s;
its corpus rows went from 294 s to 450 s, and the examples row grows with the examples it proves (40
judgements at 77–123 s, 65 at 180–213 s). And runners vary: c9e55336 and acfd806c ran the same
harness over the same examples, and shard 3 went 14m39s → 8m59s, its slowest rows scaling together.

## Fix

Not chosen. A performance design, so a time-boxed spike comes first and brings a design back. Its
question: what keeps every shard well under its limit as rows are added and grow, across runner
variance? Totals frame it: #268's fixtures sum to 2,810 s, so a perfect split over four shards is
about 11.7 minutes each, and 1.6x variance puts that near 19. Candidates to measure, not choose:

- **Make the heavy rows cheaper or split them.** [Bug 0548](./0548-check-corpus-exits-on-a-second-list.md)'s
  fix runs `check-corpus.mjs` once per corpus row instead of twice, about half their cost (372–567 s
  of each shard on #268). The examples row is one row: no assignment can put less than its 213 s on
  the shard that gets it.
- **Assign by cost.** Each shard's report already carries per-fixture `durations`
  (`scripts/check-nonvacuity.mjs:5997-6033`), kept one day (`retention-days: 1`); the logs carry
  per-row times for 90 days. It keeps [plan 0509](../plans/completed/0509-shard-check-nonvacuity-in-ci.md)'s first property (the merge checks the partition from
  what each shard reports it ran, so a wrong assignment is red, never green) and weakens its second
  ("nothing is kept by hand"): a cost table is a second list, a fixture with no recorded cost needs a
  default, and the list's digest covers names only.
- **More shards**, or **a raised timeout**, which only moves the limit.
- **Say it on every run**: the merge has every shard's `durationMs` and prints none of it; printed
  against the timeout, this drift would show without reading CI by hand.

[Spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) measured where a corpus check
spends its time and is the starting point.

## Evidence

Runs (`gh api repos/nielspeter/eess/actions/runs/<id>/jobs`): main 40176679421, 40205617787,
40233126271, 40293435731, 40333280637, 40375964409, 40523499908, 40531301145; PR #267 40524730583
(attempts 1 and 2); PR #268 40575108272. Measured 2026-10-27.

## Verification

- [ ] A spike measures each fixture's CI cost and runner variance, and brings a design back for a
      decision (an assignment, cheaper rows, or both).
- [ ] The chosen fix keeps the slowest shard, over at least five CI runs, below a share of its timeout
      the spike states; the workflow's comment states the measured slowest time. If the fix is
      [bug 0548](./0548-check-corpus-exits-on-a-second-list.md)'s, this bug closes on that record's
      before-and-after shard measurement.
