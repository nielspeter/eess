# Bug 0302: `next-number` cannot see numbers claimed on open branches

## Status

- **State:** Draft — measured when it happened; no red test, because a test needs a
  git fixture with more than one branch and `kit/scripts/` has no test harness.
- **Severity:** Medium — each branch's `check:numbers` is green, and the duplicate
  first appears on `main` after the second of two branches merges. The cost is a
  renumber across every citation of the number.
- **Origin:** self-found · it allocated this record's own siblings.
- **Reported:** 2026-09-14

## Symptom

On 2026-09-14, `npm run next-number` printed `0282` — the checkout's highest was
0281 — while numbers were already claimed off `main`:

| where                                       | claims                             |
| ------------------------------------------- | ---------------------------------- |
| PR #128, opened 2026-09-13                  | bugs 0282–0288                     |
| PR #129, opened 2026-09-13, stacked on #128 | bugs 0289–0293                     |
| a local branch, not pushed                  | rejected bug 0282, draft plan 0294 |

Four records were filed as 0282–0285 and had to be renumbered to 0295–0298, along
with their test titles, rule ids, board rows, a changeset and a correction note in
another record. Review, not a gate, caught it.

## Reproduction

```bash
git fetch origin
for b in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes); do
  git diff --name-only --diff-filter=A main...$b
done | grep -oE '^work/.*/[0-9]{4}-' | grep -oE '[0-9]{4}' | sort -u | tail -1
# → the highest number claimed anywhere; next-number never looks
```

## Root cause

`kit/scripts/next-number.mjs` collects from `<root>/work` only (`:108`), and
`--check` (`:116`) compares what that scan found. `check:numbers` is that `--check`
(`package.json:48`). Bug [0107](./fixed/0107-number-allocation-scans-one-lane.md)
made the scan cross-lane; nothing made it cross-branch.

## Fix

Not decided:

- **Scan every ref.** `git for-each-ref` over local and remote heads, taking numbered
  files added relative to `main`. Zero dependencies beyond the git binary, which
  every kit consumer has; needs a fetch to see remote branches.
- **Check against open PR heads in CI.** Catches what the allocator missed, but
  needs the forge's API, which the portable kit cannot assume.

Either way, two limits to state rather than hide: nothing sees a number claimed in
an uncommitted file in another worktree, and a stale remote branch holds its
numbers until it is deleted.

## Verification

- [ ] red first: a git fixture with a branch holding a higher number, over which
      `next-number` returns a number that branch already claims
- [ ] the fix, and `--check` over the same scan
- [ ] `npm run validate` green.

Deferred: none.
