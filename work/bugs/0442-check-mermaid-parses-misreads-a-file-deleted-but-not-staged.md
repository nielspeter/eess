# Bug 0442: `check:mermaid-parses` reads a file deleted but not staged as one eess-md failed to load

## Status

- **State:** Draft — recorded 2026-10-16, an accepted residual of plan 0427's PR (#225), from its
  enforcement and method re-reviews.
- **Severity:** Medium — a false red on the board's scale, with a wrong remedy (ADR-009 rule 2): the
  tree has no Mermaid defect, and the remedy sends the author to debug eess-md.
- **Origin:** self-found · PR review of plan 0427, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

The gate's scope is `git ls-files --cached --others --exclude-standard`
(`scripts/check-mermaid-parses.mjs:55`). `--cached` reads the index, so a file in the index but not on disk (tracked and
removed with `rm`, or added and then removed) is listed, the file does not load, and the gate's every-path-loaded check
reports `git lists 5 Markdown files and 4 loaded; not loaded: gone.md` with "Find why eess-md did
not load these files" (`scripts/check-mermaid-parses.mjs:100`; measured by the enforcement review in
a scratch repository, re-measured by this PR's method review on 2026-10-16). CI is
unaffected: a checkout has no unstaged deletions.

## Fix

Subtract `git ls-files --deleted` from the scope, or name that cause in the remedy.

## Verification

- [ ] Red first: a scratch repository with a tracked file removed by `rm`, not `git rm`
- [ ] Green, with a non-vacuity row

Deferred: none
