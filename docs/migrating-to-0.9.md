# Migrating to 0.9

> Written for the release tagged `v0.9.0`. Check what you have with `npm ls @nielspeter/eess`.

| package                          | from  | to    |
| -------------------------------- | ----- | ----- |
| `@nielspeter/eess`               | 0.5.1 | 0.6.0 |
| `@nielspeter/eess-ts`            | 0.8.0 | 0.9.0 |
| `@nielspeter/eess-md`            | 0.7.0 | 0.8.0 |
| `@nielspeter/eess-mermaid`       | 0.4.1 | 0.5.0 |
| `@nielspeter/eess-gherkin`       | 0.4.0 | 0.5.0 |
| `@nielspeter/eess-crossvalidate` | 0.6.0 | 0.7.0 |

**Both changes are the same kind, and it is the same kind as 0.7's and 0.8's: a check that
matched nothing, and therefore passed, now matches.** No export is removed or renamed. What you
are likely to see is a build that was green reporting findings with your source untouched — and
that is the defect being fixed, not a regression.

The four sibling dialects move because they re-export the kernel, and a break announced only
where it happened would reach you as an inherited patch. **Nothing in their own behaviour
changes.**

## If you only read one thing

**0.8 did not finish the job it claimed.** Its migration page said a dot-segment in your
project's own path was handled. It was handled for a glob written relative to a package root,
and not for `'**/apps/api/src/**'` — the way a monorepo names one of its own packages. An
adopter upgraded to 0.8.0 intending to delete their dot-directory workaround, measured **61
selectors reporting themselves dead** in a dot-directory worktree against 0 in a plain one, and
kept the workaround. 0.9 is what they were waiting for.

## What to do

1. Upgrade, run your gates, and **read the new findings before you regenerate a baseline.**
   Regenerate first and you bake a vacuous pass in permanently.
2. If you kept a guard that refuses to run from a dot-directory checkout, **now you can delete
   it** — but read §1 first for the one case that is still not covered.
3. If you pass `.expectEmpty()` on a rule that now reports, delete that declaration rather than
   suppressing the finding.

## 1. A path glob can name segments above your tsconfig

A path glob is now tried against up to **three** spellings of each path, and matches if any does:

1. the **absolute** file path;
2. the path named from your **tsconfig's directory** — the "project root" (0.8);
3. the path named from your **repository root** — the nearest `.git` or workspace marker above
   the tsconfig — **for a `'**/'`-led glob only\*\* (new in 0.9).

The third exists because in a monorepo your rules run against one package's tsconfig, and
`'**/apps/api/src/**'` names segments that sit _above_ that package. Neither of the first two can
express it: the absolute path carries wherever the repository happens to sit on this machine, and
the tsconfig-relative path has `apps/api/` stripped off the front.

**A project-relative glob (`'src/**'`) is deliberately unchanged.** That spelling means "relative
to the project root", and giving it a second root would make one glob name two different
directories in a monorepo. If you mean the repository's, write `'\*\*/'`.

**Under an ordinary checkout this changes nothing**, and that is measured rather than argued: the
repo-relative path is a suffix of the absolute path and `**` crosses any dot-free segment, so the
third spelling selects nothing the first did not. It only ever recovers what a dot-segment
blocked.

**Still not covered:** a dot-segment _inside_ your project (`.storybook/`, `.generated/`). `**`
will not cross it in any spelling, because that directory is yours and naming it is your call.
Name the segment literally — `'.storybook/**'` works.

**One environment caveat.** The repository root is the nearest `.git`, else a workspace marker
(`pnpm-workspace.yaml`, `nx.json`, …), else the nearest `package.json`. A Docker build
(`.dockerignore` excludes `.git` in essentially every Node guide), a `git archive` tarball, or a
CI source artifact of a repo declaring no workspaces resolves the _package_ instead, and the third
spelling collapses onto the second. It is only ever additive, so nothing breaks — but a rule can
select differently in CI than locally, and that is the one way it can.

## 2. A dependency ban sees every package-manager layout

`notImportFrom('**/node_modules/knex/**')` — the spelling you reach for when you mean "this
package, however it is imported" — matched **nothing** under pnpm and Yarn's cache, and reported a
**pass**. No dot-directory checkout was involved: the dot segment is in the package manager's own
layout (`node_modules/.pnpm/…`, `.yarn/cache/…`) inside an ordinary tree.

Import globs are now matched with `dot: true`. You author your project's paths; you do not author
`node_modules`' layout.

**Two rules report LESS, and this page originally named only one of them.** Corrected
2026-09-29, after a retrospective review measured all six import-glob surfaces:

| rule                   | means                            | under pnpm / Yarn, since 0.9.0                                                             |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `onlyImportFrom(glob)` | "only these imports are allowed" | **allows more** — a dependency's internal `shared/` is now permitted where it was reported |
| `dependOn(glob)`       | "this module must import this"   | **reports less** — an import it previously could not see now satisfies the requirement     |

Both were always this permissive; those layouts were accidentally hiding it, and the fix
made every layout agree. But if you rely on a loose `onlyImportFrom` or `dependOn` glob,
**it enforces less than it did** — tighten it to name your own paths.

The other four surfaces (`notImportFrom` as a condition and as a predicate,
`onlyHaveTypeImportsFrom`, `importFrom`) report **more**, which is the fix working.

_Why this correction exists:_ the original text named `onlyImportFrom` alone because that was
the one measured. `dependOn` is the same inversion and was not. It shipped undeclared in
0.9.0 and is still present.

Measured, and this is the reason the change is right rather than merely convenient — before 0.9
the same rule gave different answers for the same dependency depending only on how `node_modules`
was laid out:

| layout             | verdict before 0.9 |
| ------------------ | ------------------ |
| hoisted npm / Yarn | allowed            |
| pnpm               | reported           |

## 3. If you build on the kernel

`PathUniverse` gains two **required** fields, `repoRelativeFilePaths` and
`repoRelativeParentDirs`, and `viewsFor` gains a **required** third parameter saying whether the
matcher reads them. Both are required rather than optional deliberately: a caller that forgets
would get the generous union, and a view the matcher has and the universe lacks reports a working
rule as one that "can never match anything in this project".

```ts
import { viewsFor } from '@nielspeter/eess/internal'
```

`viewsFor` ships from `@nielspeter/eess/internal`, so an external two-argument call no longer
typechecks. If you materialize a `PathUniverse` yourself, supply the two new fields.

## What this release does not fix

Worth knowing before you delete a workaround:

- **A cardinality rule still cannot tell "none exist" from "my selector broke."** A `.notExist()`
  rule whose selector silently stops matching reports nothing and exits 0 — it is exempt from both
  the dead-selector diagnosis and the evidence floor. Tracked, not fixed. A rule carrying
  `.expectEmpty()` **is** covered.
- **A glob naming a dot-segment inside your own project** — see §1.
- **A pnpm store outside the repository** (`~/.local/share/pnpm/store/…`) has no `node_modules`
  segment at all, so `'**/node_modules/<pkg>/**'` cannot match it on any setting. That is a
  spelling mismatch, not a gap: ban the bare specifier instead — `notImportFrom('knex')` matches
  the specifier and is unaffected by every layout above.
