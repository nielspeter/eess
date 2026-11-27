# Spike 0663: where the eess-ts suite spends its time

Not run yet: authored 2026-11-27 as the second half of cutting a PR's wait, beside
[plan 0662](../plans/0662-the-corpus-rows-run-in-one-process.md). Time-boxed to about two hours. It
brings back a design for the maintainer's decision and changes no test, no config and no source.

## The question

Once [plan 0662](../plans/0662-the-corpus-rows-run-in-one-process.md) cuts the nonvacuity shards to
about 7 minutes, CI's `test` job sets a PR's wait: 8m16s and 10m01s on PR #344's last two runs. What
in it can be made cheaper without weakening a test?

## What is known

- **The eess-ts suite is most of the job.** On PR #339's CI run (43646937509), `npm run test` took
  479 s; eess-ts's suite was 390 s of it (327 files, 3,984 tests). Vitest's own breakdown for it:
  `import 449.59s, tests 647.00s, transform 9.64s`, summed across workers.
- **Imports cost as much as the tests.** 449 s of import across 327 files is about 1.4 s a file:
  ts-morph and the TypeScript compiler loaded again for each file.
- **Isolation is pinned on purpose.** `packages/ts/vitest.config.ts:62-71` sets `isolate: true`:
  several modules keep test-only overrides in module-level state (the `*ForTests` convention), and
  ts-archunit's bug 0080, which the config's comment cites, measured what sharing a module instance
  across files does. Turning isolation off for the whole suite is not an
  option this spike may bring back.
- **Tests load real projects.** The same config's comment says a case costing 300 ms alone costs 3–5
  s under full parallelism, which is why `testTimeout` is 30 s.

## Levers to measure

Each is measured on this machine, the suite before and after, three runs each, with the pass count
equal and every failure explained:

1. **Node's compile cache** (`module.enableCompileCache()`, Node 22+) for the TypeScript compiler,
   which every file loads: whether V8's cached code survives vitest's per-file module graph, and what
   it saves.
2. **Vitest's dependency handling** for `ts-morph` and `typescript` (pre-bundling, or loading them
   outside vitest's transform): whether a file's import time falls with isolation unchanged.
3. **The pool**: `threads` against `forks`, and the worker count CI's runner gets.
4. **Isolation where nothing needs it.** Which files touch no module-level override, measured by
   reading the `*ForTests` users; whether those can run in a second vitest project with
   `isolate: false` while every other file keeps it, and what that saves. A test that depends on
   another's state would show as a failure under shuffled order, which the measurement runs.
5. **Projects built once per file.** Tests that build the same fixture project per test and never
   change it: how many, and what building it once per file saves.

## What it brings back

The measured saving of each lever, the risk each carries to a test's proof, and a recommended set,
for the maintainer to decide. Each lever chosen becomes its own closable plan.
