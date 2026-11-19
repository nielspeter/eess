# Bug 0656: nonvacuity runs clean passes that decide nothing

## Status

- **State:** Fixed — the eight passes are removed; the rows' verdicts are unchanged.
- **Severity:** Low — no false green and no false red; only CI time. Measured locally on
  2026-11-19: the eight passes cost about 31 s per full `check:nonvacuity` run
  (`arch.internal.rules.ts` 16 s, `arch.rules.ts` 3.4 s twice, `family.rules.ts` 1.6 s four times,
  `check-baseline.mjs` 2 s), so roughly 50 s of runner time on CI's slower runners, about 12 s per
  shard. A prior estimate of "several minutes" read the arch rows' whole time (112 s for three rows
  in shard 2 of PR #339's run), which is mostly the sabotaged run that stays.
- **Origin:** self-found · reading `scripts/check-nonvacuity.mjs` while looking for CI time,
  2026-11-19.
- **Reported:** 2026-11-19

## Symptom

Eight rows ran their gate a second time on the clean tree after the sabotaged run, and reported the
result as a note: `gateArch`, the `arch/md-one-link-resolver` row, the `eess/no-silent-catch` row,
four `family/re-export-complete` rows and the `baseline` row. None of them let the clean result enter
`ok`: the baseline row said so on purpose
([bug 0129](./0129-four-validate-gates-run-in-no-workflow.md)), and the arch
row called it "a bonus proof … (informational)". The clean tree is already gated: CI's `test` job runs
`check:arch` (both rule files), `check:family` and `check:baseline`, and the ruleset requires that
job green to merge.

## Fix

The eight clean passes and their notes are removed. Each row's `ok` is what it was. The baseline
row's comment says where the clean direction is gated now.

## Verification

- [x] `node --check`, prettier and `scripts/lib/nonvacuity-shards.test.mjs` (22 tests) pass; the row
      list and so the shard assignment are unchanged.
- [x] No local nonvacuity run: the harness has no row filter, and the full run is CI's four shards,
      which must pass for this to merge.
