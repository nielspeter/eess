---
'@nielspeter/eess-ts': minor
---

An import glob sees every package-manager layout (bug 0349)

**Breaking (@nielspeter/eess-ts):** import globs now match across dot segments in a
resolved path, so a rule can report imports it used to miss — and an **allowlist**
can permit imports it used to report.

`notImportFrom('**/node_modules/knex/**')` is the spelling for "this package,
however it is imported". It matches the resolved target path, and picomatch's
default stops `**` crossing a segment beginning with `.` — so under pnpm
(`node_modules/.pnpm/knex@3/node_modules/knex/…`) and Yarn's cache
(`.yarn/cache/knex-npm-3/…`) it matched nothing and reported a **pass**. No
dot-directory checkout was involved; the dot segment is the package manager's own
layout inside an ordinary tree, and this was true on every released version.

The fix is one matcher, `importTargetMatcher`, used by all six import-glob sites.

## Why this is safe where the same change was rejected for source globs

[Bug 0339](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
weighed `{ dot: true }` for path globs generally and rejected it: it would change
which of **your own** files a rule reads, so `'**/*.ts'` would start matching
`.nuxt/` content. That rejection stands and is untouched — this change is confined
to import targets.

You author your project's paths. You do not author `node_modules`' layout. And
measured, the current behaviour is not safely strict, it is **inconsistent by
package manager**: `onlyImportFrom('**/shared/**')` against a dependency's internal
`shared/` directory _allows_ that import under a hoisted npm tree and _reports_ it
under pnpm. Same rule, same code, same dependency, different verdict — which is the
defect 0339 is named for, one population over.

## What you may see on upgrade

_A dependency ban starts working._ If you ban by path and use pnpm or Yarn's cache,
rules that reported nothing now report. Each is an import you had already asked to
be told about.

_An allowlist may permit more, under pnpm and Yarn only._ `onlyImportFrom` matching
across dot segments brings those layouts in line with what npm already did. **A
loose allowlist glob was always this permissive — pnpm was accidentally hiding
it.** If `onlyImportFrom('**/shared/**')` was your intent, consider naming the
package or the folder from the project root instead, so it cannot match a
dependency's internals on any layout.

_Nothing changes for a bare-specifier ban._ `notImportFrom('knex')` matches the raw
specifier, never a path, and is unaffected on every layout.
