# Bug 0442: `check:mermaid-parses` reads a file deleted but not staged as one eess-md failed to load

## Status

- **State:** Fixed — 2026-10-18, in PR #236, which needed it: its dead-root refusal ([bug 0465](./0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md)) turned this
  misreading into a crash.
- **Severity:** Medium — a false red on the board's scale, with a wrong remedy ([ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2): the
  tree has no Mermaid defect, and the remedy sends the author to debug eess-md.
- **Origin:** self-found · PR review of [plan 0427](../../plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md), 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

The gate's scope is `git ls-files --cached --others --exclude-standard`
(`scripts/check-mermaid-parses.mjs:56`). `--cached` reads the index, so a file in the index but not on disk (tracked and
removed with `rm`, or added and then removed) is listed, the file does not load, and the gate's every-path-loaded check
reports `git lists 5 Markdown files and 4 loaded; not loaded: gone.md` with "Find why eess-md did
not load these files" (`scripts/check-mermaid-parses.mjs:101`; measured by the enforcement review in
a scratch repository, re-measured by this PR's method review on 2026-10-16). CI is
unaffected: a checkout has no unstaged deletions.

## Fix

Subtract `git ls-files --deleted` from the scope, or name that cause in the remedy.

## Resolution

The gate drops a listed path that is not on disk (`existsSync`) before building its corpora, which is
the Fix's first option. PR #236 needed it: [bug 0465](./0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md) made `corpus()` refuse a root that matches no
file, and the gate passes every listed path as a root, so the misreading had become an
`ArchConfigError`. The pointers above are the lines as of this fix.

## Verification

- [x] Red first: a scratch repository with a tracked file removed by `rm`, not `git rm`, beside a broken block. main's gate names the deleted file instead of the broken block (measured 2026-10-18).
- [x] Green, with a non-vacuity row: `mermaid-parses/deleted-file` asserts that the broken block is named at `a.md:5` and the deleted file is not mentioned.

Deferred: none
