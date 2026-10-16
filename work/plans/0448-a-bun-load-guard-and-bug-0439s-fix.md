# Plan 0448: a Bun load guard, and bug 0439's fix

## Status

- **State:** Draft — written 2026-10-17 at the maintainer's request ("do the 0439 first"), under
  [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md) rule 2.
- **Priority:** High, above bug 0439's Medium severity because an adopter's upgrade is blocked on
  it: from eess 0.5.1 on, 22 of the family's 28 published entries fail to load under Bun.
- **Effort:** Small — one import, one script with a self-test, one CI job; no new package dependency.
- **Created:** 2026-10-17
- **Fixes:** [bug 0439](../bugs/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md).

## Problem

Bug 0439: `packages/core/src/cli-config.ts:3` imports `registerHooks` by name from `node:module`.
Bun's `node:module` has no such export, so under Bun every entry that links `cli-config.js` through
`@nielspeter/eess/internal` fails at link time: 22 of the family's 28 published entries (spike 0438).
Nothing in CI imports a published entry under Bun, and a green suite on Bun does not prove the
package loads there (spike 0438), so the defect shipped and nothing would keep a fix fixed.

ADR-020 rule 2 allows a load guard under Bun with no claim, and its Enforcement row for that rule is
`pending` on "the guard's CI job, built by the plan". This is that plan.

## Design

Reviewed as a Draft on 2026-10-17 (enforcement · devops · method); every finding below is folded in.
All three found the same critical hole in the first draft: the check that the CI job always runs
lived inside that job, so deleting the job, or giving it an `if:`, would have left CI green.

**The fix.** A namespace import, `import * as nodeModule from 'node:module'`, and
`nodeModule.registerHooks(...)` at the one call site (`packages/core/src/cli-config.ts:207`). Spike
0438 measured it on macOS: all 28 entries load under Bun 1.4.3. Measured again 2026-10-17 in the
spike's patched worktree (at `65b9ce44`): both `bin`s answer `--help` under plain `bun`, and
`bun packages/ts/dist/cli/bin.js check spec.rules.ts` runs green (4 rules, about 0.1 s, one run).
Nothing leaves `@nielspeter/eess/internal`, so it is a patch to `@nielspeter/eess` (ADR-020's
consequences; ADR-011). The spike recommended moving the CLI's loader off `/internal` first, so a
library entry never links CLI code; this plan overrides that ordering, as ADR-020 allows, and the CLI
hook stays on library entries' load path until that move's own record. After the fix
`nodeModule.registerHooks` is `undefined` under Bun; it is called only when a TypeScript `.js`
specifier misses, which Bun resolves itself, and a probe of a missing `./missing.js` under Bun gave
the ordinary "Cannot find module" finding. That path is recorded at close, not changed here.

**The guard**, `scripts/check-bun-load.mjs`, run under Node, starting `bun` once per probe. It has
two halves, so that everything that needs no Bun runs locally:

- **Inputs, without Bun** (`inspectWorkspace`): the packages come from the root `workspaces` field,
  never a typed-in glob, keeping every package not marked `private`; each one's `exports` and `bin`
  are read from its manifest. An `exports` shape the guard cannot enumerate (a wildcard subpath, a
  `null` or array target) is a finding, never a silent skip. The committed exclusion list (packages
  that cannot load under Bun, each with its reason; empty after the fix) and the run-on-import list
  (today `@nielspeter/eess-ts/cli`) are validated against the workspace: an entry naming nothing is a
  finding, so both lists only shrink. A workspace with no published package is a finding.
- **Probes, with Bun** (`runGuard`): the guard first compares `bun --version` with `.bun-version`
  (`1.4.3`, the one pin, also read by the CI job), so a wrong local Bun is one finding, and missing
  Bun is a finding with the remedy, never a skip. Each `exports` entry is imported by `bun --eval`
  from the repository root, where the workspace links resolve to `dist/` (so the guard checks the
  workspace build, not a published tarball); each `bin` is run as `bun --preload <harness file>
<path> --help`, never through its shebang. In both, harness code prints `process.versions.bun`
  before any code under check runs, and the guard asserts runtime and version from that line for
  every probe. A run-on-import entry passes only if its import completed (the harness's after-line),
  it exited non-zero, and it printed its stated message ("No command specified"), so a link error,
  which also exits 1, cannot pass for it. Counts come from the probes that reported back, per
  package, and must equal the manifest's; a published package no probe reported on is a finding.
- **Findings** carry `ruleId`, the entry, Bun's own message and a remedy, in the family's shape
  (`--format json` on stdout); the success line goes to stderr:
  `✓ bun load — N entries and M bins across P packages, loaded by Bun X.Y.Z (T)`.

**Where it runs.** ADR-001 keeps Bun out of this repository's toolchain (its Amended-by note, line 7:
"Local development on Node and npm stays"), so the Bun half cannot be a required local gate. It runs
in its own CI job, `bun-load`: `oven-sh/setup-bun` pinned by commit SHA (with its tag as a comment)
and `bun-version-file: .bun-version`, `permissions: contents: read`, its own `npm ci` and build, then
`npm run check:bun-load` and `npm run check:bun-load -- --self-test`. It is a separate job, not a step
in `test`, so the twenty-minute suite and fail-fast cannot hide it, and it does not `needs: test`,
which would skip it whenever `test` fails. `gateCoverage`'s `CI_ONLY_BY_DESIGN` gains
`check:bun-load`, the set's first entry, with that reason.

