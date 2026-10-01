---
'@nielspeter/eess-ts': patch
---

A disk walk that gives up now says so, and the budget is 10× higher

Fixes [bug 0359](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md).

**A gate could switch itself off for a whole repository, silently.** Since 0.10.0 a
`.notExist()` rule reports only when the filesystem contradicts the absence it asserts. That
classification comes from a walk with an entry budget, and on exhaustion the walk answered
"could not determine" for **every** glob at once — which means green. One repository over the
threshold silenced every cardinality rule in the run, for a reason unrelated to any of their
paths, and nothing said the walk had given up.

**Two changes, and the first is the fix:**

- **Exhaustion is now reported**, as one unsuppressable finding per run rather than one per
  rule, naming the directories that consumed the walk, largest first with their share. It
  does not say "your repository is too large" — that is not something you can act on.
  Measured: pruning removes **88.9%** of directory entries in a repository with no generated
  output at all, so a repository that exhausts is overwhelmingly carrying trees that should
  never have been walked.
- **`ENTRY_BUDGET` is 50,000 → 500,000**, and the default prune list grows from 14 names to 30. The old cutoff fired after about **105 ms** of work while the comment justifying it
  cited a 5-second timeout — roughly 48× below its own reason. `.wrangler` is among the new
  names: one adopter measured it at **58% of their entries**, in the repository closest to
  the old budget.

**Are you affected?** If your gates are green today, this changes nothing you can observe —
every repository measured so far sits far inside even the old budget (this one at ~2,300
entries after pruning; a 15-package monorepo at 16,770). If you were above it, you were
getting a false green on every `.notExist()` rule and had no way to know.

**One more fix, found by this one.** A tsconfig with no repository above it resolved to the
filesystem root, and the walk read the entire disk — always, invisibly, because exhaustion
was silent. It now answers "not determined" without walking. If you construct `ArchProject`
values by hand with a synthetic path, this is strictly faster and the classification is
unchanged.

**Not addressed:** the prune list and the budget are still not configurable — see
[bug 0369](https://github.com/nielspeter/eess/blob/main/work/bugs/0369-the-prune-list-has-no-extension-point.md).
