# Bug 0318: two test walks read `tests/__generated__`, where other tests write and delete files mid-run

## Status

- **State:** Draft — found by reading, and corrected by #139's reviews; not observed failing. No
  KNOWN-GAP test: both walks are written inline against the real tree, and the exposure can be forced
  only by planting an unreadable directory in the live `tests/__generated__`, which reds a concurrent
  run as well.
- **Severity:** Medium — **false red.** A full `packages/ts` run can fail with `ENOENT` with nothing
  changed. The window is narrower than
  [0313](./fixed/0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md)'s — a
  file must disappear between being listed and being read — but the same race has already failed
  `npm run validate` once, in one of these two walks, for another directory a test wrote and deleted
  (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:176`).
- **Origin:** found on 2026-09-15 while fixing 0313, by reading every recursive directory walk under
  `packages/ts/tests` for one that reaches `tests/__generated__`; #139's architecture, enforcement,
  testing and method reviews corrected its severity, its list of writers and its proposed fix.
- **Reported:** 2026-09-15

## Symptom

Read at `83aa0f8`, not observed:

| test                                                                | walks                                                                                   | skips                                                                                                                                                                              | then                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/ts/tests/docs/cross-document-links-resolve.test.ts`       | `src/` and `tests/` (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:196`) | `node_modules`, `dist` (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:186`) and dot-directories (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:187`) | reads every `.ts` file it collected (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:206`) |
| `packages/ts/tests/core/every-config-finding-is-classified.test.ts` | `tests/` (`packages/ts/tests/core/every-config-finding-is-classified.test.ts:338`)      | nothing (`packages/ts/tests/core/every-config-finding-is-classified.test.ts:331`)                                                                                                  | descends into each directory it lists, and collects file names                                          |

Two tests write into `tests/__generated__` while the suite runs, and delete what they wrote:

- `packages/ts/tests/core/warn-survives-the-test-runner.test.ts` writes probe test files under
  `tests/__generated__/run-<pid>/` (`packages/ts/tests/core/warn-survives-the-test-runner.test.ts:102`);
- `packages/ts/tests/cli/init-scaffold-loads-rules.test.ts` scaffolds a project — `tsconfig.json`,
  `src/a.ts`, `arch.rules.ts` — under `tests/__generated__/init-<pid>-*/`
  (`packages/ts/tests/cli/init-scaffold-loads-rules.test.ts:50`).

A third writer, the cardinality scan's own test, wrote `tests/tools/.scan-probe/` at `83aa0f8`; since
0313 it writes to a throwaway tree, so the second walk no longer meets it.

The first walk collects those `.ts` files and reads them afterwards, so a file deleted in between is
`ENOENT`. The second lists `tests/__generated__` and then descends into a `run-<pid>` or `init-<pid>-*`
directory that may be gone by then. It also collects file names into the set it checks citations
against, so a probe that shares a cited test's name could make a citation to a deleted test look alive
— not observed. Within one `npm run test`, the packages run one after another (`package.json:15`), so
no other package's walk meets these files.

## Root cause

Each walk of `tests/` keeps its own list of what to skip, and neither names `tests/__generated__`.
The directory's location is spelled independently wherever it is used — `.gitignore:32`,
`packages/ts/tsconfig.json:29`, `packages/ts/vitest.config.ts:31`,
`packages/ts/tests/core/warn-survives-the-test-runner.test.ts:101`,
`packages/ts/tests/cli/init-scaffold-loads-rules.test.ts:46`, and since 0313 `testFiles` in
`packages/ts/tests/tools/scan-cardinality-assertions.ts` — so a skip does not follow a writer that
moves.

## Fix

Share the location, not a walker. Export the path once — `packages/ts/tests/roots.ts` already
resolves the roots a test in this package can mean — and use it in both writers, the vitest prune and
every walk of `tests/`, each of which skips it and keeps its own other rules. One walker for all
three would need one set of skips, and they differ: the links walk skips dot-directories, the
cardinality scan reads them.

The fix's test must show a walk never looks inside the directory — an unreadable directory in a
throwaway `tests/__generated__`, as 0313's test plants — because a walk that descends and drops the
files afterwards passes a test of its output and keeps the race. And something must check that each
walk of `tests/` uses the shared location, or the fix is a convention.

Considered: `init-scaffold-loads-rules.test.ts` could scaffold outside `tests/` without losing what it
tests; `warn-survives-the-test-runner.test.ts` cannot, because its child run collects only `tests/**`.
What a killed run leaves in `tests/__generated__` is
[0319](./0319-a-killed-runs-leftovers-in-tests-generated-red-lint-and-nothing-names-them.md).

## Verification

- [x] Measured by reading the two walks and the writers at `83aa0f8`, and corrected against #139's
      reviews.
- [ ] the shared location, used by the writers, the prune and every walk of `tests/`, with a test that
      pins that a walk never looks inside it
- [ ] `npm run validate` green.

Deferred: none.
