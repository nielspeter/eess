# Bug 0442: `check:mermaid-parses` reads a file deleted but not staged as one eess-md failed to load

## Status

- **State:** Draft — recorded 2026-10-16, an accepted residual of plan 0427's PR (#225), from its
  enforcement and method re-reviews.
- **Severity:** Low — no false green: the run is red. Its remedy sends the author to debug eess-md
  for a file they deleted.
- **Origin:** self-found · PR review of plan 0427, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

The gate's scope is `git ls-files --cached --others --exclude-standard`
(`scripts/check-mermaid-parses.mjs:55`). `--cached` still lists a tracked file deleted from the working
tree until the deletion is staged, the file does not load, and the gate's every-path-loaded check
reports `git lists 5 Markdown files and 4 loaded; not loaded: gone.md` with "Find why eess-md did
not load these files" (measured by the enforcement review in a scratch repository). CI is
unaffected: a checkout has no unstaged deletions.

## Fix

Subtract `git ls-files --deleted` from the scope, or name that cause in the remedy.

## Verification

- [ ] Red first: a scratch repository with a tracked file removed by `rm`, not `git rm`
- [ ] Green, with a non-vacuity row

Deferred: none
