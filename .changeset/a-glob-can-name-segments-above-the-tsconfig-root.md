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
matched against a third view of each path — the path named from the **identity root**,
the `.git`/workspace root above the tsconfig — as well as the absolute path and the
tsconfig-relative one.

Fixes [bug 0348](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
`'**/apps/api/src/**'` — how a monorepo addresses its own packages — selected **nothing**
when the checkout sat under a path with a dot-segment (`~/.worktrees/repo`, a cache
directory, some CI workspaces), and the rule **passed**. Neither existing view could
express it: the absolute path carries the checkout's dot-segment, which picomatch's
default `dot: false` will not let `**` cross, and the tsconfig-relative path has
`apps/api/` stripped off the front — the very segments the glob names. 0.8.0 shipped
[0339](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
as the fix for this symptom and covered only globs written relative to a package root.

**What changes for you.** Under an ordinary checkout, nothing: the identity-relative path
is a suffix of the absolute path and `**` crosses any dot-free segment, so the third view
selects nothing the first did not — measured over every file of a fixture, not argued.
Under a checkout with a dot-segment above the repository root, globs that silently matched
nothing now match, so **a rule that was passing vacuously can start failing and a baseline
can gain entries.** That is the defect being fixed, and it is the reason this is declared a
break rather than a patch.

A **project-relative** glob (`'src/**'`) is deliberately unchanged: that spelling means
"relative to the project root", the project root is the tsconfig's directory, and giving it
a second root would make one glob name two different directories in a monorepo. Only the
`'**/'` spelling, which says "anywhere", reaches above the tsconfig.

The four sibling dialects are named at `minor` because they re-export the kernel and an
adopter may install one of them holding no range on `@nielspeter/eess` at all — a break
announced only where it happened would reach them as an inherited patch, under a changelog
reading "Updated dependencies". Nothing in their own behaviour changes.

**`PathUniverse` gains two required fields** — `identityRelativeFilePaths` and
`identityRelativeParentDirs` — and `viewsFor` returns them. Anyone materializing a
`PathUniverse` outside this repository must supply them. They are required rather than
optional on purpose: a view the matcher has and the universe lacks reports a working rule
as one that "can never match anything in this project".
