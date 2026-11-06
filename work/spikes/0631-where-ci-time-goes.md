# Spike 0631: where CI time goes

Measured 2026-11-06, at the maintainer's request ("we need to look into not wasting ci time in our
process"). This is a measurement, time-boxed to about an hour; it brings options back for a decision.
Source: the GitHub API, for the last 200 runs of `.github/workflows/ci.yml` (2026-10-21 to
2026-11-06). Runner minutes are the sum of each job's own start-to-end time. A PR's change kind comes
from its file list.

## The question

How much runner time does CI spend, and on what? Which of it repeats a check that has already
answered, and which can be cut without letting a defect through?

## 1. What one run costs

`ci.yml` runs on `pull_request` and on `push` to `main`. One run is six jobs:

- `test`, which is `npm run validate` without nonvacuity;
- four `nonvacuity-shard` jobs;
- the `nonvacuity` merge;
- `bun-load`.

Runner minutes:

| job                   | runner minutes (200 runs) | share |
| --------------------- | ------------------------: | ----: |
| `nonvacuity-shard` ×4 |                     8,257 |   78% |
| `test`                |                     1,842 |   17% |
| `bun-load`            |                       192 |    2% |
| `nonvacuity` (merge)  |                        33 |    0% |
| **total**             |                **10,557** |       |

That is 53 runner minutes per run, and about 660 a day. The repository is public, so the minutes cost
no money. The costs are runner slots, queue time and the maintainer's wall-clock time: one run holds
six runners at once.

## 2. Where it goes

| trigger and outcome               | runs | runner minutes | share |
| --------------------------------- | ---: | -------------: | ----: |
| push to `main`, success           |   64 |          3,785 | 35.8% |
| PR, success, code changed         |   58 |          3,435 | 32.5% |
| PR, success, `work/` only         |   28 |          1,621 | 15.4% |
| PR, cancelled (superseded commit) |   37 |          1,001 |  9.5% |
| PR, failure                       |    8 |            452 |  4.3% |
| PR, success, other records and md |    5 |            264 |  2.5% |

Other measurements:

- **Main pushes:** they never failed, 0 of 64.
- **Pushes per PR:** 63 PR branches averaged 2.2 runs each, up to 9. Twenty-one branches passed more
  than once, which is 28 extra successful runs, about 1,500 runner minutes.
- **Cancelled runs** are pushes made while a run was in progress; [plan 0509](../plans/completed/0509-shard-check-nonvacuity-in-ci.md)'s concurrency group
  cancelled the older run.
- **The 8 failures:**
  - three PRs that touched only `work/` failed real nonvacuity rows (shard 1, the fixture
    [bug 0597](../bugs/fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)
    fixed);
  - four failed `test`;
  - one failed the nonvacuity merge.

## 3. Findings

1. **The push-to-`main` run repeats a PR's run.** It is 36% of all minutes and caught nothing in 64
   runs. It is not redundant by construction: `main` has no branch protection and no ruleset (both
   API calls return none). So a PR can merge behind `main`, and then the push run is the only check of
   the tree that landed. It has stayed green because merges here are sequential and rebased.
2. **Nonvacuity is the cost of every run.** It is 78%. Four shards of about 14 minutes each, against
   about 12 for `test`. [Bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) already
   records the slowest shard running near its 20-minute timeout.
3. **A PR that touches only `work/` cannot skip nonvacuity.** All three of its measured failures were
   real nonvacuity failures, rows that read the live corpus. A path filter would have shipped them.
4. **Process waste is about 24%.** That is 9.5% cancelled and about 14% extra successful runs on a
   branch that passed once already: a push per fix rather than per review round.
5. **Local duplication, not in these numbers.** This session ran the full local `validate` (38 minutes)
   before each push, the same chain CI runs, twice on a state a review then changed. The CI numbers
   above do not include it.

## 4. Options

| #   | option                                                                                                                                                            | saves                                  | risk                                                                                                                       | needs                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A1  | Push only once a review round is done; never push a fix alone mid-review                                                                                          | about 10–20%, cancelled and extra runs | none                                                                                                                       | a working-method change, no code                                                        |
| A2  | No full local `validate`: run the change's own checks plus typecheck, lint, format and guardrails, and let CI be the gate                                         | local only                             | a fast gate missed locally costs one CI cycle                                                                              | done 2026-11-06, in the working method                                                  |
| B1  | A ruleset on `main` requiring the PR's CI and an up-to-date branch, then drop `push: main` from `ci.yml`                                                          | about 36%                              | a direct push to `main`, or a ruleset bypass, lands untested; a PR behind `main` must be updated and re-run before merging | a repository setting (maintainer) and a `ci.yml` change                                 |
| B2  | Keep `push: main` but run only `test`, no shards                                                                                                                  | about 29%                              | the combined tree's nonvacuity is unchecked after a merge behind `main`                                                    | a `ci.yml` change                                                                       |
| C   | Make nonvacuity cheaper: profile the slowest rows (many start `eess-ts check arch.rules.ts`, about 16 s each), share one run between rows that read the same gate | unknown until profiled                 | a row that shares a run must still prove its own rule fires                                                                | a plan building on [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) |
| D   | Run only the nonvacuity rows a change can affect (a records-only PR runs the corpus rows)                                                                         | up to about 15% more                   | a row's inputs must be declared, or a skipped row hides a failure (finding 3)                                              | a design, after C                                                                       |

## 5. Recommendation

- **A1 and A2 now.** They are working-method changes, free and without risk.
- **B1** cuts the largest repeat. It changes the repository's settings and accepts a stated risk,
  so it is the maintainer's decision.
- **C as a plan.** Nonvacuity is the bulk of every run, and [bug 0552](../bugs/0552-nonvacuity-shard-3-runs-near-its-timeout.md) already measures its growth.
- **D only after C,** because finding 3 shows a naive filter is unsafe.

## Corrections

None yet.
