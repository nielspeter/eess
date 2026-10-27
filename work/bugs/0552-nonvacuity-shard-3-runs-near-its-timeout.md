# Bug 0552: nonvacuity shard 3 runs near its 20-minute timeout

## Status

- **State:** Draft — found 2026-10-27 reading the CI shard times of PR #268; measured from CI's own
  job and step times, no fix chosen.
- **Severity:** Medium — nothing passes that should not: a shard that times out is red. But it reds
  a PR for a reason the PR did not cause, and the next few rows added to shard 3 make that likely.
- **Origin:** self-found, 2026-10-27, while building
  [plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md)'s Phase 1. Recorded
  rather than fixed there: it is CI capacity, not that plan's work.
- **Reported:** 2026-10-27

## Symptom

`check:nonvacuity` runs as four shards in CI ([plan 0509](../plans/completed/0509-shard-check-nonvacuity-in-ci.md)),
each with `timeout-minutes: 20` (`.github/workflows/ci.yml:127`). Shard 3 now takes far longer than
the other three, and close to that limit. The `npm run check:nonvacuity` step's time, per shard:

| run (PR)                  | shard 1 | shard 2 | shard 3    | shard 4 |
| ------------------------- | ------- | ------- | ---------- | ------- |
| 40575108272 (#268)        | 9m37s   | 8m53s   | **17m01s** | 11m32s  |
| 40524730583 (#267), rerun | —       | —       | **14m46s** | —       |

On #268 shard 3 held 64 fixtures, as each shard did, so the gap is cost, not count. The workflow's
comment still says "About 10.5 min in CI at the slowest shard" (`.github/workflows/ci.yml:125`).

#267's first attempt did time out on shard 3, but for another reason: `actions/setup-node` took 10
minutes there and 3 seconds on shard 1, a runner flake. Its rerun is the row above.

## Cause

`selectShard` assigns fixture `k` to shard `k mod N` by its position in the harness's list
(`scripts/lib/nonvacuity-shards.mjs:52`). A fixture's cost does not enter, and the slow rows (each
runs `check:corpus` or a clone several times) are not spread evenly. Measured on shard 3 of #267's
first attempt, from the log's timestamps: the slowest gaps were `arch/no-new-kernel-registry` 69 s,
`corpus/record-mention/production-base` 65 s and `corpus/record-mention/raised-from-zero` 43 s.
[Plan 0542](../plans/0542-this-repositorys-record-mentions-are-migrated.md) Phase 1 added `corpus/record-mention/ts-archunit-skipped` to shard 3 (about a minute).

## Fix

Not chosen. A performance design, so a time-boxed spike comes first and brings a design back. Its
question: which assignment keeps every shard well under the limit as rows are added? The candidates
to measure:

- by recorded cost (each shard's report already lists what it ran; the times would need to be kept);
- a fifth shard;
- a raised timeout, which only moves the limit.

## Verification

- [ ] A spike measures each fixture's CI cost and brings an assignment back for a decision.
- [ ] The chosen fix keeps every shard's nonvacuity step under an agreed share of its timeout, and
      the workflow's comment states the measured slowest time.
