# Bug 0318: two more test walks read `tests/__generated__`, where other tests write and delete files mid-run

## Status

- **State:** Draft — found by reading; not observed failing. No KNOWN-GAP test: both walks are
  written inline in their tests, and the race cannot be forced without changing them.
- **Severity:** Low — a spurious `ENOENT` in a full `packages/ts` run, with nothing changed. The
  window is narrower than
  [0313](./fixed/0313-the-cardinality-scan-reads-probe-files-another-test-writes-mid-run.md)'s: these
  fail only when a probe disappears between being listed and being read, not whenever one exists.
- **Origin:** found on 2026-09-15 while fixing 0313, by reading every recursive directory walk under
  `packages/ts/tests` for one that reaches `tests/__generated__`. The others walk `src/` or a
  kernel source tree.
- **Reported:** 2026-09-15

## Symptom

Read at `83aa0f8`, not observed:

| test                                                                | walks                                                                                   | skips                                                                                                       | then                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/ts/tests/docs/cross-document-links-resolve.test.ts`       | `src/` and `tests/` (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:196`) | dot-directories, `node_modules`, `dist` (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:186`) | reads every `.ts` file it collected (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:206`) |
| `packages/ts/tests/core/every-config-finding-is-classified.test.ts` | `tests/` (`packages/ts/tests/core/every-config-finding-is-classified.test.ts:338`)      | nothing (`packages/ts/tests/core/every-config-finding-is-classified.test.ts:331`)                           | descends into each directory it lists                                                                   |

Two tests write into `tests/__generated__` while the suite runs, and delete what they wrote:

- `packages/ts/tests/core/warn-survives-the-test-runner.test.ts` writes probe test files under
  `tests/__generated__/run-<pid>/` (`packages/ts/tests/core/warn-survives-the-test-runner.test.ts:102`);
- `packages/ts/tests/cli/init-scaffold-loads-rules.test.ts` scaffolds a project — `tsconfig.json`,
  `src/a.ts`, `arch.rules.ts` — under `tests/__generated__/init-<pid>-*/`
  (`packages/ts/tests/cli/init-scaffold-loads-rules.test.ts:50`).

The first walk collects those `.ts` files and reads them afterwards, so a file deleted in between is
`ENOENT`. The second lists `tests/__generated__` and then descends into a `run-<pid>` or
`init-<pid>-*` directory that may be gone by then. `cross-document-links-resolve.test.ts` already
records this race once, for the dot-directory the cardinality scan's own test writes
(`packages/ts/tests/docs/cross-document-links-resolve.test.ts:176`), and fixed it for that
directory alone.

## Root cause

Each walk of `tests/` keeps its own list of what to skip, and none names `tests/__generated__`.
Since 0313, `testFiles` in `packages/ts/tests/tools/scan-cardinality-assertions.ts` does.

## Fix

One walker of `tests/` in `packages/ts/tests/tools/`, which skips `tests/__generated__`, used by every
walk of that tree, with a test pinning the skip — that gives the fix a red test first, which skipping
it inline in both would not.

## Verification

- [x] Measured by reading the two walks and the two writers at `83aa0f8`.
- [ ] a shared walker with a test that pins the skip, used by both walks and by `testFiles`
- [ ] `npm run validate` green.

Deferred: none.
