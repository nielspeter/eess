# Bug 0149: `check:release` silently under-credits consumed changesets when `HEAD` is a merge commit — exactly GitHub Actions' default PR checkout

## Status

- **State:** Fixed — 2026-08-16. Red test written first
  (`scripts/nonvacuity/bad-release-e2e.mjs`), fix applied, both halves of the
  fix independently sabotage-verified (revert either flag alone → the new
  scenario reds; restore → green). Confirmed against a real GitHub PR merge
  ref (PR #67), not only the synthetic fixture. One item validation-owed: the
  actual CI job re-run with the fix pushed, not yet observed (see
  Verification).
- **Severity:** High — the release gate exists specifically so a changed
  package cannot merge without a changeset (bug 0106). This defect makes it
  **fail closed in the wrong direction for a specific, common shape**: a real,
  correctly-declared release can read as undeclared, for every package a
  multi-package changeset covers, on every PR whose merge-preview commit has
  the right shape. Not a false negative (missing a real gap) — a false
  positive that blocks a legitimate, already-declared release.
- **Origin:** self-found · diagnosing a genuine CI failure on PR #67 while
  auditing this session's own work before a push
- **Reported:** 2026-08-16

## Symptom

`npm run check:release` passed locally on PR #67's branch (`6 changed · 6
declared`, `9 declaration(s)`) but failed in CI with `6 changed · 2 declared`,
flagging `@nielspeter/eess`, `@nielspeter/eess-gherkin`, `@nielspeter/eess-md`,
and `@nielspeter/eess-mermaid` as undeclared — even though all four were
correctly covered by an already-consumed changeset
(`.changeset/fold-ts-archunit-engine.md`, a real, committed, 6-package
declaration).

## Reproduction

```bash
node scripts/nonvacuity/bad-release-e2e.mjs
# "a changeset consumed on the branch still counts when HEAD is a
#  PR-merge-preview commit": the real script exited 1, expected 0.
```

Confirmed directly against the real GitHub ref before writing the fixture:

```bash
git fetch origin 'refs/pull/67/merge:refs/remotes/origin/pr-67-merge'
git rev-list -1 origin/pr-67-merge -- .changeset/fold-ts-archunit-engine.md
# (nothing)
git rev-list -1 --full-history origin/pr-67-merge -- .changeset/fold-ts-archunit-engine.md
# 5a47a54a505227d6cd8f30a9251f813774c1face
```

## Root cause

`check:release`'s local runs always compare against a real branch tip
(`git rev-parse HEAD` on your own checkout). CI does not: `actions/checkout`'s
default behavior for `pull_request` events checks out `refs/pull/N/merge` — a
synthetic 2-parent commit GitHub generates by merging the PR branch into the
base branch — not the PR branch's own tip. Confirmed: `git log -1 --format="%P"
origin/pr-67-merge` shows two parents (`origin/main`, the PR branch tip). This
is the default, undocumented-in-this-repo behavior, not a workflow
misconfiguration — `.github/workflows/ci.yml` never sets `ref:`.

`check-release.mjs` credits a changeset created and consumed entirely within
the diff — present at neither the merge-base nor `HEAD`'s own tree — by
walking git history for the file's last-touching commit
(`scripts/check-release.mjs`'s `addDeleted`'s log scan, and `consumedContent`'s
`git rev-list -1 HEAD -- file` fallback). Both used **default, path-limited
history simplification**. For a path absent from **both** parents of a merge
commit, that simplification can silently follow only one parent and never
surface the commit that touched it on the other side — even though it is a
real ancestor. `fold-ts-archunit-engine.md` was created and deleted entirely
on the PR-branch side; from the merge commit, default history walking never
crossed onto that side to find it.

Two call sites had the same defect, independently:

1. `addDeleted`'s "case 3" log scan (`git log --diff-filter=D … mergeBase..headSha -- .changeset`) — the file-level "was this consumed at all" detection.
2. `consumedContent`'s `git rev-list -1 headSha -- file` — the content-level "what did it declare" lookup, reached once (1) has found the file.

Sabotage-verified each is independently necessary: reverting either one alone
(with the other fixed) reproduces the failure on its own.

## Fix

Add `--full-history` to both git calls (`scripts/check-release.mjs`). This is
the correct fix, not a workaround: it makes the **instrument** correct
regardless of what commit `HEAD` happens to be, rather than changing the CI
workflow to avoid ever exercising the bug (e.g. checking out
`github.event.pull_request.head.sha` instead of the default merge ref). The
latter would have hidden the defect for this one workflow while leaving
`check-release.mjs` itself wrong for anyone else who runs it — locally against
a merge commit, from a different CI provider, or from a future workflow change
— exactly the kind of check-shaped-like-a-check-but-isn't this project's own
doctrine exists to catch. Verified `--full-history` doesn't change the
already-correct result on this repo's own deep history (same 3 files, same 9
declarations) — additive, not a behavior change for the working case.

## Verification

- [x] Red test written first: `scripts/nonvacuity/bad-release-e2e.mjs` gained
      a scenario building a real 2-parent merge commit (base branch untouched,
      matching `origin/main` never advancing) and asserting the real script
      still credits a changeset consumed entirely on the feature-branch side.
      Confirmed red before the fix (exit 1, `changed package "@fixture/alpha"
has no matching changeset declaration`).
- [x] Fix applied: `--full-history` added to both git calls in
      `scripts/check-release.mjs`.
- [x] Both halves sabotage-verified independently (see Root cause).
- [x] Confirmed against the real PR #67 merge ref, not only the synthetic
      fixture — the fixed script reports `6 changed · 6 declared` there.
- [x] `npm run validate` green (167 test files, 2216 tests).
- [x] validation-owed: CI itself re-run on PR #67 with this fix pushed, to
      confirm green in the real GitHub Actions environment (the worktree
      reproduction is strong evidence, not the same as watching the actual
      job pass).

Deferred: none.
