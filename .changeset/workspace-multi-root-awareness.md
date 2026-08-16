---
'@nielspeter/eess-ts': minor
---

`workspace()` now resolves per-package facts against each package's own root, not only the alphabetically-first (tie-break-winner) tsconfig's — plan 0148.

**Fixed (0.x — minor signals the behavior change, not a 1.0 stability claim):**

- **`workspace()` no longer silently applies one package's compiler options to every package.** `verbatimModuleSyntax` (read by cycle/erasure detection) is now tracked per package. Before this fix, a `beFreeOfCycles()`-style rule could report a real cycle as vanished for a non-primary package, or report a phantom cycle for one that had none — both silent, both wrong, both now corrected.
- **Project-relative globs now match against each file's own project root**, not only the workspace's tie-break-winner package (or, for `resideInFolder`/`resideInFile`/`havePathMatching`/slice `resolveByDefinition`/`onlyImportFrom`/`notImportFrom`/`dependOn`/`onlyBeImportedVia`, not at all — this was broken for single-tsconfig `project()` callers too). `resideInFolder('src/domain/**')` (no leading `**/`) previously matched nothing, silently; it now matches that folder at each package's own root.

**Migration:** if a rule using an unanchored, project-relative glob now selects more subjects or reports different violations than before, that's the fix working — the glob was previously matching nothing (or only the wrong package). If "anywhere in the project" was actually intended, anchor the glob with a leading `**/` instead.
