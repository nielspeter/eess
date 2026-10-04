# Bug 0378: CI jobs have no timeout, so a test that hangs holds a runner for six hours

## Status

- **State:** Draft — confirmed against the workflows; no change made.
- **Severity:** Medium — **a failure that arrives six hours late.** Not a false green: a
  hung job never reports success. But the signal comes at GitHub's 360-minute default, holds a
  runner the whole time, and blocks every PR queued behind it.
- **Origin:** testing review of
  [bug 0374](./fixed/0374-eess-mermaid-extend-reads-one-edge.md), whose record claimed "CI's
  job timeout still reds it" for a sabotage row that hangs. No timeout is set, so the claim
  was corrected and this filed.
- **Reported:** 2026-10-04

## Symptom

`grep -rn timeout .github/workflows/` returns nothing. `.github/workflows/ci.yml`'s `test` job
and `publish.yml` run under GitHub's default `timeout-minutes: 360`.

Synchronous walks are the known way to hang: the heritage walks in `eess-ts` and
`eess-mermaid` (ADR-017 C5) have no bound by design, since a bound would be an ADR-016
instrument that can run out. If a guard on one of them regressed, vitest's per-test timeout
could not interrupt the loop. Measured for `eess-mermaid`: removing its visited guard makes a
cycle test run until killed (60 s in the sabotage matrix, killed by process group). The
`eess-ts` class walk crashes its worker in about 26 s instead, measured by the 0295 review.

## Fix

Not decided: a `timeout-minutes` on each job, set from the measured duration of a green run
(validate takes about 8–11 minutes locally) with headroom, per ADR-016 clause 5. Measure CI's
own duration first.

## Verification

- [ ] CI's green-run duration measured
- [ ] `timeout-minutes` set on every job, from that measurement
- [ ] `npm run validate` green.

Deferred: none.
