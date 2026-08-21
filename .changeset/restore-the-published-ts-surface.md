---
'@nielspeter/eess-ts': minor
---

Restores 20 exports the engine copy dropped from `@nielspeter/eess-ts`'s root,
two more it dropped from the `/presets` subpath, and the clean-run summary line
its CLI stopped printing.

**Breaking (@nielspeter/eess-ts)** — two names are gone for real and are not
coming back in this release: `GlobDiagnosis` and `diagnoseDeadGlobs`, whose
module (`core/dead-glob.ts`) was deleted rather than merely unexported. A named
import of either is a link-time error. Everything else listed below is restored,
so if you hit a missing export that is not one of those two, it is back.

On the `/presets` subpath: `dispatchRule` and `throwIfViolations`. The first
version of this changeset audited the root barrel only and told you that anything
missing other than the two below "is back" — which was false for those two, since
a named import from `@nielspeter/eess-ts/presets` is a link-time error. Found by
an adopter review that diffed every subpath rather than just `.`.

Restored values: `pathUniverse`, `diskSet`, `buildDiskSet`, `globSitesOf`,
`isDeadGlobTree`, `isDeadSite`, `emptyProjectAdvice`, `loadedNothing`,
`isTypeOnlyReExport`, `splitGlobArgs`, `validateOverrides`. Restored types:
`GlobFault`, `OnDisk`, `DiskSet`, `StrictFamilyFlag`, `Matcher`,
`CollectResult`, `BaselineFilter`, `DiffFilterLike`, `UntestedReason`.

`StrictFamilyFlag` is the sharpest of them: it lost its `export` keyword at the
definition site while `isStrictFamily()` and `resolveFlag()` — both exported —
keep it in their signatures, so the type was unnameable by anyone calling them.

**`eess-ts check` prints its denominator again.** A clean run had been emitting
zero bytes, so "20 rules passed" and "no rules loaded" looked identical. It now
prints `✓ eess-ts — N rules across M files · 0 failing (t)` to stderr on the
terminal path, as it did before. JSON and GitHub-annotation output on stdout are
unchanged.
