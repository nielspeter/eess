# Plan 0148: Workspace multi-root awareness — per-root compiler options and project-relative globs

## Status

- **State:** Done — all three phases landed, a post-build multi-persona
  review found and this pass fixed real gaps (see the Post-build review
  punch list ledger entry and the Close section below), `npm run validate`
  green throughout. `relative-globs-are-uniform.test.ts` (ts-archunit's
  bug-0033/0037 regression suite) — the punch list ported all but the one
  row needing a preset (`atPath`) absent from eess (disclosed in the
  ported file's own docstring, not a whole-file skip as first drafted here).
  `workspace-has-no-single-root.test.ts` (the multi-root-specific regression)
  was ported in full and is the load-bearing proof.
- **Priority:** Medium — the defect it fixes is real and live in eess today (see
  Problem). Phase 1+2 (per-root compiler options) is `workspace()`-only, a
  secondary entry point. Phase 3 (project-relative glob matching) is NOT
  `workspace()`-only, corrected during review: confirmed via
  `git show HEAD:packages/ts/src/predicates/identity.ts` that
  `resideInFolder`/`resideInFile` had zero project-relative fallback for
  ANY caller before this plan, single-tsconfig `project()` included — an
  unanchored glob like `resideInFolder('src/domain/**')` matched nothing,
  full stop. Phase 3 fixes matching for `project()` callers too, not only
  `workspace()` ones.
- **Effort:** Medium — ~309 lines across two files in ts-archunit
  (`project-relative.ts` 220, `per-root-compiler-options.ts` 89), most of it
  already-understood algebra (`rootOf`/`relativeToRoot`/`registerProjectRoots`),
  plus wiring into eess's existing `workspace()` and every glob-matching
  predicate.
- **Created:** 2026-08-16

## Problem

`workspace([a, b, c])` (`packages/ts/src/core/project.ts:101`) builds **one**
ts-morph `Project` from the alphabetically-first tsconfig and then only _adds
files_ from the rest (`addSourceFilesFromTsConfig`, `project.ts:143`) — that
call adds files, not options. So `sourceFile.getProject().getCompilerOptions()`
answers for the tie-break winner's tsconfig, whatever package a given file is
actually in. This is confirmed live in eess's current code, not inherited from
ts-archunit's history: the exact shape ts-archunit's own bug 0058 ("a workspace
applies one package's compiler flag to all") fixed in its local history is
present in eess's `workspace()` today, unfixed.

Two concrete consequences, both already measured in ts-archunit before its fix
shipped:

1. **A per-package compiler flag silently applies to the wrong package.** Two
   fixtures differing only in `verbatimModuleSyntax`: the flag-`true` package's
   real import cycle vanished when loaded through `workspace()` (module-edges.ts's
   `usesVerbatimModuleSyntax()` — landed in plan 0147 Phase 3, Batch 10 — reads
   `sourceFile.getProject().getCompilerOptions()` directly, which is exactly the
   value this bug corrupts for every package but the tie-break winner), and
   forcing the opposite sort order gave the flag-`false` package a **phantom**
   cycle — one that reds CI with a remedy ("extract shared code to a lower-level
   module") that cannot remediate it, because there is nothing to extract.
2. **A project-relative glob only matches the tie-break winner's package,
   silently.** `resideInFolder('src/domain/**')` matches nothing outside the
   alphabetically-first tsconfig's directory in a multi-root workspace, with no
   error — the glob compiles, picomatch runs, and every other package's files
   are simply invisible to it. This is a live, present-day sibling of the same
   "unanchored glob only matches at the project root, silently" class plan
   0147's `glob-diagnosis.ts` (Phase 4, Batch 1) already detects and reports for
   the single-root case — but the multi-root case has no root to normalize
   against at all today, because eess has no concept of "which root does this
   file belong to."

Every deferral of `per-root-compiler-options.ts`/`project-relative.ts` across
plan 0147 (module-edges.ts's `usesVerbatimModuleSyntax`, dependency.ts's
`edgeCandidates`, predicates/module.ts's `importCandidatePaths`, `slice.ts`'s
`resolveByDefinition`, `models/slice.ts` bugs 0033/0035) is a symptom of this
one root cause: eess has no way to answer "which package does this file belong
to, and what compiler options apply to it" once `workspace()` has more than one
package. That part — the compiler-options bug (consequence 1 above) — really is
entirely a `workspace()` problem; `project()` is unaffected by it, by
construction (one tsconfig, one root, no tie-break to get wrong).

**Correction from code review, made honest here rather than silently:** the
same is NOT true of consequence 2. Project-relative glob matching
(`resideInFolder`, `resideInFile`, `havePathMatching`, slice
`resolveByDefinition`, and the dependency/reverse-dependency conditions) had
**no** relative-fallback matching for ANY caller before this plan — confirmed
directly against `git show HEAD`. A single-tsconfig `project()` user hit this
too: `resideInFolder('src/domain/**')` matched nothing, silently, with no
workspace involved. Phase 3 fixes this for `project()` callers as well as
`workspace()` ones — it is a strictly larger fix than "the workspace problem"
this section otherwise describes.

## Implementation phases

### Phase 1 — Port the root-registry algebra

Port ts-archunit's `project-relative.ts` (220 lines) minus the two pure
functions plan 0147 already extracted (`isAnchored`/`isProjectRelative`,
landed in `packages/core/src/project-relative.ts` and
`packages/ts/src/core/glob-diagnosis.ts` — Phase 4, Batch 2). What remains is
genuinely ts-morph-typed and belongs in `packages/ts/src/core/`:

- `rootsByProject: WeakMap<TsMorphProject, readonly string[]>` — every
  directory a project was loaded from, keyed on the ts-morph `Project` itself
  (not `ArchProject` — a predicate sees only an element, and
  `sourceFile.getProject()` is the one handle both a predicate and a future
  slice resolver can reach).
- `registerProjectRoots(tsMorphProject, tsConfigPaths)` — records the roots;
  called from `workspace()` (Phase 2).
- `rootFromTsConfigPath(tsConfigPath)` — the directory implied by one tsconfig
  path.
- `rootOf(sourceFile, fallbackTsConfigPath?)` — the registered root that
  **contains** this file, longest match first (a nested package's tsconfig
  must win over the repository's, or every file in it resolves against the
  outer root). Falls back to `sourceFile.getProject().getCompilerOptions()
.configFilePath` when nothing was registered (a test double or in-memory
  project, where `project()`'s single-tsconfig case is unaffected by
  construction — verify this fallback path is exercised by `project()`'s own
  existing tests before claiming parity).
- `relativeToRoot(sourceFile, absolutePath, fallbackTsConfigPath?)` — never
  `path.relative` (which emits `../../..` and encodes the root's depth,
  machine-dependent — the same mistake `path-universe.ts` already documents
  avoiding, per plan 0147 Phase 4 Batch 1).

### Phase 2 — Fix `workspace()`'s per-root compiler options

Port `per-root-compiler-options.ts` (89 lines) — per-root compiler facts keyed
by ts-morph project, today just `verbatimModuleSyntax` (the field
`module-edges.ts`'s `usesVerbatimModuleSyntax()` already reads incorrectly for
every non-primary package). Wire `workspace()` in `packages/ts/src/core/project.ts`
to:

1. Call `registerProjectRoots()` with every resolved tsconfig path (Phase 1).
2. Record each root's own `verbatimModuleSyntax` (and any other compiler
   option this module tracks) instead of only the primary config's.
3. Update `module-edges.ts`'s `usesVerbatimModuleSyntax(sourceFile)` — deferred
   in plan 0147 Phase 3 Batch 10 with exactly this note ("no
   `per-root-compiler-options.ts`/`project-relative.ts` dependency — that
   workspace-multi-root awareness is deferred") — to consult the per-root
   value instead of `sourceFile.getProject().getCompilerOptions()` directly.

A red-test-first regression: two fixture tsconfigs differing only in
`verbatimModuleSyntax`, loaded via `workspace()`, each producing the cycle
result its own flag implies — reproducing the "vanished cycle" /
"phantom cycle" pair ts-archunit measured before porting the fix, confirming
eess has the same defect today.

### Phase 3 — Project-relative globs in a workspace

Wire `rootOf`/`relativeToRoot` into every site plan 0147 named and deferred:

- `module-edges.ts`'s `candidatesFor()` call sites (`dependency.ts`'s
  `edgeCandidates`, `predicates/module.ts`'s `importCandidatePaths`) — thread
  the real `projectRoot` parameter (currently always `undefined`, per plan
  0147 Phase 3 Batch 10) using `rootOf(sourceFile)`.
- `models/slice.ts`'s `resolveByDefinition()` — bugs 0033/0035-class,
  project-relative slice-definition globs (plan 0147 Phase 3 Batch 12 deferred
  this specifically, pending this plan).
- `predicates/identity.ts`'s `resideInFolder`/`resideInFile` and
  `predicates/module.ts`'s `havePathMatching` — these already stamp
  `base: relative ? 'normalized' : 'absolute'` via `isProjectRelative()` (plan
  0147 Phase 4 Batch 2), but the actual MATCH against the normalized relative
  path isn't wired yet; only the glob's own dead-glob diagnosis consults
  `isProjectRelative()` today.

## Out of scope

- Anything plan 0147 already completed. This plan is additive on top of it.
- New engine features ts-archunit has gained since this plan's own measurement
  date (2026-08-16) — a moving upstream doesn't reopen it, matching plan
  0147's own exclusion.
- `owns-empty-discovery.ts` and the five deferred `diagnose()` finding kinds
  from plan 0147 Phase 4 — unrelated to workspace-root awareness.

## Test inventory

Every ported function carries its own ported/adapted test file, matching plan
0147's own discipline — not a "port code, backfill tests later" plan. The two
red-test-first regressions named in Phase 2 and Phase 3 reproduce eess's own
present-day defects before fixing them (per-package `verbatimModuleSyntax`
loss in `workspace()`; a project-relative glob silently scoped to the
tie-break-winner package only). `npm run validate` must stay green at the end
of every phase.

## Success definition

- `workspace()` no longer silently applies one package's compiler options to
  every package in it — verified by the red-test-first regression in Phase 2.
- A project-relative glob (`resideInFolder('src/domain/**')`) matches every
  package's own `src/domain`, not only the tie-break winner's.
- Every site plan 0147 deferred with "needs `project-relative.ts`" is
  reconciled: `module-edges.ts`'s `usesVerbatimModuleSyntax`, `dependency.ts`'s
  `edgeCandidates`, `predicates/module.ts`'s `importCandidatePaths`,
  `models/slice.ts`'s `resolveByDefinition`.
- `npm run validate` green throughout.

## Progress ledger

- [x] Phase 1 — port the root-registry algebra. Done, 2026-08-16. Ported
      `packages/ts/src/core/project-relative.ts` (`registerProjectRoots`,
      `rootFromTsConfigPath`, `rootOf`, `relativeToRoot` — re-exports the
      kernel's `isAnchored`/`isProjectRelative` rather than redefining them).
      Wired into the public surface for real (`packages/ts/src/index.ts`),
      not exclude-comment-suppressed — matching plan 0147 Phase 4 Batch 1's
      own explicit precedent against using `eess-exclude` for "no consumer
      yet" ("a different, less honest use of the mechanism" than its real
      purpose, declaration-emit necessity). Test coverage:
      `tests/core/project-relative.test.ts` (6 tests, including the
      longest-first nested-root pick against a real `zpkg` fixture) plus the
      ported `tests/fixtures/workspace-roots/` tree.
- [x] Phase 2 — fix `workspace()`'s per-root compiler options. Done,
      2026-08-16. Ported `packages/ts/src/core/per-root-compiler-options.ts`
      (`registerRootCompilerOptions`, `verbatimModuleSyntaxFor`). Wired
      `registerProjectRoots`/`registerRootCompilerOptions` into `workspace()`
      (`packages/ts/src/core/project.ts`) and switched
      `module-edges.ts`'s `usesVerbatimModuleSyntax` to call
      `verbatimModuleSyntaxFor` instead of reading
      `sourceFile.getProject().getCompilerOptions()` directly. Red-test-first
      regression ported from ts-archunit's own `workspace-per-package-options.test.ts`
      (`tests/core/workspace-per-package-options.test.ts`, 6
      tests, all four fixture pairs — `verbatim-module-syntax(-off)` and
      `zz-aa-verbatim-on`/`zz-bb-verbatim-off`, both tie-break orders):
      confirmed genuinely RED against eess's pre-fix code (the vanished
      cycle / phantom cycle / wrong `erasesModuleRequest` — 3 of 6 failing,
      exactly the shape the bug predicts), then GREEN after wiring. Full
      `npm run validate` green throughout (162 test files, 2174 tests).
- [x] Phase 3 — project-relative globs in a workspace. Done, 2026-08-16. Wired
      `rootOf`/`relativeToRoot` into all five deferred sites:
      `dependency.ts`'s `edgeCandidates` (now takes the importing
      `SourceFile` and threads `rootOf(sourceFile)` into `candidatesFor`, all
      5 call sites updated), `predicates/module.ts`'s `importCandidatePaths`
      (same threading) and `havePathMatching` (relative-fallback match, kept
      in `module.ts` — NOT relocated to `identity.ts` as ts-archunit's own
      history did; that relocation is an unrelated `no-single-glob-predicates`
      refactor, out of scope here), `predicates/identity.ts`'s
      `resideInFile`/`resideInFolder` (relative-fallback match added to
      their `test` functions, additive to the existing `globs:` metadata
      stamping from plan 0147 Phase 4), `models/slice.ts`'s
      `resolveByDefinition` (per-file `relativeToRoot` fallback, matching
      ts-archunit's bug-0033 fix). Ported `workspace-has-no-single-root.test.ts`
      (`tests/core/workspace-has-no-single-root.test.ts`, 10 tests) — bug
      0035's own regression suite, exercising `resolveByDefinition` and
      `resideInFolder` together against a real 2-package + 1-nested-package
      workspace; all pass. Adapted from ts-archunit's `.subjects()` builder
      idiom to this repo's own (predicates tested directly via `.test()`
      against `getSourceFiles()`, matching this repo's existing
      `workspace.test.ts` style — `.subjects()` does not exist here). Every
      pre-existing test for the four touched files (84 tests across
      `dependency.test.ts`, `module.test.ts`, `identity.test.ts`,
      `slice.test.ts`) still passes unchanged, confirming the relative-match
      fallback is strictly additive. Full `npm run validate` green (163 test
      files, 2184 tests).
- [x] Post-build review punch list. Done, 2026-08-16. A six-persona review
      (architect/enforcement/testing/product/customer/devops) found real gaps
      in the Phase 1-3 build above; this pass addressed them.
      **`rootOf` fail-closed fix (critical, coordinator).** `rootOf` fell
      through to the tie-break-winner's root — a specific, wrong, plausible
      answer — for a file inside a real `workspace()` that wasn't under any
      registered package root (a shared root-level file, a broad
      `include`/`references`). Now returns `undefined` once roots are
      registered and none contains the file, per ADR-009. Red-test-first:
      a new `project-relative.test.ts` case builds a real `workspace()`,
      adds an out-of-root source file, confirmed it resolved to `alpha`'s
      root pre-fix, `undefined` post-fix; sabotage-reverted and
      re-confirmed red.
      **`havePathMatching` was missing its relative-fallback wiring
      entirely**, despite the entry above claiming it was "kept in
      `module.ts`" — `relativeToRoot` was imported but never called inside
      it. Found and fixed during the docs pass (the doc fix couldn't
      honestly describe behavior that didn't exist). Matches the same
      pattern already used by `resideInFile`/`resideInFolder`.
      Test coverage was added for the previously-untested `dependency.ts`
      (`edgeCandidates`, backing `onlyImportFrom`/`notImportFrom`/`dependOn`)
      and `predicates/module.ts` (`importCandidatePaths`, backing
      `importFrom`/`notImportFrom`) wiring — confirmed by review to have
      zero regression coverage (reverting either site left the full suite
      green). `onlyBeImportedVia` (`conditions/reverse-dependency.ts`) had the
      identical bug class, live and unfixed, never touched by Phase 3 —
      ported ts-archunit's own fix (`relativeToRoot` fallback against the
      importer's path). Stale docs were corrected: `workspace()`'s own
      JSDoc, `docs/getting-started.md`, `resideInFile`/`resideInFolder`/
      `havePathMatching`'s docstrings, and `import-candidates.ts`'s "always
      undefined" comment (now false — `dependency.ts`/`module.ts` both
      thread `rootOf(sourceFile)`). This plan's own Problem/Priority claim
      that `project()` is "unaffected" was corrected — confirmed via
      `git show HEAD` that Phase 3's glob-matching fix benefits `project()`
      callers too, not only `workspace()` ones (project-relative matching
      was broken for everyone before this plan). Filed
      `.changeset/workspace-multi-root-awareness.md` (minor,
      `@nielspeter/eess-ts`) — `check:release` was previously green only by
      crediting an already-consumed, unrelated changeset from the prior
      plan-0088 release. `ROADMAP.md`'s board row was synced from `Draft`
      to `Ready`.
      Not addressed by this pass, deliberately: `importFrom`/`notImportFrom`'s
      relative-candidate matching is not gated per-glob by `isProjectRelative`
      the way the identity/module path predicates are — confirmed this matches
      ts-archunit's own upstream `candidatesFor`/`edgeCandidates` design
      (unconditional once a root is known), not an eess-introduced deviation;
      left as-is rather than diverging from the reference implementation
      without further design work. `notImportFrom`/`dependOn`'s missing
      `recordEdgeCoverage` nonvacuity disclosure (unlike sibling
      `onlyImportFrom`) is a pre-existing, orthogonal gap, not caused by this
      plan — left for a separate bug/plan rather than folded in here.

## Close

Deferred: none. Dropped on purpose, not deferred to a home: `importFrom`/
`notImportFrom`'s ungated relative-candidate matching (confirmed at review
time to match ts-archunit's own upstream design, not an eess deviation —
revisiting it is a design question independent of this plan, not a defect
this plan introduced); `notImportFrom`/`dependOn`'s missing
`recordEdgeCoverage` nonvacuity disclosure (a real, pre-existing gap
relative to sibling `onlyImportFrom`, but orthogonal to workspace
multi-root awareness — not filed as its own bug given its scope, recorded
here instead of silently absorbed).
