# Bug 0599: nothing local proves the nonvacuity merge job loads without `node_modules`

## Status

- **State:** Draft — found 2026-11-01 by a devops review of
  [bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)'s CI
  fix; no red test yet.
- **Severity:** Low — fail-closed: CI goes red, never green. The cost is feedback. The defect shows
  up only in CI, after a 34-minute local `npm run validate` has passed.
- **Origin:** self-found · devops review of PR #293's second commit, 2026-11-01.
- **Reported:** 2026-11-01

## Symptom

CI's `nonvacuity` merge job (`.github/workflows/ci.yml:161`) runs `scripts/check-nonvacuity.mjs`
with Node builtins only: checkout, setup-node, download-artifact, with no `npm ci`. So every
top-level import of the script, direct or transitive, must be a builtin or a relative module that
imports only builtins. Nothing local checks this, because every local run has `node_modules`.
[Bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)'s first
push added a top-level import that reached `@nielspeter/eess-md`. The local validate passed (exit 0),
and the merge job failed with `ERR_MODULE_NOT_FOUND`.

The script's header invites the mistake. `scripts/check-nonvacuity.mjs:223` says it "Uses only node
builtins + the workspace packages", which reads as permission to import a workspace package at the
top. The constraint is written down at `scripts/lib/nonvacuity-shards.mjs:21` (for that file) and in
the comment above the merge job in `ci.yml`, but not where the imports are.

## Reproduction

Measured 2026-11-01: copy `scripts/` to a temporary directory with no `node_modules` and run the
merge mode (`EESS_NONVACUITY_MERGE=<dir>`). PR #293's first commit (05b1ed04) throws
`ERR_MODULE_NOT_FOUND`. Its second commit (e14d3a89), which loads the readers inside the row, loads.

## Fix

Not designed. Two directions, from the review:

- a `node --test` case beside `scripts/lib/nonvacuity-shards.test.mjs` that runs the merge mode from
  a copy of `scripts/` with no `node_modules`; or
- a static walk of the script's top-level import graph that allows only `node:` specifiers and
  relative modules that obey the same rule.

Either one makes the next instance red locally. The header line at
`scripts/check-nonvacuity.mjs:223` is reworded in the same change, so the rule is stated where the
imports are: top level is builtins only, and a workspace module loads inside a fixture row or in a
`scripts/nonvacuity/` helper.

## Verification

- [ ] Red first: the guard fails on a top-level import that reaches a workspace package (05b1ed04's
      shape).
- [ ] The guard passes on the current script.
- [ ] The header states the builtins-only rule.
- [ ] `npm run validate` green.

Deferred: none
