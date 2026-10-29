# Plan 0509: shard `check:nonvacuity` in CI

## Status

- **State:** Done — built 2026-10-19 at the coordinator's order, on branch `ci/shard-nonvacuity`.
- **Priority:** Medium — every PR waits on the slowest job, and that job is mostly one step. A green
  run means the same after this lands; it arrives sooner.
- **Effort:** Small. One helper module and its tests, three modes in the harness, two CI jobs.
- **Created:** 2026-10-19

## Problem

CI's single `test` job took about 43 minutes. Measured by the coordinator on recent runs:
`npm run check:nonvacuity` alone took 31.9 minutes of it, and `npm run test`, the step after,
7.4 minutes. Locally the same harness takes about 13 minutes, running its fixtures one after
another. Every PR waits on that run, and every superseded push queued another.

## Design

**Shards.** The harness's own `gates` list is the only fixture list. Shard `i` of `N` runs the
fixtures at positions `i-1`, `i-1+N`, `i-1+2N`, … of that list, with the two instruments (`harness
self-check`, `gate coverage`) left out (`selectShard` in `scripts/lib/nonvacuity-shards.mjs`).
Nothing is kept by hand, and a fixture added anywhere in the list lands in some shard by
construction. CI runs `npm run check:nonvacuity` with `EESS_NONVACUITY_SHARD=<i>/<N>` in a matrix
job, `nonvacuity-shard`; `N` is `strategy.job-total`, so the matrix's length is written once.

