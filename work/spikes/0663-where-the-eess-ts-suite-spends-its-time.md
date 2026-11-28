# Spike 0663: where the eess-ts suite spends its time

Not run yet: authored 2026-11-27 as the second half of cutting a PR's wait, beside
[plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md), then rewritten the same day against
the testing and method reviews ("Review, 2026-11-27" below). Time-boxed to about four hours. It brings
back a design for the maintainer's decision and changes no test, no config and no source. Code
pointers are as at `main` 8f3569ee. It follows [spike 0631](./0631-where-ci-time-goes.md), which
measured where CI's runner time goes, and [spike 0366](./0366-where-validate-spends-its-time.md),
which measured the local `validate` chain.

## The question

[Plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md) projects the slowest nonvacuity
shard at about 7.3 minutes, a projection it has yet to measure. CI's `test` job then sets a PR's
wait. What can make that job, which ran 8m16s on CI run 45969038139 (PR #344's final commit), finish
within that target, without weakening a test?

## What is known

Measured from CI run 45969038139's job and step times:

- **The job.** Its steps sum to 494 s: `npm run test` 311 s; `format:check` 24 s; `check:arch` 22 s;
  `lint` 21 s; `typecheck` 12 s; `npm ci` 12 s; `check:corpus` 11 s; the rest under 10 s each. The
  suites run after about three minutes of serial gates, and the small packages' suites run before
  eess-ts's.
- **The eess-ts suite** took 255.5 s of `npm run test` (the testing review), about 52% of the job.
  The other 37% is `npm ci`, the build, about twenty gates, lint and format.
- **Not yet known, and the spike's first measurement:** where the suite's own time goes. Vitest
  reports import time summed across workers, and part of what it counts as import is 45 test files
  that build projects at module scope. Locally, loading ts-morph is about 190 ms of a warm 265 ms
  import per file (the testing review). The claim that the compiler is "loaded again for each file"
  is a hypothesis the profile tests.
- **Isolation is pinned on purpose.** `packages/ts/vitest.config.ts:62-71` sets `isolate: true`:
  modules keep test-only overrides in module-level state, and ts-archunit's bug 0080, which the
  config's comment cites, measured what sharing a module instance across files does. The state is
  wider than the three test files that call a `*ForTests` hook: the `project()` and `workspace()`
  caches keyed by tsconfig path (`packages/ts/src/core/project.ts:36`, `:87`), flags in the kernel
  (`packages/core/src/report.ts:72`, `packages/core/src/stderr.ts:45`,
  `packages/core/src/diff-disclosure.ts:92`), the source-text registry on `globalThis`, and a hook
  registration that cannot be undone (`packages/core/src/cli-config.ts:188`). This spike brings back
  no lever that shares a module instance across test files.

## Method

- Profile first: vitest's per-file durations and its import breakdown
  (`--experimental.importDurations`), so each lever is chosen from where the time is, not where it
  was guessed.
- Each measurement runs in a worktree with its own `npm ci`, since the nested vitest in
  `packages/ts/tests/core/warn-survives-the-test-runner.test.ts` reads the real config.
- Locally, under `taskset -c 0-3`, to match CI's four vCPUs (vitest uses 11 workers here and 3
  there), before and after interleaved, recording wall time, CPU time and peak memory.
- A lever keeps a test's proof only if the JSON reporter's sets of passed, skipped and failed tests are
  identical by name, before and after, including the nested run in
  `packages/ts/tests/core/warn-survives-the-test-runner.test.ts`, which a compile-cache variable or
  setup file also reaches. A failure, explained or not, rejects the lever. Each run also
  records the slowest test's headroom against the 30 s timeout.
- One CI run confirms whatever is recommended, since local timing does not answer CI's worker count.

## Levers to measure, in order

