# Plan 0662: the corpus rows run in one process

## Status

- **State:** Draft — authored 2026-11-27 from a measurement the same day; not reviewed.
- **Priority:** High. It is the largest measured cut in CI time that keeps every row's proof.
- **Effort:** Medium. An estimate of about a day, not measured.
- **Created:** 2026-11-27
- **Builds on:** [bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md), which made
  both of `check-corpus.mjs`'s exits read one verdict and put the end-to-end proof in two rows.

## Problem

Every corpus row in `scripts/check-nonvacuity.mjs` plants a probe and starts `check-corpus.mjs` in a
fresh process. That process reads and parses every document the gate reads (409 live and 289 frozen
at 8f3569ee) to judge the one file the row changed.

**Measured 2026-11-27**, on this machine at 8f3569ee, with a scratch copy of the gate whose body ran
as a function and whose `process.exit` calls threw (deleted afterwards):

|                                                          | time        |
| -------------------------------------------------------- | ----------- |
| a fresh process, as each row pays today (3 runs)         | 8.27–8.53 s |
| importing the gate's modules                             | 0.11 s      |
| first run in one process (parses everything)             | 8.04 s      |
| a later run in the same process, one broken link planted | 2.15 s      |
| a later run in the same process, clean (2 runs)          | 2.14–2.17 s |

The in-process runs gave the right verdicts: exit 1 with the planted link named over 34,648 checks,
and exit 0 over 34,647 checks, the count a fresh process prints. The saving is eess-md's parse memo
([bug 0547](../bugs/fixed/0547-eess-md-parses-a-text-more-than-once-per-process.md)), which keeps
every tree for the life of the process, so a later run parses only the texts that changed.

**What it is worth in CI.** From the per-row times of CI run 45969038139 (PR #344's final commit),
each corpus row taken at the measured 26% of its cost:

| shard | now      | corpus rows      | projected |
| ----- | -------- | ---------------- | --------- |
| 1     | 10.4 min | 42 rows, 4.8 min | 6.8 min   |
| 2     | 7.6 min  | 42 rows, 4.7 min | 4.1 min   |
| 3     | 9.8 min  | 42 rows, 6.3 min | 5.1 min   |
| 4     | 11.1 min | 42 rows, 6.6 min | 6.2 min   |

38.9 machine-minutes become about 22, and the slowest shard 11.1 minutes about 6.8. A projection
from one local ratio; the build measures it in CI. The `test` job (8–10 minutes on the same runs) then
sets a PR's wait, which is [spike 0663](../spikes/0663-where-the-eess-ts-suite-spends-its-time.md)'s.

## Design

**Proof kept.** Every row asserts what it asserts today, on the production gate's own code. What
changes is only that most rows call the gate in the harness's process instead of a new one. The
command CI runs is still proven end to end by the two rows
[bug 0548](../bugs/fixed/0548-check-corpus-exits-on-a-second-list.md) built for it,
`corpus/terminal-exit` and `corpus/adr-production`, which keep their fresh processes.

1. **The gate becomes a function.** `scripts/check-corpus.mjs` exports
   `runCheckCorpus(argv): { code, stdout, stderr }`, which runs today's body, captures what it writes
   and returns the exit code it would have used. The file's command path is a thin wrapper: call it,
   write the captured output, exit with the code. Its output is byte-identical to today's, checked on
   a clean tree, a probe, `--format json` and `--format github`.
2. **The harness calls it.** One helper, `corpusInProcess(args)`, returns the shape `sh()` returns,
   so no row's assertion changes: each `sh(process.execPath, [check-corpus, …])` in a corpus row
   becomes `corpusInProcess(…)`. Not converted:
   - `corpus/terminal-exit` and `corpus/adr-production` (the end-to-end proof);
   - the rows that run the gate in a clone (`runCorpusScript(…, { cwd: clone })`, 6 calls), since
     the gate reads its root from the working directory and changing it would be process-wide.
3. **Isolation, stated and checked.** One process means one set of module-level state. Each kind is
   decided and pinned:
   - **Files** are read from disk on every run: `corpus()` lists and reads them, and the kernel
     reads waivers from disk per run (`packages/core/src/execute-rule.ts:174-184`). A probe written
     or removed between runs is seen.
   - **The parse memo** (`packages/md/src/model/prose.ts:175`) is keyed by the text itself, compared
     exactly, so a changed file is a miss and its old tree is never served. It is kept: it is the
     saving.
   - **The kernel's other registered caches** (`packages/core/src/violation.ts:364`'s identity
     collisions, `packages/core/src/selection-memo.ts:55`'s selection memo) are read before the
     build: each is either proven keyed by objects a new run rebuilds, or reset between runs.
   - **The harness's own state** (pending restores, the probe sweep) is unchanged.
4. **A leak is caught, not assumed absent.** At the end of each shard, one clean in-process run and
   one fresh-process run must agree: the same exit code, the same rule ids and files, and the same
   number of checks. Accumulated state that changed a verdict would red the shard. It costs one fresh
   run per shard.

## Phases

1. `runCheckCorpus` and the wrapper; the output identity check above.
2. The cache classification of Design 3, with a test per cache that is kept.
3. `corpusInProcess` and the conversion of the corpus rows; the shard-end agreement check.
4. Sabotage rows (below), then CI's shard times recorded by value, before and after.

## Files changed

- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `scripts/lib/` (the helper, if the harness keeps it apart)
- `work/plans/ROADMAP.md`, [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md)
  (a dated note with the measured shards)

## Test inventory

- [ ] The command path's output is byte-identical before and after, on four inputs: a clean tree, a
      planted broken link, `--format json`, `--format github`.
- [ ] Every converted row passes in-process and reds against its rule's sabotage, as it does today:
      the full `check:nonvacuity` in CI, all four shards.
- [ ] **Sabotage, a leak:** a scratch variant in which a run leaves a planted probe's tree visible to
      the next run reds the shard-end agreement check.
- [ ] **Sabotage, a cache that must reset:** for each cache Design 3 resets, a variant without the
      reset reds a named row.
- [ ] **Sabotage, the wrapper:** the wrapper's exit deleted reds `corpus/terminal-exit`; the output
      not written reds it too.
- [ ] Shard times, as CI job durations, before (run 45969038139) and after, recorded by value with
      the caveat of one run each side.

## Out of scope

- The arch, family and diagram rows, which start `eess-ts` and load a TypeScript project: the same
  idea, a different engine, its own plan once this one has measured what holds.
- The ledger rows: [bug 0661](../bugs/0661-check-ledger-exits-on-a-second-list.md) first, so the
  ledger gate has one verdict before its rows lose a process.
- A parse cache on disk, shared between processes. The eess-rust session's open PR #343 carries a
  plan for it; in one process the memo already gives the saving.
- The `test` job: [spike 0663](../spikes/0663-where-the-eess-ts-suite-spends-its-time.md).
