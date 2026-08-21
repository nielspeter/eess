/**
 * Family architecture rules for the eess monorepo (plan 0089) — the
 * standalone-sufficiency invariant, as eess-ts rules (ADR-006: rules are
 * code). Complements `arch.rules.ts`'s dialect-isolation rules with the one
 * thing they don't cover: re-export completeness — a user installing only
 * one sibling dialect must get everything that dialect's own code needs,
 * with no second, direct `@nielspeter/eess` install.
 *
 * Ships exactly one rule, `family/re-export-complete`. An earlier draft
 * also carried `family/{md,mermaid,gherkin}-isolated` and
 * `family/kernel-purity` — byte-for-byte duplicates of `arch.rules.ts`'s own
 * `eess/{md,mermaid,gherkin}-isolated` / `eess/kernel-no-dialects`, scanning
 * the identical import graph a second time under a second rule ID for zero
 * net new coverage (both wired into `check:fast`, so the cost was paid
 * twice on every fast run). Found in review and removed — `arch.rules.ts`
 * already states the family's isolation/purity invariants; this file's own
 * job is only the half `arch.rules.ts` doesn't have.
 *
 * Run with the eess-ts CLI: `npx eess-ts check family.rules.ts` (or
 * `npm run check:family`).
 */
import { workspace, modules, or, and, not, resideInFile } from '@nielspeter/eess-ts'
import { reExportsWhatBodyUsesWithAllowlist } from './scripts/lib/family-re-exports.mjs'

const p = workspace([
  'packages/core/tsconfig.build.json',
  'packages/ts/tsconfig.build.json',
  'packages/mermaid/tsconfig.build.json',
  'packages/md/tsconfig.build.json',
  'packages/gherkin/tsconfig.build.json',
  'packages/crossvalidate/tsconfig.build.json',
])

// Every sibling's own src/index.ts — one barrel entry point per package.
const SIBLING_INDEXES = '**/packages/{ts,md,mermaid,gherkin}/src/index.ts'
// crossvalidate ships NO index.ts (verified at plan 0089's freeze: 8 flat
// files, no subfolders) — one file per package.json `exports` subpath
// instead, each independently a public entry point. `it-title.ts` is the
// one file NOT in that exports map (an internal helper the others import).
const CROSSVALIDATE_ENTRIES = '**/packages/crossvalidate/src/*.ts'
const CROSSVALIDATE_INTERNAL = '**/packages/crossvalidate/src/it-title.ts'

export default [
  // Each dialect's public entry point(s) re-export what their own bodies
  // import from the kernel — the re-export-completeness guard. The
  // per-dialect allowlist (scripts/lib/family-re-exports.mjs's own
  // ALLOWLIST) is explicit: eess-ts's index deliberately does NOT re-export
  // the KERNEL's `correspondence` / `CorrespondenceBuilder` / `matchSelections` /
  // `applyFixes` (they serve crossvalidate/md, and matchSelections backs
  // eess-ts's own cross-layer builder), while crossvalidate's own entry
  // points MUST re-export them — it has no allowlist entry at all.
  //
  // "the KERNEL's" is load-bearing and was added after PR #72's review. eess-ts
  // grew its OWN project-scoped primitive, and it was called `correspondence`
  // too — so this allowlist, written to mean "eess-ts has no correspondence",
  // silently permitted "eess-ts has a DIFFERENT correspondence", and the gate
  // could not see the shadowing because it asks about re-export completeness,
  // not about single implementation. The eess-ts primitive is `crossProject` /
  // `CrossProjectBuilder` now, so the two no longer collide by name. Nothing
  // here would catch it if they did again — that gate is plan 0188 Phase 3.
  modules(p)
    .that()
    .satisfy(
      or(
        resideInFile(SIBLING_INDEXES),
        and(resideInFile(CROSSVALIDATE_ENTRIES), not(resideInFile(CROSSVALIDATE_INTERNAL))),
      ),
    )
    .should()
    .satisfy(reExportsWhatBodyUsesWithAllowlist())
    .rule({
      id: 'family/re-export-complete',
      because:
        'a standalone consumer of one dialect must never need a second, direct @nielspeter/eess install',
    }),
]
