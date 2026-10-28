# Bug 0452: the CI workflow checks do not read the workflow's triggers

## Status

- **State:** Draft — recorded 2026-10-17 from PR #232's devops review. Read from the source.
- **Severity:** Low — no trigger filter exists today; this is a check that cannot see one being
  added.
- **Origin:** self-found · PR #232's review, 2026-10-17.
- **Reported:** 2026-10-17

## Symptom

`gateCoverage` checks that `ci.yml` runs every `validate` step, and `checkBunLoadJob`
(`scripts/check-bun-load.mjs`) that the `bun-load` job always runs and blocks. Neither reads the
workflow's `on:` block (`.github/workflows/ci.yml:3`). A `paths-ignore:` or `branches-ignore:` added
there would skip every job, the Bun guard included, on the changes it names, and both checks would
stay green. [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md) rule 3 asks that "a static read of the CI workflow shows that the jobs always run".

## Fix

Read the triggers too: `push` on the default branch and `pull_request` with no path or branch filter
(the workflow's own comment explains why it has no `branches:` filter), each a finding when changed.

## Verification

- [ ] Red first: a `paths-ignore:` under `pull_request` reds no check today

Deferred: none
