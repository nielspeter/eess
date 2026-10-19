# Bug 0524: two md test files race over one fixture directory

## Status

- **State:** Fixed — 2026-10-19, in PR #252, at the coordinator's order (a test-only fix).
- **Severity:** Low — a flaky red in the md suite, never a false green. It depends on CPU load and
  on how vitest schedules the two files.
- **Origin:** self-found · PR #252's testing verify review, 2026-10-19, after one unexplained red in
  a builder's md run.
- **Reported:** 2026-10-19

## Symptom

`packages/md/tests/corpus-from-text.test.ts`, "parity on the resolve-link tree: documents, index,
receipts and element sets", fails now and then with:

```
ArchConfigError: corpusFromText: 'node_modules/pkg/readme.md' lies under 'node_modules/', a directory
corpus() never walks — a test over it would pass on a file CI cannot see. Move it, or leave it out.
```

## Cause

Two test files share one fixture directory, and one of them changes it:

- `packages/md/tests/resolve-link.test.ts` (the "a built-in ignored folder" block) writes
  `tests/fixtures/resolve-link/node_modules/pkg/readme.md` in `beforeAll` and removes it in
  `afterAll`; the file cannot be committed, since `node_modules` is ignored by git;
- `packages/md/tests/corpus-from-text.test.ts`'s `readTree` reads the same directory recursively, in
  another vitest worker, and hands every file to `corpusFromText`, which refuses one under
  `node_modules/`. The disk side, `corpus()`, never walks that folder, so only the text side throws.

When the two files' run windows overlap, the text side sees the transient file. A second variant, a
file listed and then deleted before it is read (ENOENT), is possible and was not observed.

## Evidence

From PR #252's testing verify review: 40 runs of the md suite, 1 failure (sequential run 16 of 20,
1-minute load 5.5 rising to 15.8 over the batch; 20 more runs 4-way parallel at load 42 gave none).
Deterministic: leaving the file in place, as a `resolve-link` run killed between `beforeAll` and
`afterAll` would, makes two tests fail every time ("parity on the resolve-link tree…" and "the parity
is not empty…"). `git status` does not show the leftover.

## Fix

`readTree` skips any path under `node_modules/`, as `corpus()` does. The parity it tests is between
what `corpus()` reads and what `corpusFromText` is given, and `corpus()` never reads that folder.

## Verification

- [x] Red first, deterministic: with `tests/fixtures/resolve-link/node_modules/pkg/readme.md` created
      by hand, `vitest --root packages/md run corpus-from-text` gave 2 failed, 25 passed, before the
      fix
- [x] Green: the same repro after the fix gives 27 passed; the file was then removed
- [ ] `npm run validate` green — validation-owed: validate and CI at the pull request's merging head,
      recorded in the pull request's description

Deferred: none
