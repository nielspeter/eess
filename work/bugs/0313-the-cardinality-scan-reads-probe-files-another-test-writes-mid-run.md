# Bug 0313: the cardinality scan reads the probe test files another test writes mid-run

## Status

- **State:** Draft — the mechanism reproduced by a KNOWN-GAP test; the race itself observed once.
- **Severity:** Medium — a full `packages/ts` run can fail two tests with no change to explain them.
  Anyone reading a suite's exit code is misled, and a sabotage matrix over the full suite scores such
  a row caught, the reassuring direction.
- **Origin:** the first full run of
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix on
  2026-09-14, recorded there as unexplained; #137's method review asked for a home, and the cause was
  traced then.
- **Reported:** 2026-09-14

## Symptom

In the 0306 worktree, one full `vitest run` of `packages/ts` failed both scan tests in
`packages/ts/tests/tools/scan-cardinality-assertions.test.ts` —
`it('VACUITY: the scan actually read the suite')` and
`it('no new FILE contributes a count-only block')` — beside two failures the fix expected. The file
passed alone twenty seconds later with no test file changed, and the next full run passed. The
assertion messages were not captured.

## Root cause

`scanCardinalityAssertions` reads every `.test.ts` under `packages/ts/tests`, recursively, when its
describe block is collected (`testFiles` in `packages/ts/tests/tools/scan-cardinality-assertions.ts`).
`packages/ts/tests/core/warn-survives-the-test-runner.test.ts` writes probe test files into
`tests/__generated__/run-<pid>/` while it runs, and two of its probes are count-only blocks —
`toHaveLength(4)` and nothing else. A scan collected while they exist sees a file the list has never
seen, which fails "no new FILE", and a population two larger against `CEILING = 103`. That VACUITY
failed as well fits a population within two of the ceiling; the population that day was not
measured.

`tests/__generated__` is gitignored and excluded from `tsconfig.json` because other readers of the
tree tripped on these probes; the scan does not skip it.

## Fix

Skip `__generated__` in `testFiles`, and invert the KNOWN-GAP test.

## Verification

- [x] KNOWN-GAP test pins the mechanism —
      `packages/ts/tests/tools/the-cardinality-scan-reads-generated-probes.test.ts` ·
      `it('KNOWN GAP — a count-only probe under tests/__generated__ joins the scanned population')`,
      where a count-only file outside `__generated__` is the control in the same list.
- [ ] the fix, the KNOWN-GAP test inverted
- [ ] `npm run validate` green.

Deferred: none.
