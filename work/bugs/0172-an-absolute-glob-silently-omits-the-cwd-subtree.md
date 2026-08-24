# Bug 0172: an absolute glob silently omits the cwd subtree (upstream)

## Status

- **State:** Draft — **eess is not currently affected**; see Blast radius. Filed
  so the trap is recorded before anyone adds glob-based loading.
- **Found:** 2026-08-20, while measuring the size-threshold distribution for
  [bug 0170](./fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md).

## Symptom

`tinyglobby` — used by `@ts-morph/common` for `FileSystemHost.globSync`, and so
by `Project.addSourceFilesAtPaths` — silently drops every match underneath
`process.cwd()` when given an **absolute** pattern. An absolute pattern should
not consult the working directory at all.

Minimal reproduction, four sibling packages each holding one `.ts` file:

```
pattern: <abs>/pkgs/*/src/**/*.ts

cwd=<abs>            4  [alpha, beta, js, ts]
cwd=<abs>/pkgs/alpha 3  [beta, js, ts]        <- alpha missing
cwd=<abs>/pkgs/ts    3  [alpha, beta, js]     <- ts missing
```

Measured against this repo through ts-morph, the same shape:

| cwd             | files loaded by `<abs>/packages/*/src/**/*.ts` |
| --------------- | ---------------------------------------------- |
| repo root       | 235 (all six packages)                         |
| `packages/ts`   | 109 — `ts`'s 126 files missing                 |
| `packages/core` | 186 — `core`'s 49 files missing                |

It fails **silently**: no error, no warning, just a smaller set. A rule run this
way reports a clean pass over two-thirds of a monorepo.

## Root cause

Not eess, and not ts-morph's own logic. `@ts-morph/common` passes the caller's
cwd straight through:

```js
globSync(patterns) {
  return tinyglobby.globSync(patterns, {
    expandDirectories: false,
    cwd: this.getCurrentDirectory(),
    absolute: true,
  })
}
```

`tinyglobby` then appears to treat the cwd subtree as already-covered and
excludes it. Confirmed to be the glob layer rather than ts-morph's: calling
`tinyglobby.globSync` directly with the same pattern and cwd reproduces it
exactly, while `fast-glob` given the same pattern returns all 235.

## Blast radius

- **eess's own gates: unaffected.** Nothing in `packages/*/src` calls
  `addSourceFilesAtPaths` or `globSync`. `project()` and `workspace()` load
  exclusively through `tsConfigFilePath` / `addSourceFilesFromTsConfig`, so the
  file set comes from the tsconfig and never from a glob.
- **Consumers: exposed only if they build their own project.** `ArchProject` is
  a public interface, so a user may hand eess a `ts-morph` `Project` they
  populated with `addSourceFilesAtPaths`. Run their check from a package
  subdirectory and that package silently leaves the corpus.
- **Contributors: exposed when measuring.** This is how it was found — an
  ad-hoc measurement script run while the shell sat in `packages/ts` reported a
  distribution computed over five of six packages.

## Fix

Nothing to change in eess today. If glob-based loading is ever added, resolve
patterns against an explicit root and pass that as `cwd`, rather than inheriting
`process.cwd()`. Worth reporting upstream to `tinyglobby`.

## Verification

- [ ] Report upstream with the minimal reproduction above.
- [ ] If glob loading is added to `project()`/`workspace()`, a test that globs
      from a subdirectory and asserts the full file count.

## Correction recorded

This was first reported — in conversation, with confidence — as "ts-morph's glob
silently drops a package directory named `ts`". That was **wrong**, and the
wrongness is instructive: every observation supporting it (`packages/*` dropping
`ts`, `{core,ts}` yielding only core) was produced from a shell whose cwd had
drifted into `packages/ts`. A synthetic reproduction using a directory named
`ts` did **not** reproduce, which should have settled it immediately and instead
was treated as a puzzle about the real repo.

The name was never the variable. The distinguishing test was to vary cwd rather
than to vary the name — `packages/core` disappears just as readily. A hypothesis
that survives only because the control was never run is the failure mode this
corpus keeps recording.
