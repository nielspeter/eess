# Bug 0446: a link to a file git does not track resolves locally, and fails only in a clean checkout

## Status

- **State:** Draft — recorded 2026-10-16; reproduced here on main's build. No red test yet.
- **Severity:** Low — CI is the gate and reds, because a clean checkout lacks the file; the local run
  is green on a link CI will reject.
- **Origin:** inbound · an adopter monorepo (unnamed), feedback on [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md), verified here.
- **Reported:** 2026-10-16

## Symptom

`corpus()` builds its `fileIndex` by walking the directory (`packages/md/src/corpus.ts:66`) and never
asks git. Reproduced in a scratch repository: `docs/a.md` (committed) links `./b.md`; `docs/b.md`
exists but is untracked. `links(c).should().resolve()` reports nothing, and `docs/b.md` is loaded as
a document. A clean clone has no `b.md`.

[Bug 0442](./fixed/0442-check-mermaid-parses-misreads-a-file-deleted-but-not-staged.md) is the opposite case on another gate (a tracked file deleted but not staged). "What git tracks" means `git ls-files --cached` without the files `--deleted` lists (0442's fix too). `check:mermaid-parses` is not the model: its `git ls-files --cached --others --exclude-standard` ([plan 0427](../plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md)) also lists untracked, unignored files, and in the repository above it prints `docs/b.md`, so it has the same blind spot (to be recorded on its own, not fixed here).

## Fix

To be decided in the fix: an option to resolve against what git tracks, or a finding for a link whose
target git does not track. A walk without git (no repository) keeps today's behaviour, and says so.

## Verification

- [ ] Red first: the two-file repository above
- [ ] Green, with a non-vacuity row

Deferred: none
