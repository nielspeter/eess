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
(`EESS_NONVACUITY_REPORT`): its index, `N`, a digest of the whole fixture list, the names it ran,
the names that did not fire, the rule ids its fixtures asserted on, and per-fixture durations. A
shard reds on any fixture that does not fire, on a malformed spec, and on selecting zero fixtures.

**Merge.** A second job, `nonvacuity`, waits for every shard (`needs:`), runs when a shard failed too
(`if: ${{ !cancelled() }}`), downloads the reports and runs the harness with
`EESS_NONVACUITY_MERGE=<dir>`. It does not trust the selector. It is the one place that checks:

- every fixture of this checkout's list ran in exactly one shard (none missing, none twice, no name
  the list does not have);
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

**Concurrency.** The workflow gains `concurrency: { group: ci-${{ github.workflow }}-${{ github.ref }},
cancel-in-progress: ${{ github.event_name == 'pull_request' }} }`: a PR run on a superseded commit is
cancelled, and a run on `main` never is.

**N = 4.** Chosen from the measured numbers: 31.9 minutes over four shards is about 8 minutes of
fixtures each, plus about 1.5 minutes of install and build per shard. See the Build notes for the
per-shard local durations.

## How this gate could fail open, and what reds

| What goes wrong                                                                                   | What reds                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| a shard selects no fixture (N too large, a selector bug)                                          | the shard itself: `selected 0 of T fixtures`, exit 1                                             |
| a malformed or out-of-range shard spec                                                            | the shard: `is not of the form i/N` / `shard 5 of only 4`, exit 1, never "run everything"        |
| the selector drops a fixture from every shard                                                     | the merge: `fixture "<name>" ran in no shard`                                                    |
| the selector runs a fixture twice                                                                 | the merge: `ran in shards a, b`                                                                  |
| a shard job is dropped from the matrix, or crashes before its report                              | the merge: `shard k of N sent no report` (the upload step also fails on a missing file)          |
| a shard's fixture does not fire                                                                   | the shard (exit 1) and the merge, by name                                                        |
| reports from another fixture list (a stale artifact, a changed list)                              | the merge: `made from a different fixture list`                                                  |
| no report at all                                                                                  | the merge: `no shard report found`                                                               |
| a corpus rule id that no shard's fixture asserts                                                  | the merge's `rule-id coverage`, over the union                                                   |
| the instruments stop running                                                                      | `gate coverage`'s and `harness self-check`'s lines run only in the merge; a test pins them there |
| two gate rows share a name, so "exactly one shard" is unanswerable                                | `gate coverage` (unsharded), the shard and the merge                                             |
| the merge job is deleted, stops waiting, is skipped on a failed shard, or set `continue-on-error` | `gate coverage` reads `ci.yml` (`checkNonvacuityJobs`) and reds                                  |

Residual: `gate coverage` reads `ci.yml` by line pattern, as `checkBunLoadJob` does (plan 0448); a
YAML shape it does not recognise reds rather than passes, but a semantically equivalent rewrite
could red too. The one call that wires it into `gateCoverage` is not pinned: deleting it leaves
every test green, as deleting `checkBunLoadJob`'s call would.

## Files Changed

- `scripts/lib/nonvacuity-shards.mjs` — new: `parseShard`, `selectShard`, `digestOf`,
  `duplicateNames`, `mergeShardReports`, `checkNonvacuityJobs`.
- `scripts/lib/nonvacuity-shards.test.mjs` — new: 18 tests, driving the harness's shard, merge and
  plan modes, and the workflow check.
- `scripts/check-nonvacuity.mjs` — shard, merge and plan modes; `gate coverage` reads the two jobs
  and refuses duplicate names; rule-id coverage reads the merged union in merge mode.
- `.github/workflows/ci.yml` — `concurrency`; the `check:nonvacuity` step leaves `test`; jobs
  `nonvacuity-shard` (matrix of 4) and `nonvacuity` (merge).
- `package.json` — `check:nonvacuity` also runs the new test file.

## Release

Scripts, CI and the root `package.json` only; no package under `packages/` changes, so no changeset
(`check:release` reads changes under `packages/<name>/`).

## Out of scope

- Splitting `npm run test` (7.4 minutes) or the other steps of `test`.
- Balancing shards by measured duration. The split is by position; the merge prints nothing about
  balance, and the per-fixture durations are in each report for a later decision.

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
sum, 829 s, is the old serial run; the longest shard is 1.2 times the shortest, so the positional
split balances well enough without durations. The slowest single fixtures are 35 s
(`arch/examples-md-no-hand-built-rules`) and 29 s (`arch/no-new-kernel-registry`). CI ran the
serial set 2.45 times slower than this machine (31.9 min against 13), which puts a CI shard at about
9 minutes plus install and build. The CI timing is the coordinator's to read on the PR.

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

| row | mutant                                                     | named test, red                                            |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | H: the shard's zero-selection guard becomes `if (false)`   | a shard that selects no fixture fails                      |
| 2   | L: the selector skips position 0                           | the plan puts every fixture in exactly one shard           |
| 3   | L: the merge ignores a fixture in no shard                 | a fixture that ran in no shard fails the merge             |
| 4   | L: the merge ignores a fixture in two shards               | a fixture that ran in two shards fails the merge           |
| 5   | L: the merge ignores a missing shard                       | a missing shard report fails the merge                     |
| 6   | L: the merge ignores a shard reported twice                | a shard reported twice fails the merge                     |
| 7   | L: the merge ignores failed fixtures                       | a fixture that failed in its shard fails the merge         |
| 8   | L: the merge ignores the list digest                       | a report made from another fixture list fails the merge    |
| 9   | L: the merge accepts an empty directory                    | an empty report directory fails the merge                  |
| 10  | L: the merge keeps only shard 1's rule ids                 | a complete set of shard reports merges green               |
| 11  | H: the merge audits its own, empty rule-id set             | a complete set of shard reports merges green               |
| 12  | H: the merge skips the rule-id audit                       | a rule id no shard asserted fails the merge                |
| 13  | H: the merge skips the instruments                         | a complete set of shard reports merges green               |
| 14  | L: the workflow check accepts a missing merge job          | a workflow without the merge job is refused                |
| 15  | L: the workflow check accepts a merge a failed shard skips | a merge job that a failed shard would skip is refused      |
| 16  | L: the workflow check accepts `continue-on-error`          | a merge job whose failure need not fail the run is refused |
| 17  | L: the workflow check accepts a merge without `needs:`     | a merge job that does not wait for the shards is refused   |

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
