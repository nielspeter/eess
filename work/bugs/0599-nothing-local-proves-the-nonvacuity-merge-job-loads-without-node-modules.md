# Bug 0599: nothing local proves the nonvacuity merge job loads without `node_modules`

## Status

- **State:** Draft — found 2026-11-01 by a devops review of
  [bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)'s CI
  fix; no red test yet.
- **Severity:** Low — internal dev-loop feedback; no gate verdict is affected. It fails closed: a
  missing module exits non-zero, so CI goes red, never green. The cost is that the defect shows up
  only in CI, after a full local `npm run validate` has passed.
- **Origin:** self-found · devops review of PR #293's second commit, 2026-11-01 (its Minors 1
  and 2). The review offered the header rewording for #293; it was moved here instead, so the
  rewording lands with the guard that enforces it.
- **Reported:** 2026-11-01

## Symptom

CI's `nonvacuity` merge job (`.github/workflows/ci.yml:161`) is checkout, setup-node and
download-artifact, with no `npm ci`, then `npm run check:nonvacuity` (`ci.yml:176`). That npm script
has two entry points (`package.json:45`): `node scripts/check-nonvacuity.mjs`, then
`node --test scripts/lib/nonvacuity-shards.test.mjs`. So every top-level import of both, direct or
transitive, must be a builtin or a relative module that obeys the same rule. Nothing local checks
this, because every local run has `node_modules`. Today both entry points comply: the test file
imports only `node:` modules and `./nonvacuity-shards.mjs`.

[Bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)'s first
push added two top-level imports to `scripts/check-nonvacuity.mjs`:

```js
import { proseText } from '@nielspeter/eess-md/internal'
import { isAccepted, operativeRuling } from './lib/proposal-ruling.mjs' // imports eess-md too
```

Local checks passed on that branch, and the merge job failed with `ERR_MODULE_NOT_FOUND`.

The script's header invites the mistake. `scripts/check-nonvacuity.mjs:223` says it "Uses only node
builtins + the workspace packages", which reads as permission to import a workspace package at the
top. The rule is written down elsewhere: at `scripts/lib/nonvacuity-shards.mjs:21` (for that file),
in the comment above the merge job (`ci.yml:157`), and at the lazy loads that fixed
[bug 0597](./fixed/0597-the-accepted-denominator-fixture-assumes-one-accepted-proposal.md)
(`scripts/check-nonvacuity.mjs:3789`). It is missing from the header, above the top-level imports.

## Reproduction

Measured 2026-11-01 on `main` at d9a5d6aa, in well under a second. Copy `scripts/` into an empty
directory, so no `node_modules` is reachable, and add an empty `reports/` beside it:

```bash
mkdir reports && cp -r <repo>/scripts . && EESS_NONVACUITY_MERGE=reports node scripts/check-nonvacuity.mjs
```

- As committed, it loads and exits 1 with `nonvacuity: the merge FAILED`, because rule-id coverage
  finds no shard reports. That red is expected with an empty `reports/`, and it is not this bug.
- With one line added after the shebang, `import '@nielspeter/eess-md/internal'`, it exits 1 with
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@nielspeter/eess-md'`, CI's error.

## Fix

Not designed. Two directions, from the review:

- a `node --test` case beside `scripts/lib/nonvacuity-shards.test.mjs` that runs the merge mode from
  a copy of `scripts/` with no `node_modules`; or
- a static walk of the script's top-level import graph that allows only `node:` specifiers and
  relative modules that obey the same rule.

Either one makes the next instance red locally. Whichever is built covers every entry point that
`check:nonvacuity` runs, read from `package.json` rather than listed by hand. Where it runs is the
design's call: inside `nonvacuity-shards.test.mjs` it reports only after the full harness passes
(the two are joined by `&&`), and a home in `check:integrity` or `check:fast` would answer in
seconds. The header line at
`scripts/check-nonvacuity.mjs:223` is reworded in the same change, so the rule is stated where the
imports are: top level is builtins only, and a workspace module loads inside a fixture row or in a
`scripts/nonvacuity/` helper.

## Verification

- [ ] Red first: the guard fails on a top-level import that reaches a workspace package (the shape
      quoted under Symptom).
- [ ] The guard passes on the current scripts.
- [ ] The guard covers every entry point `check:nonvacuity` runs, derived from `package.json`.
- [ ] The header states the builtins-only rule.
- [ ] `npm run validate` green.

Deferred: none