**The job's own guard runs everywhere.** `gateCoverage` (in `check:nonvacuity`, which runs in
`validate` and in CI) reads `ci.yml` statically and requires: a `bun-load` job; no job- or step-level
`if:`, no `continue-on-error`, no `needs:`; Bun installed from `.bun-version`; and both the guard and
its self-test invoked. No branch protection is configured on `main`, so "blocks" means the CI run
goes red and the maintainer's review-before-merge rule stops the merge; ADR-020's R2 row says so.

**Non-vacuity, split by what needs Bun.**

- Without Bun, as ordinary `check:nonvacuity` rows through one fixture, `bad-bun-load.mjs`, with a
  scenario per row: a stale exclusion; a stale run-on-import entry; a workspace with no published
  package; a wildcard `exports` subpath; a `private` package that is still probed (the filter
  inverted); and five sabotaged `ci.yml` texts (job missing, `if:`, `continue-on-error`, `needs:`, the
  self-test step missing). `GATE_FOR['check:bun-load']` names these rows.
- With Bun, as the guard's `--self-test` in the CI job, over scratch workspaces under the system temp
  directory, each with its own package links: bug 0439's named import in an export; the same import
  reached only through a `bin`; a run-on-import entry that hits a link error; an excluded package that
  loads; a `.bun-version` other than the Bun installed; a fake `bun` on `PATH` that runs Node; a
  published package the guard drops (through a test-only option); and one clean workspace that must
  be green. Each break asserts its `ruleId`, not only exit 1. The breaks are one exported table with
  ids, and `gateCoverage` compares it against the ids this plan names, so a deleted break is a finding
  rather than a smaller count.

**ADR-020's row.** R2's second row moves from `pending` to `gated`, citing the guard, its CI job and
the `gateCoverage` check, with the no-branch-protection sentence, in this PR.

**Release.** The changeset patches `@nielspeter/eess`. Because `updateInternalDependencies` is
`patch` and every dialect takes the kernel at `^0.7.0`, all five dialects also take a patch bump, so
six packages publish; the changeset names eess-md and eess-ts so "loads under Bun again" reaches the
changelog the adopter reads. `publish.yml` does not run this guard, so the release box requires the
tagged commit's CI, `bun-load` included, to be green. Adopters on 0.5.x or 0.6.x must cross minor
versions to get the fix; the message to the adopter says so.

**Cost.** Measured at build time and recorded here: the guard's local run time, the self-test's, and
the first CI run of the job. Spike 0438 never measured Bun on Linux, where CI runs, so the first CI
run's counts are recorded as the Linux measurement.

## Files Changed

- `packages/core/src/cli-config.ts` — the namespace import.
- `scripts/check-bun-load.mjs` — new: the guard, its input half, its `--self-test`.
- `scripts/nonvacuity/bad-bun-load.mjs` — new: the no-Bun breaks.
- `scripts/check-nonvacuity.mjs` — the rows, `GATE_FOR`, `CI_ONLY_BY_DESIGN`, and the `ci.yml` and
  self-test-table checks in `gateCoverage`.
- `.bun-version` — new: `1.4.3`.
- `.github/workflows/ci.yml` — the `bun-load` job.
- `package.json` — `check:bun-load`.
- `adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md` — R2's row.
- `CLAUDE.md` — the gate-output table's row.
- `.changeset/` — `@nielspeter/eess`, eess-md and eess-ts named: patch.
- `work/bugs/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md` → `work/bugs/fixed/`,
  `work/bugs/BUGS.md`, this plan → `completed/`, `work/plans/ROADMAP.md`.

## Test inventory

- Red first: the guard against `main`'s build, run locally with Bun 1.4.3, reports 22 of 28 entries
  and both bins failing with bug 0439's message; recorded here.
- Green: the guard after the fix, all 28 entries and both bins.
- The `check:nonvacuity` rows for the no-Bun breaks, each red with its `ruleId`.
- The self-test's Bun breaks, each red with its `ruleId`, and its clean workspace green.
- CI: the `bun-load` job green on the PR, its log showing Bun's version and the counts on Linux.

## Out of scope

- **A Bun claim for any package** (ADR-020 rule 3: a suite on Bun, `engines`, refusals). The guard
  says nothing to adopters.
- **Taking the CLI's loader off `@nielspeter/eess/internal`.** It moves symbols out of a public
  subpath (ADR-011), so it is a minor and its own record, written at this plan's close.
- **Bugs 0440 and the eess-mermaid suite differences** (spike 0438): claims' problems, not the guard's.
- **The release.** Publishing the patch and telling the adopter the version numbers needs the
  maintainer's fresh yes; the bug's "published" box is `validation-owed` at close.

## Progress ledger

- [ ] The red run recorded
- [ ] The fix, the guard, the self-test, the CI job, the `gateCoverage` checks and rows
- [ ] ADR-020 R2 row gated; CLAUDE.md row; changeset
- [ ] Cost and the first Linux run recorded
- [ ] Record written: taking the CLI's loader off `@nielspeter/eess/internal` (a minor)
- [ ] Record written: `registerHooks` is undefined under Bun on the `.js`-to-`.ts` miss path
- [ ] Close: bug 0439 → `fixed/` (its publish box `validation-owed`: the tagged commit's CI green,
      `bun-load` included, six packages published, the adopter told), this plan → `completed/`,
      boards

Deferred: none
