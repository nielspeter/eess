# Bug 0451: nothing proves `gateCoverage` runs its own checks

## Status

- **State:** Draft — recorded 2026-10-17 from PR #232's review (enforcement and method). Not
  reproduced by a run; read from the source.
- **Severity:** Medium — the checks it would hide are themselves guards against a fail-open, so their
  silent removal is a fail-open one level up (ADR-009).
- **Origin:** self-found · PR #232's review, 2026-10-17.
- **Reported:** 2026-10-17

## Symptom

`gateCoverage()` in `scripts/check-nonvacuity.mjs` carries several checks that no fixture drives
through `gateCoverage` itself: the comparison of `ci.yml` with `validate` (the loop over `ci.matchAll` in `gateCoverage()`, `scripts/check-nonvacuity.mjs`), and, since plan 0448, the read of the `bun-load` job (the `checkBunLoadJob(ci)` call) and the pin of the guard's self-test break ids (`BUN_BREAK_IDS`). Named by statement, not line: the file moved by about a hundred lines within the PR that recorded this. The `bad-bun-load.mjs`
rows import `checkBunLoadJob` directly, so they prove the function goes red, not that `gateCoverage`
calls it. Deleting the call, or the pinned-id loop, turns nothing red. ADR-020's R2 row says these
edits "red `gateCoverage`"; that holds only while the call is there.

## Fix

A fixture that runs `gateCoverage` (or the harness's coverage step) over a sabotaged copy of
`ci.yml` and of the self-test table, and requires its finding; or `gateCoverage`'s sub-checks
registered by name in one table its own self-check counts.

## Verification

- [ ] Red first: delete the `checkBunLoadJob(ci)` call, and no gate reds today

Deferred: none