1. **The job's layout.** The eess-ts suite in its own job, or split by `vitest --shard`, running from
   the start instead of after the gates, and the small suites beside it. Measured from the step times
   above and one CI run. It changes no test, but it can stop the suite gating a merge: the `main`
   ruleset requires only the checks named `test`, `nonvacuity` and `bun-load`, and the check that a
   CI step is not dropped looks only for the text `npm run test` in `ci.yml`
   (`scripts/check-nonvacuity.mjs:6519-6540`), so a new job that is removed, skipped or marked
   `continue-on-error` would stay green (the testing review's re-check). A plan for it keeps the
   suite under the required `test` name, or adds a required job that checks every shard ran, passed
   and together covered every test file, as the nonvacuity merge job does for its shards
   (`scripts/lib/nonvacuity-shards.mjs:186-199`), with a sabotage row: one shard dropped reds the
   required check. It costs runner slots, which is the maintainer's call
   ([spike 0631](./0631-where-ci-time-goes.md) recorded the same trade).
2. **Node's compile cache.** `NODE_COMPILE_CACHE` alone saved nothing in the testing review's trial,
   since vitest's workers never write the cache. Calling `module.flushCompileCache()` in a setup
   file's `afterAll` cut ts-morph's load from 203 ms to 95 ms there. Measured for the whole suite. It
   cannot change a result: V8 refuses a cache whose source changed.
3. **The pool and the worker count**: `threads` against `forks`, on CI's four vCPUs. `process.chdir`
   throws under threads, which the measurement checks first; the kernel's one-time loader hook and the
   `globalThis` source-text registry exist once per thread, harmless while `isolate: true` holds.
4. **Projects built once per file where a test builds one per test.** `project()` already builds each
   fixture once per file. The targets are loaders that build per test, such as `loadSource()` in
   `packages/ts/tests/core/every-config-finding-is-classified.test.ts:241`, which loads the whole package
   eight times. The risks to measure: a warm cache making a cold-path test pass vacuously, and 115
   files that modify projects. A plan for it would need a check that a shared project is unchanged
   after its file, with a sabotage row.

Ruled out: vitest's dependency pre-bundling, since ts-morph already loads outside vitest's transform
and nothing imports `typescript` directly; its risk is a second copy of the kernel, whose resets
would then miss the copy a test reads. Also ruled out: isolation turned off for any subset of files,
for the reasons under "What is known". That question, if it is reopened, is a spike of its own: it
needs a static check of what each file imports and a leak-detecting setup as standing guards, since
shuffled order cannot catch a test that passes on state another file left behind.

## What it brings back

For each lever: the measured saving, locally and for the one recommended set on CI, and the risk to
a test's proof. A recommended set for the maintainer to decide, against the target above. Each lever
chosen becomes its own closable plan.

## Review, 2026-11-27

The first draft was reviewed by the testing and method lenses; their full reviews were written to the
session's scratchpad. The testing review held it with one critical finding.

- **Critical, testing:** isolation turned off for files that call no `*ForTests` hook selects the
  wrong files, since the module-level state is far wider, and shuffled order cannot find a test that
  passes on another file's state. Removed; its requirements are recorded above if it is reopened.
- **Important:**
  - the job's layout was missing and may be the largest lever (testing): now lever 1;
  - the figures came from an older, slower run (method): restated from run 45969038139;
  - the compile cache needs `flushCompileCache` (testing): stated;
  - pre-bundling is half a no-op and half a risk (testing): ruled out;
  - CI's four vCPUs, comparison by test name, timeout headroom, and a profile first (testing);
  - two hours could not hold five levers (testing): four hours, four levers, profile first;
  - "loaded again for each file" was a hypothesis filed as known (method): moved to the method.
- **Re-check, the same day (testing):** the critical finding and all eight important ones closed.
  New, folded in: lever 1 can stop the suite gating a merge unless its plan keeps it required (now in
  lever 1); the per-thread hook and registry (lever 3); the nested run in the by-name comparison.
- Minor: the commit pointers stand at, where the config edits happen, the links to
  [spike 0631](./0631-where-ci-time-goes.md) and [spike 0366](./0366-where-validate-spends-its-time.md),
  and this section's place for corrections.

## Corrections

None yet.
