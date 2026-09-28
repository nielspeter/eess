---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-crossvalidate': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
---

A path glob can name segments above the tsconfig root

**Breaking (@nielspeter/eess, @nielspeter/eess-ts):** a path glob led by `**/` is now
matched against a third spelling of each path — the path named from your **repository
root** (the nearest `.git` or workspace marker above the tsconfig) — as well as the
absolute path and the tsconfig-relative one.

**Are you affected?** Yes if your checkout path contains a dot-segment
(`~/.worktrees/…`, a cache directory, some CI workspaces) **and** any rule spells a
`**/` glob naming a package directory, such as `'**/apps/api/src/**'`.

**Find out before you upgrade.** Run your gates on the version you have and count the
selectors reporting "can never match anything in this project". Those are the rules
that go live. An adopter measured 61 of them in a dot-directory worktree against 0 in
a plain one — and, worse, one rule that caught a planted import in the plain run and
**passed** in the dot run.

**When you upgrade:** run your gates and **read the new findings before you regenerate
a baseline.** Regenerate first and you bake the vacuous pass in permanently.

Fixes [bug 0348](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
`'**/apps/api/src/**'` — how a monorepo addresses its own packages — selected
**nothing** under such a checkout, and the rule **passed**. Neither existing spelling
could express it: the absolute path carries the checkout's dot-segment, which
picomatch's default `dot: false` will not let `**` cross, and the tsconfig-relative
path has `apps/api/` stripped off the front — the very segments the glob names.
eess-ts 0.8.0 shipped
[0339](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
as the fix for this symptom and covered only globs written relative to a package root.

**What changes for you.** Under an ordinary checkout, nothing: the repo-relative path
is a suffix of the absolute path and `**` crosses any dot-free segment, so the third
spelling selects nothing the first did not — measured over a fixture rather than
argued. Under a checkout with a dot-segment above the repository root, globs that
silently matched nothing now match, so **a rule that was passing vacuously can start
failing and a baseline can gain entries.** That is the defect being fixed, and it is
why this is a break rather than a patch.

A **project-relative** glob (`'src/**'`) is deliberately unchanged: that spelling means
"relative to the project root", the project root is the tsconfig's directory, and giving
it a second root would make one glob name two different directories in a monorepo. Only
the `**/` spelling, which says "anywhere", reaches above the tsconfig.

The third spelling is only as stable as your repository root. `.git` absent and no
workspace marker — a Docker build, a `git archive` tarball, some CI source artifacts —
resolves the package instead, and the spelling collapses onto the tsconfig-relative
one. It is only ever additive, so nothing breaks; a rule can select differently in CI
than locally.

**API, for anyone building on the kernel:** `PathUniverse` gains two **required**
fields, `repoRelativeFilePaths` and `repoRelativeParentDirs`, and `viewsFor` gains a
**required** third parameter saying whether the matcher reads them. Both are required
rather than optional on purpose — a caller that forgets would get the generous union,
and a view the matcher has and the universe lacks reports a working rule as one that
"can never match anything in this project". `viewsFor` ships from
`@nielspeter/eess/internal`, so an external two-argument call no longer typechecks.

The four sibling dialects are named at `minor` because they re-export the kernel and an
adopter may install one of them holding no range on `@nielspeter/eess` at all — a break
announced only where it happened would reach them as an inherited patch, under a
changelog reading "Updated dependencies". Nothing in their own behaviour changes.