Each shard prints `shard i/N — K of T fixtures (list <digest>)`, runs them, and writes a report
(`EESS_NONVACUITY_REPORT`): its index, `N`, a digest of the whole fixture list, the names it
selected, the names it ran (recorded inside `runGate`, after each fixture's `run()` returned), the names that did not fire, the rule
ids its fixtures asserted on, and per-fixture durations. A shard reds on any fixture that does not
fire, on a malformed spec, on selecting zero fixtures, and when what it ran differs from what it
selected.

**Merge.** A second job, `nonvacuity`, waits for every shard (`needs:`), runs when a shard failed too
(`if: ${{ !cancelled() }}`), downloads the reports and runs the harness with
`EESS_NONVACUITY_MERGE=<dir>`. It does not trust the selector. It is the one place that checks:

- each report's `ran` equals its `selected`;
- every fixture of this checkout's list RAN in exactly one shard (none missing, none twice, no name
  the list does not have). The partition and the closing count (`N fixtures each fired`) are built
  from the union of `ran` less `failed`, never from `selected` or the length of the list ([ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md)).
  The first version built both from `selected` and the list, so a shard loop that ran nothing read
  green in the shard and in the partition (PR #250's enforcement review, C1);
- shards `1..N` each reported once, all with the same `N` and the digest of this checkout's list;
- no shard reported a fixture that did not fire;
- the whole-set checks: `harness self-check`, `gate coverage`, and `rule-id coverage` over the
  union of the rule ids the shards asserted. Rule-id coverage cannot run in a shard: it already
  fails under `QA_ONLY`, because each shard asserts only its own fixtures' ids.

The merge needs Node builtins only, so it skips `npm ci` and takes seconds.

**What is unchanged.** With no shard variable set, the harness runs the whole set exactly as
before, so `npm run check:nonvacuity` and `npm run validate` locally are the full run. The npm script
now also runs `node --test scripts/lib/nonvacuity-shards.test.mjs`, the same pattern as
`check:corpus` and `check:family`. `QA_ONLY`, a shard, a merge and `--plan` refuse to combine.
`node scripts/check-nonvacuity.mjs --plan N` prints the assignment without running anything.

**Concurrency.** The workflow gains `concurrency: { group: ci-${{ github.workflow }}-${{
github.event_name == 'pull_request' && github.ref || github.sha }}, cancel-in-progress: ${{
github.event_name == 'pull_request' }} }`. A PR run on a superseded commit of the same PR is
cancelled; on `pull_request` the ref is `refs/pull/N/merge`, so each PR, stacked or not, has its own
group. Every other run, a push to `main` among them, is grouped by its commit, so it shares a group
with nothing and is never cancelled or queued by this block. The first version grouped `main` by
ref and claimed that kept every commit's result; it did not. GitHub keeps one running and one
pending run per group and cancels the pending one when a third arrives, whatever
`cancel-in-progress` says, so the middle commit of three quick merges would have had no CI result,
and merges would have run one at a time (PR #250's DevOps review, I1).

**N = 4.** Chosen from the measured numbers: 31.9 minutes over four shards is about 8 minutes of
fixtures each, plus about 1.5 minutes of install and build per shard (measured in CI: about 35 s).
See the Build notes for the per-shard local and CI durations.

**Cost.** Each run now starts 7 jobs instead of 2. Runner minutes are about the same (about 43.6 min
of job time per run against about 43.7 before; the repeated `npm ci` and build add about 2.3 min,
the shorter `test` job takes it back). The binding limit is the account's concurrent-job cap (20 on
GitHub's Free plan, if that is the plan in use): about three simultaneous PR runs now fill it,
against about ten before, so with many stacked PRs pushed at once, expect queueing. Cancelling
superseded PR runs offsets part of that (PR #250's DevOps review, M3).

## How this gate could fail open, and what reds

| What goes wrong                                                                                   | What reds                                                                                             |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| a shard selects no fixture (N too large, a selector bug)                                          | the shard itself: `selected 0 of T fixtures`, exit 1                                                  |
| a malformed or out-of-range shard spec                                                            | the shard: `is not of the form i/N` / `shard 5 of only 4`, exit 1, never "run everything"             |
| a shard's loop runs fewer fixtures than it selected, or none                                      | the shard (`selected K fixtures but ran J`) and the merge (`selected but not run`, `ran in no shard`) |
| the selector drops a fixture from every shard                                                     | the merge: `fixture "<name>" ran in no shard`                                                         |
| the selector runs a fixture twice                                                                 | the merge: `ran in shards a, b`                                                                       |
| a shard job is dropped from the matrix, or crashes before its report                              | the merge: `shard k of N sent no report` (the upload step also fails on a missing file)               |
| a shard hangs                                                                                     | `timeout-minutes: 20` on the shard job, then the merge: `sent no report`                              |
| a shard's fixture does not fire                                                                   | the shard (exit 1) and the merge, by name                                                             |
| reports from another fixture list (a stale artifact, a changed list)                              | the merge: `made from a different fixture list`                                                       |
| no report at all                                                                                  | the merge: `no shard report found`; its closing line says the merge failed, not a fixture             |
| a corpus rule id that no shard's fixture asserts                                                  | the merge's `rule-id coverage`, over the union                                                        |
| the instruments stop running                                                                      | `gate coverage`'s and `harness self-check`'s lines run only in the merge; a test pins them there      |
| two gate rows share a name, so "exactly one shard" is unanswerable                                | `gate coverage` (unsharded), the shard and the merge                                                  |
| the merge job is deleted, stops waiting, is skipped on a failed shard, or set `continue-on-error` | `gate coverage` reads `ci.yml` (`checkNonvacuityJobs`) and reds                                       |

Residuals:

- `gate coverage` reads `ci.yml` by line pattern, as `checkBunLoadJob` does ([plan 0448](./0448-a-bun-load-guard-and-bug-0439s-fix.md)); a YAML
  shape it does not recognise reds rather than passes, but a semantically equivalent rewrite could
  red too.
- The shard and merge tests run only as the tail of the npm script, `&& node --test
scripts/lib/nonvacuity-shards.test.mjs`; no vitest config picks them up. That link was the single
  point of failure (PR #250's enforcement review, I2): drop it and the 22 tests run nowhere. `gate
coverage` now reds when `check:nonvacuity` no longer contains it. Dropping the link and that check
  together, two edits in two files, is still silent. The same exposure holds for every `&& node
--test` tail in `package.json`; it is a repository pattern, not new here, and is not fixed here.
- The shard's `failed` list is pinned at the merge (row 7) but not at the shard: a shard that stops
  recording failures still exits 1, because `runGate` clears `allOk`, so CI stays red, but the merge
  would no longer name the fixture. No fast fixture fails on demand, so no test drives it.
- `ran` is recorded inside `runGate`, after the fixture's `run()` returns or throws. A mutant inside
  `runGate` that skips `run()` and still records the name is not caught (row 28, measured green): the
  fixture's status line still reads `— OK`, because its detail text is the harness's own argument,
  not the fixture's output. The unsharded harness has always had the same exposure; it is not new.
  The first two versions of `ran` were weaker: the loop pushed the name whether or not `runGate`
  ran the fixture, so a shard that skipped one fixture (V3) merged green with `225 fixtures each
fired` while 224 had run (PR #250's enforcement re-review).
- The shard's own ran-versus-selected guard: rows 22, 26 and 27 turn its named test red, and the
  merge refuses the same reports, so neither layer stands alone.
- The shard's refusal of duplicate gate names is not tested on its own (removing it leaves every
  test green, measured by the re-review). The partition still reds on a duplicate, because the two
  rows sit at different positions; `gate coverage` reports it on every unsharded run.

## Files Changed

- `scripts/lib/nonvacuity-shards.mjs` — new: `parseShard`, `selectShard`, `digestOf`,
  `duplicateNames`, `mergeShardReports`, `checkNonvacuityJobs`.
- `scripts/lib/nonvacuity-shards.test.mjs` — new: 22 tests (18 at first build, 4 added after review), driving the harness's shard, merge and
  plan modes, and the workflow check.
- `scripts/check-nonvacuity.mjs` — shard, merge and plan modes; `gate coverage` reads the two jobs
  and refuses duplicate names; rule-id coverage reads the merged union in merge mode.
- `.github/workflows/ci.yml` — `concurrency`; the `check:nonvacuity` step leaves `test`; jobs
  `nonvacuity-shard` (matrix of 4, `timeout-minutes: 20`) and `nonvacuity` (merge).
- `package.json` — `check:nonvacuity` also runs the new test file.

## Release

Scripts, CI and the root `package.json` only; no package under `packages/` changes, so no changeset
(`check:release` reads changes under `packages/<name>/`).

## Out of scope

- Splitting `npm run test` (7.4 minutes) or the other steps of `test`.
- Balancing shards by measured duration. The split is by position; the merge prints nothing about
  balance, and the per-fixture durations are in each report for a later decision. In CI the
  imbalance is 1.73 times (Build notes).
- Splitting the `test` job's own steps, which predate this plan, or giving `test` a
  `timeout-minutes`.

**Not exercised.** "Re-run failed jobs" after one failed shard re-runs that shard and the merge,
which then reads the passing shards' artifacts from the earlier attempt (retention one day). Whether
`upload-artifact@v7` and `download-artifact@v8` handle a same-named artifact across attempts was not
tried. If they do not, the merge reds (a missing or duplicated report), so the cost is convenience,
not a false green; a full re-run always works (PR #250's DevOps review, M5).

## Build notes

**Local proof** (2026-10-19, at bf97d8e, the four shards run one after another on the same machine,
then the merge over their real reports):

| shard | fixtures | exit | time  |
| ----- | -------- | ---- | ----- |
| 1/4   | 57       | 0    | 211 s |
| 2/4   | 56       | 0    | 183 s |
| 3/4   | 56       | 0    | 221 s |
| 4/4   | 56       | 0    | 214 s |
| merge | 225      | 0    | 3 s   |

The union of the four reports' `selected` is 225 names, 225 distinct, equal to the unsharded list
(`--plan 1`). The merge printed `shard partition — OK · 225 fixtures across 4 shards`,
`rule-id coverage — OK · all 26 rule ids`, `gate coverage — OK` and `harness self-check — OK`. The
sum, 829 s, is the old serial run; locally the longest shard is 1.2 times the shortest. The slowest single fixtures are 35 s
(`arch/examples-md-no-hand-built-rules`) and 29 s (`arch/no-new-kernel-registry`). CI ran the
serial set 2.45 times slower than this machine (31.9 min against 13), which puts a CI shard at about
9 minutes plus install and build.

**In CI** (run 39209313838 on 504ddfa, pull_request, all green; PR #250's DevOps review): the run took
10m41s wall-clock, against about 43 minutes before. `test` 10m00s; shards 1 to 4 took 582.0 s,
337.4 s, 402.0 s and 459.7 s of fixtures (job times 10m24s, 6m10s, 7m18s, 8m20s); the merge 8 s
(`227 fixtures across 4 shards`, the list as merged with main at that point); `bun-load` 41 s. The
shards are less balanced in CI than locally: the longest is **1.73 times** the shortest (582 s
against 337 s), not 1.2. Shard 1 is the critical path, finishing about 24 s after `test`; a
balanced split (about 445 s each) would make `test` the bottleneck again. The cost is small today
and grows with each slow fixture added near the front of the list. A duration-based split stays out
of scope; the per-fixture durations are in each shard's report, kept for one day.

**A fixture added later.** A dummy row `dummy/added-later`, added as the first fixture of `gates`,
was assigned to shard 1 by `--plan 4` (226 fixtures, 57/57/56/56). The merge over the four reports
made before it reded twice over: `gate coverage` (`gate "dummy/added-later" is in the list but no
check:* claims it`) and `shard partition` (each report `was made from a different fixture list`).
The row was then removed with `git checkout`.

**Decisions.**

- Position modulo N, not a hash of the name: deterministic, and an insertion only shifts which shard
  later rows land in. The merge checks the partition independently of the selector, so neither
  choice is trusted.
- N from `strategy.job-total`, so the matrix's length is the only place N is written. A matrix entry
  above N reds as an out-of-range spec; a missing one reds as a missing report.
- The shards and merge are selected by environment variables, not arguments, because the npm
  script now ends with `node --test …`, and `npm run check:nonvacuity -- <args>` would hand the
  arguments to that, not to the harness.
- The job `test` keeps its name; the repository has no branch protection naming required checks
  (`gh api …/branches/main/protection` answered 404), so renaming would have been safe, but nothing
  required it.
- The merge job skips `npm ci`: the harness's merge mode reads files and spawns Node only.

**Red first.** The 18 tests were written with the code, not before it. An attempt to show them red
against main's harness was abandoned: main's harness ignores the shard variables, so every test ran
the whole serial set. The run was stopped with SIGTERM; the harness finished on its own and
restored every file it had touched (tree clean after, no probe left). The sabotage matrix below is
the red evidence instead: every row turns its named test red on the real harness.

**Sabotage matrix** (2026-10-19, at bf97d8e; each mutant applied to the committed file, the named
test run alone with `--test-name-pattern`, the file restored by `git checkout`, all 18 tests green
after). `H` is `scripts/check-nonvacuity.mjs`, `L` is `scripts/lib/nonvacuity-shards.mjs`.

| row | mutant                                                                                           | named test, red                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | H: the shard's zero-selection guard becomes `if (false)`                                         | a shard that selects no fixture fails                                                                                                         |
| 2   | L: the selector skips position 0                                                                 | the plan puts every fixture in exactly one shard                                                                                              |
| 3   | L: the merge ignores a fixture in no shard                                                       | a fixture that ran in no shard fails the merge                                                                                                |
| 4   | L: the merge ignores a fixture in two shards                                                     | a fixture that ran in two shards fails the merge                                                                                              |
| 5   | L: the merge ignores a missing shard                                                             | a missing shard report fails the merge                                                                                                        |
| 6   | L: the merge ignores a shard reported twice                                                      | a shard reported twice fails the merge                                                                                                        |
| 7   | L: the merge ignores failed fixtures                                                             | a fixture that failed in its shard fails the merge                                                                                            |
| 8   | L: the merge ignores the list digest                                                             | a report made from another fixture list fails the merge                                                                                       |
| 9   | L: the merge accepts an empty directory                                                          | an empty report directory fails the merge                                                                                                     |
| 10  | L: the merge keeps only shard 1's rule ids                                                       | a complete set of shard reports merges green                                                                                                  |
| 11  | H: the merge audits its own, empty rule-id set                                                   | a complete set of shard reports merges green                                                                                                  |
| 12  | H: the merge skips the rule-id audit                                                             | a rule id no shard asserted fails the merge                                                                                                   |
| 13  | H: the merge skips the instruments                                                               | a complete set of shard reports merges green                                                                                                  |
| 14  | L: the workflow check accepts a missing merge job                                                | a workflow without the merge job is refused                                                                                                   |
| 15  | L: the workflow check accepts a merge a failed shard skips                                       | a merge job that a failed shard would skip is refused                                                                                         |
| 16  | L: the workflow check accepts `continue-on-error`                                                | a merge job whose failure need not fail the run is refused                                                                                    |
| 17  | L: the workflow check accepts a merge without `needs:`                                           | a merge job that does not wait for the shards is refused                                                                                      |
| 18  | H: the merge's closing line blames a fixture again (row added after PR #250's review, M4)        | an empty report directory fails the merge                                                                                                     |
| 19  | H: the shard loop runs `selected.slice(0, 0)` (the enforcement reviewer's mutant)                | a shard runs and reports the fixture it selected                                                                                              |
| 20  | L: the merge ignores `ran` against `selected`                                                    | a report whose ran omits a selected fixture fails the merge                                                                                   |
| 21  | L: the merge builds the partition from `selected`                                                | a report whose ran omits a selected fixture fails the merge                                                                                   |
| 22  | H: the loop runs nothing AND the shard's ran-versus-selected guard is gone                       | a shard runs and reports the fixture it selected                                                                                              |
| 23  | L: `duplicateNames` finds nothing                                                                | duplicate fixture names are found                                                                                                             |
| 24  | L: the workflow check accepts a shard job that writes no report                                  | a shard job that writes no report is refused                                                                                                  |
| 25  | `package.json`: `check:nonvacuity` loses `&& node --test scripts/lib/nonvacuity-shards.test.mjs` | `QA_ONLY='gate coverage'`: `gate coverage — FAILED (1 problem(s): the shard tests are not wired) · check:nonvacuity no longer runs …`, exit 1 |
| 26  | H: the loop never calls `runGate` (the re-review's V2, `if (false && !runGate(…))`)              | a shard runs and reports the fixture it selected                                                                                              |
| 27  | H: the loop skips one fixture (the re-review's V3, `name !== 'bun-load/ci-needs' && …`)          | a shard runs and reports the fixture it selected                                                                                              |
| 28  | H: `runGate` skips `run()` but records the name — **survives**, a stated residual                | none: a shard runs and reports the fixture it selected stays green                                                                            |

A first version of row 12 (dropping one id from the union) survived, because its test already
dropped that id; the test was changed to spread the ids across the four shards, so only the union
covers them, and the row was replaced by rows 10 to 12 as above.

**Validate.** Not run in full. Every file this branch touches is covered by a targeted run instead:
the scripts by the four shards and the merge above (each also running the 18 tests), the workflow
by `gate coverage` in the merge, and the plan and board by `check:corpus`, `check:ledger`,
`check:numbers` and `format:check` (see the ledger).

## Progress ledger

- [x] Shard, merge and plan modes in the harness; `scripts/lib/nonvacuity-shards.mjs`
- [x] CI: `concurrency`, `nonvacuity-shard` (matrix of 4), `nonvacuity` (merge)
- [x] 18 tests in `check:nonvacuity`; sabotage matrix, 17 rows, each red on its named test
- [x] Local proof: four shards in series and the merge, union equal to the whole set
- [x] A fixture added later lands in a shard and the stale merge reds
- [x] Targeted gates instead of a full `validate`, done otherwise: see Build notes
- [x] Close: this plan in `completed/`; ROADMAP row
- [x] Review of PR #250 (DevOps): I1 concurrency per commit off PRs; M1 CI balance 1.73×; M2 shard
      timeout; M3 concurrency-slot cost; M4 the merge's closing line; M5 re-run path recorded as
      not exercised
- [x] Review of PR #250 (enforcement): C1 a shard reports what it ran, the merge reads that (rows 19 to 22, and the end-to-end run below); I1 as the DevOps I1; I2 the test link pinned in gate coverage (row 25), residual restated; M2 duplicates tested (row 23); M4 the shard job's report and run step checked (row 24); M1 recorded as a residual
- [x] Enforcement re-review of PR #250: `ran` recorded in `runGate`; the test reads the fixture's own line; V2 and V3 rows 26 and 27, red; the gate coverage status names each class; the runGate-internal residual (row 28) and the duplicate-refusal residual stated

**C1, end to end** (2026-10-19, at 7fd0284): the reviewer's mutant (`for (const name of
selected.slice(0, 0))`) applied, all 225 shards of N=225 run, then the merge over their reports.
Before the fix the reviewer measured every shard exiting 0 and `shard partition — OK`. Now 225 of
225 shards exit 1 (`shard 1/225 — FAILED · selected 1 fixtures but ran 0; not run: arch (root
rules)`), and the merge exits 1 with 225 `selected but not run` and 225 `ran in no shard` findings
and `the merge FAILED`. 7 s for the shards, no fixture run by construction. File restored after.

**The sabotage matrix after both reviews** ran 24 rows through the test file, at 7fd0284 (row 25
through `gate coverage`); every row red, the tree clean after, 22 of 22 tests green.

**After the re-review** (2026-10-19, at 090f602): `ran` moved into `runGate`; the test asserts the
fixture's own `nonvacuity: bun-load/ci-needs — OK (fails on violating input)` line; the `gate
coverage` status names each problem's class (`the shard tests are not wired`, `the nonvacuity CI
jobs`, …) instead of labelling everything that is not CI drift `a check:* is unaccounted for`. The
matrix, 27 rows through the test file: rows 1 to 27 red, row 28 green as stated, tree clean after,
22 of 22 tests green.

- **V2, end to end:** the loop mutated to `if (false && !runGate(…))`, all 225 shards of N=225 run,
  then the merge. The re-review measured 0 of 225 shards failing and `partition — OK`. Now 225 of
  225 shards exit 1 (`shard 1/225 — FAILED · selected 1 fixtures but ran 0; not run: arch (root
rules)`), and the merge exits 1 with 225 `selected but not run` and 225 `ran in no shard`. 8 s.
- **V3, end to end:** the loop mutated to skip `bun-load/ci-needs` only, shard 160/225 (that
  fixture) run for real. The re-review measured exit 0 and a report saying `"ran":["bun-load/ci-needs"]`.
  Now the shard exits 1 (`selected 1 fixtures but ran 0; not run: bun-load/ci-needs`) and its report
  says `selected: [bun-load/ci-needs], ran: [], failed: []`, which the merge refuses (row 20's test).
  The neighbouring shard 161/225 under the same mutant exits 0, as it should.
