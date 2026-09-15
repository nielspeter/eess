# Bug 0313: the cardinality scan reads the probe test files another test writes mid-run

## Status

- **State:** Fixed — the scan skips `tests/__generated__`, and reads every other test file as
  before. The race was observed twice; the fix is shown by a test on a throwaway tree, which cannot
  race. Red test first.
- **Severity:** Medium — a full `packages/ts` run can fail two tests with no change to explain them.
  Anyone reading a suite's exit code is misled, and a sabotage matrix over the full suite scores such
  a row caught, the reassuring direction.
- **Origin:** the first full run of
  [0306](./0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix on
  2026-09-14, recorded there as unexplained; #137's method review asked for a home, and the cause was
  traced then.
- **Reported:** 2026-09-14 · **Fixed:** 2026-09-15

## Symptom

In the 0306 worktree, one full `vitest run` of `packages/ts` failed both scan tests in
`packages/ts/tests/tools/scan-cardinality-assertions.test.ts` —
`it('VACUITY: the scan actually read the suite')` and
`it('no new FILE contributes a count-only block')` — beside two failures the fix expected. The file
passed when run alone within a minute with no test file changed, and the next full run passed. The
assertion messages were not captured.

On 2026-09-15 the race struck again, in the `npm run validate` of
[0309](./0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md)'s fix at
`aff1c47`, and this time the messages were kept. VACUITY failed with
`expected 105 to be less than or equal to 103`, and "no new FILE" named
`tests/__generated__/run-3709/passing.test.ts` and `tests/__generated__/run-3709/stale-exclusion.test.ts`
— probe files `warn-survives-the-test-runner.test.ts` writes. The scan passed when run alone
straight after.

## Root cause

`scanCardinalityAssertions` read every `.test.ts` under `packages/ts/tests`, recursively, when its
describe block was collected (`testFiles` in `packages/ts/tests/tools/scan-cardinality-assertions.ts`).
`packages/ts/tests/core/warn-survives-the-test-runner.test.ts` writes probe test files into
`tests/__generated__/run-<pid>/` while it runs, and two of its probes are count-only blocks —
`toHaveLength(4)` and nothing else. A scan collected while they existed saw a file the list had never
seen, which failed "no new FILE", and a population two larger against `CEILING = 103`. VACUITY failed
as well because the population has no headroom: at `4c7ae9e` it is 103, exactly the ceiling, over 49
contributing files and 3602 blocks (`scanCardinalityAssertions` over a `git archive` copy of
`packages/ts/tests`, measured by #137's second method review), so the two probes make 105. The
population on the day of the first failure was not measured; on 2026-09-15 the failure itself printed 105.

`tests/__generated__` is gitignored and excluded from `tsconfig.json` because other readers of the
tree tripped on these probes; the scan did not skip it.

## Fix

`testFiles` (`packages/ts/tests/tools/scan-cardinality-assertions.ts`) skips `<dir>/__generated__`,
the one directory the repo gitignores for these probes — not every directory of that name, since one
deeper down is committed code, and not dot-directories, where the scan's own test plants the probes
it reads. The KNOWN-GAP test is inverted.

Reading every other recursive walk under `packages/ts/tests` for the same exposure found two, in
`cross-document-links-resolve.test.ts` and `every-config-finding-is-classified.test.ts`, with a narrower
window. They are [0318](../0318-two-test-walks-read-the-probe-files-other-tests-write-mid-run.md),
because a fix for them needs a shared walker to have a red test first.

## Verification

- [x] Red test first —
      `packages/ts/tests/tools/the-cardinality-scan-skips-generated-probes.test.ts`, the KNOWN-GAP test
      inverted and widened, run before the fix: the scan returned six files where four belong, the two
      under `tests/__generated__` among them.
- [x] The fix turns it green —
      `it('the scan skips tests/__generated__ and reads every other test file')`, with the scan's own
      `it('VACUITY: the scan actually read the suite')`,
      `it('no new FILE contributes a count-only block')` and
      `it('the two signals that were added after a hand-read sample still fire')` still green.
- [x] Sabotage matrix in the 0313 worktree (per-entry `node_modules`, the one edited file restored by
      sha256 after every row, verdicts read by test title over the new test and
      `scan-cardinality-assertions.test.ts`): **5 rows, 0 mismatches**. Baseline green. Reading
      `tests/__generated__` again reds the new test only; skipping every directory named
      `__generated__` reds it too; skipping dot-directories also reds the scan's two-signals test;
      walking no directory at all also reds VACUITY. That the race is gone from a real full run is not
      shown by any test — a race cannot be forced — and the change removes the only path by which a
      probe reached the scan.
- [x] `npm run validate` green.
- [ ] deferred→[0318](../0318-two-test-walks-read-the-probe-files-other-tests-write-mid-run.md) — two
      other walks of `tests/` read `tests/__generated__` too, found while fixing this.

Deferred: [0318](../0318-two-test-walks-read-the-probe-files-other-tests-write-mid-run.md).
