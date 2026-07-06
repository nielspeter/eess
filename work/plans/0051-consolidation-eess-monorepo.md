# Plan 0051: Consolidation — `eess` Monorepo

## Status

- **State:** BUILDABLE SCOPE COMPLETE — all offline/code work done and validated on branch `eess-consolidation` (2026-07-03, ~18 commits ahead of main; **not merged, nothing published**). The only remainder is the external cutover, which the user has gated behind: _all EESS plans (0051 + 0058 + 0059) complete and confirmed as a full ts-archunit replacement_. See "Execution status" below.
- **Priority:** P1 — gates 0058/0059 work on the MD dialect, cross-validation, workflows
- **Updated:** 2026-07-03 — work order reordered: MD dialect promoted ahead of cross-validation, based on field evidence from an external repo and another internal repo (see plan 0058, "Why this jumps the queue"). Follow-on plans renumbered: the 0052/0053/0054 forward references written here originally were never allocated as files, and 0055–0057 were taken in the meantime — MD dialect is now **0058**, cross-validation **0059**, workflow dialect unnumbered until scheduled. All four open questions decided (workspace tool, versioning, repo name, unscoped npm name) — plan is decision-complete. See "Decisions & open questions".
- **Effort:** 1–2 weeks for the structural move; cross-validation is a follow-on plan (0059)
- **Created:** 2026-05-09
- **Depends on:** Nothing technically; conceptually depends on the EESS manifesto (`docs/manifesto.md`) and the calculator walkthrough (`docs/eess-walkthrough-calculator.md`).

## Execution status (2026-07-03)

Executed on branch `eess-consolidation`. Every step below was verified green
(build + typecheck + lint + format + full test suite) before committing.

**Final layout shipped:** `@nielspeter/eess` (`packages/core`, kernel, zero deps) ·
`@nielspeter/eess-ts` (`packages/ts`) · `@nielspeter/eess-mermaid`
(`packages/mermaid`) · `@nielspeter/ts-archunit` (`packages/ts-archunit`, alias).
Tests: **1910 eess-ts + 91 mermaid, all passing.**

| Phase                                        | Status         | Notes                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Repo restructure + kernel extraction** | ✅ done        | npm workspace; `src`+`tests`→`packages/ts`; kernel extracted per the file-by-file map. Two couplings resolved generically: `RuleBuilder<T>`→`RuleBuilder<T, P = unknown>`; combinators `TypeMatcher`→kernel `Matcher<V>`. `violation.ts` split (interface→kernel, Node adapters→ts). Alias verified: 12/12 entry points byte-identical. |
| **2 — Move typed-mermaide in**               | ✅ done (code) | `eess-mermaid` consumes the shared kernel; 19 dup kernel files dropped (drift minimal — eess is a superset). ⏸ archiving the typed-mermaide GitHub repo is external — deferred.                                                                                                                                                         |
| **3 — Publishing pipeline**                  | ◑ tooling done | changesets configured (independent versioning, public access). ⏸ authoring the release changeset, the `eess-ts` version decision (kept 0.12.0), converting the tag-based `publish.yml`, and the actual publish all need `npm login` — deferred.                                                                                         |
| **4 — Docs + repo metadata**                 | ◑ docs done    | Family root README, per-package READMEs, LICENSEs, CHANGELOG entry, CLI rebrand. ⏸ GitHub repo rename `ts-archunit`→`eess` + optional docs site are external — deferred.                                                                                                                                                                |
| **5 — Internal artifact updates**            | ◑ mostly done  | Calculator walkthrough + plans 0049/0050 imports → `@nielspeter/eess-ts`. `examples/*` and `docs/*.md` left on the old name (still resolve via the alias) — low priority.                                                                                                                                                               |

**Done beyond the original plan (hardening):**

- **CI build-order bug fixed.** CI (and `validate`/`release`) ran typecheck/test
  before build → would have failed on a fresh checkout (dialects need the kernel's
  built `dist`). Build now runs first everywhere; CI also triggers on the
  `eess-consolidation` branch. Proven green from a clean dist-less state.
- **Two Phase 1 guardrails implemented** (`scripts/check-workspace-integrity.mjs`,
  `npm run check:integrity`, wired into CI): phantom-dependency check (each
  package's `src` imports only builtins/own-name/declared-deps — kernel purity for
  free) and local-linking check (`@nielspeter/eess*` must be `packages/` symlinks).
  It **caught a real bug**: `eess-mermaid`'s CLI imported `jiti` at runtime but only
  devDep'd it (inherited from typed-mermaide) — would break on standalone install;
  moved to `dependencies`.
- **Pack-and-install smoke test — passed.** `npm pack`'d all four packages and
  installed the tarballs into a clean project outside the workspace (real dirs, not
  symlinks). Verified from the published artifacts: all entry points import; alias
  byte-identical (233 exports); a TS rule catches an `eval()` violation end-to-end;
  the mermaid parser + rule engine fire with a code-frame; all three CLI bins
  (incl. the alias shim) run. (Throwaway — not committed.)

**Not done, by design:** a _dogfooded_ eess-ts `arch.rules.ts` — the integrity
script covers the phantom-dep/purity function robustly; dogfooding eess on the
monorepo's internal layering is a possible later demonstration, not a gap.

**Everything external (publish, GitHub rename, typed-mermaide archive, claim
`eess`) is parked** until 0058 + 0059 land and the family is confirmed as a full
ts-archunit replacement.

## Problem

ts-archunit and typed-mermaide already share ~90% of the same kernel — `RuleBuilder<T>`, `Predicate<T>`, `Condition<T>`, formatters, exclusions, code-frame, baseline interfaces, all generic over element type. The kernel was copied across two repos when typed-mermaide was started, and the `fromDiagram` bridge function in typed-mermaide is a workaround for the artificial split.

The EESS framing makes the structural problem sharper:

- The manifesto explicitly says **artifacts are siblings, not hierarchical** — TS, Mermaid, MD, workflows all sit on equal footing, validated by one engine, cross-validated against each other.
- Today the architecture says the opposite: ts-archunit is the brand, mermaidunit was a smaller second tool, and any merge that absorbs Mermaid into ts-archunit privileges the TS dialect over its siblings.
- The tool that says _"neither side is privileged in isolation"_ would itself be built so one dialect owns the kernel and the others are tenants. The medium contradicts the message.

The fix is to **extract the kernel as the parent**, treat dialects as siblings around it, and rebrand the family under a name that doesn't lock to any single dialect.

## Brand decision: `eess`

Picked `eess` (Executable Enforceable Specification System). Reasoning recorded so the call doesn't have to be re-litigated:

- The manifesto's term. No invention cost. The category and the brand reinforce each other.
- Pronounceable ("ease" / "peace"), not an opaque consonant cluster.
- Distinctive in the dev-tooling space (no live ESLint/Vite-tier conflict).
- npm `eess` and `@nielspeter/eess` both available at time of plan writing.
- GitHub `eess` org is dormant placeholder (zero repos since 2016) — no community footprint to compete with. Use `nielspeter` or `eess-system` org for the project home.
- ECMAScript-version conflict considered (`ES2015`/`ES2024`) — doesn't apply to `eess` (different shape). It does apply to `es2`, which was rejected.

Tagline: **"Specifications you can run."** Long form: "Executable Enforceable Specification System."

`eess` is the **brand and category name**. Each dialect is `eess-<dialect>`. The full description ("an executable enforceable specification system") goes in README, talks, and docs — never in import paths.

## Goals

1. Extract the generic kernel from ts-archunit into its own package.
2. Move both dialects (TS, Mermaid) into sibling packages under one monorepo, depending on the kernel.
3. Preserve the existing `@nielspeter/ts-archunit` install and import surface so current users see no breakage.
4. Set up the layout so future dialects (Markdown, workflows) and the cross-validation primitive can land as additional sibling packages without restructuring.

## Non-goals

- **Markdown dialect.** Plan 0058. Ships as `@nielspeter/eess-md`. First dialect after consolidation — two production repos already hand-rolled it and the copies are drifting.
- **Cross-validation primitive.** Plan 0059. Ships as `@nielspeter/eess-crossvalidate` once the kernel and the MD dialect exist.
- **Workflow dialect.** Future plan (numbered when scheduled). Lower priority; only if user demand emerges.
- **Full rebrand of `@nielspeter/ts-archunit` to `@nielspeter/eess-ts`.** A soft alias keeps the old name working; the new name is added. Hard rename is a 1.0 concern.
- ~~**Renaming the GitHub repository.**~~ No longer a non-goal: decided 2026-07-03 — the repo **is renamed to `eess`** during Phase 4 (see "Decisions & open questions"). GitHub auto-redirects, so the cost originally avoided here turns out to be negligible.
- **`recommended()` preset (plan 0049) and `init` CLI (plan 0050).** Independent of consolidation; can ship before, after, or alongside.

## Package layout

```
@nielspeter/eess (monorepo root)
├── packages/
│   ├── core/                      # kernel — pure, dialect-independent
│   │   • Predicate<T>, Condition<T>, RuleBuilder<T>
│   │   • baseline, formatters, exclusions, code-frame
│   │   • definePredicate, defineCondition for advanced users
│   │   published as: @nielspeter/eess
│   │
│   ├── ts/                        # TS dialect (current ts-archunit)
│   │   • project, classes, functions, modules, types, slices, calls, within
│   │   • body-analysis matchers (call, access, newExpr, ...)
│   │   • all current standard rules
│   │   published as: @nielspeter/eess-ts
│   │
│   ├── mermaid/                   # Mermaid dialect (current typed-mermaide)
│   │   • diagram(filePath), parse(string)
│   │   • classes, edges, stereotypes
│   │   • Langium grammar + generated AST
│   │   published as: @nielspeter/eess-mermaid
│   │
│   └── ts-archunit/               # ALIAS for @nielspeter/eess-ts
│       • Pure re-export. Preserves existing install + import surface.
│       • Keeps `import { classes, project } from '@nielspeter/ts-archunit'` working.
│       • Will be deprecated (not removed) in 1.0+ of the new family.
│       published as: @nielspeter/ts-archunit (continues current versioning)
```

Dependency graph:

```
@nielspeter/ts-archunit  →  @nielspeter/eess-ts  →  @nielspeter/eess
@nielspeter/eess-mermaid                          →  @nielspeter/eess
```

The kernel package has zero dependencies on any dialect. Each dialect depends on the kernel and on its specific parser (ts-morph for TS, langium for Mermaid). Future dialects will follow the same shape.

### Why a separate alias package for `@nielspeter/ts-archunit`?

Two options were considered:

1. **Keep `@nielspeter/ts-archunit` as the canonical TS dialect.** New users are told to use `ts-archunit`, but the manifesto's framing ("eess as the family") then doesn't show in the install command they actually type.
2. **Publish two names — `@nielspeter/eess-ts` (canonical) and `@nielspeter/ts-archunit` (alias).** New users discover the family naming; existing users see no churn. Adopted.

Option 2 keeps both names valid forever (until a real 1.0 rename, if ever). Cost is one extra published package that re-exports the canonical one — tiny.

## Migration story

### Existing ts-archunit users

Zero forced action. Their `import { project, classes } from '@nielspeter/ts-archunit'` continues to resolve. The package is now a thin re-export of `@nielspeter/eess-ts`; behavior is identical.

CHANGELOG entry for the version that ships the consolidation:

```markdown
### Notice

`@nielspeter/ts-archunit` is now part of the `eess` family. The package
is unchanged — your imports continue to work. New projects should
prefer `@nielspeter/eess-ts` directly. See [eess.dev] for the family
overview.
```

### typed-mermaide users

Pre-1.0 with no known external consumers. The repo is archived after the move with a README pointing at `@nielspeter/eess-mermaid`. CHANGELOG note explains the rename and shows the import migration. No alias package needed (no installed-base to preserve).

### Internal users (the calculator walkthrough, our own arch.rules.ts files)

Update imports to the new package names as part of the consolidation PR. No external impact.

## Implementation phases

### Phase 1 — Repo restructure (~3 days)

1. Convert ts-archunit repo to a monorepo using **npm workspaces** (decided — see "Decisions & open questions"). The current `src/` becomes `packages/ts/src/`. Add the two npm-workspace guardrails in the same step:
   - **Phantom-dependency arch rule** (dogfooded): each package may only import packages its own `package.json` declares — npm's hoisting otherwise lets `packages/md` silently use a dep only `packages/ts` declares, which breaks on standalone install.
   - **Local-linking CI check**: assert every `@nielspeter/eess*` dependency resolves inside the workspace, not from the registry — npm has no `workspace:` protocol, so a lagging version range silently installs the published kernel instead of linking the local one.
2. Extract kernel per the extraction map below (produced 2026-07-03 from the real
   ts-morph dependency graph). Move the generic pieces into `packages/core/`; keep
   dialect-specific pieces in `packages/ts/`.

   **Extraction map — `src/core/` (24 files):**

   The boundary is file-by-file, not a directory move. 19 files are clean of
   ts-morph and go to the kernel; 5 are ts-morph-coupled and stay in the TS dialect;
   `violation.ts` splits.
   - **→ kernel (`packages/core`), clean of ts-morph:** `ansi`, `check-options`,
     `code-frame`, `combinators`, `condition`, `define`, `environment`, `errors`,
     `exclusion-comments`, `execute-rule`, `format`, `format-github`, `format-json`,
     `predicate`, `rule-builder`, `rule-description`, `rule-metadata`,
     `silent-exclusion`, `terminal-builder`. (New kernel `index.ts` re-exports these.)
   - **stays in TS dialect (`packages/ts`), imports ts-morph:** `project.ts` (the
     ts-morph `Project` wrapper), `type-matcher.ts`, `import-options.ts`,
     `pair-condition.ts` (also imports `models/`).
   - **`violation.ts` SPLITS** — this is the one surgical file:
     - `ArchViolation` interface → **kernel** (verified pure: only strings/numbers,
       imports just `code-frame`). It is the central data type — 49 files import it,
       so it must live in the kernel or the whole dependency graph inverts.
     - `getElementName/File/Line(node)` + node-based `createViolation(node, …)` →
       **TS dialect** (these are the ts-morph adapters that build an `ArchViolation`
       from a `Node`). Each dialect gets its own element→violation adapter.

   **From `src/helpers/`:** `baseline.ts`, `baseline-generator.ts`, `diff-aware.ts`,
   `code-frame` (already in core) → kernel (all clean; baseline machinery is generic
   over element type). The AST-specific helpers (`body-traversal`, `matchers`,
   `type-matchers`, `slice-graph`, `tarjan`, `complexity`, `callback-extractor`,
   `within`, `pattern`) stay in `packages/ts`.

   **`src/conditions/`, `predicates/`, `builders/`, `models/`, `rules/`, `smells/`,
   `presets/`, `graphql/`, `cli/`:** all TS-dialect — stay in `packages/ts`.

   **Kernel acceptance criteria (make the boundary mechanical, not judgment):**
   `packages/core` must (a) not depend on `ts-morph` or `picomatch` in its
   `package.json`, (b) have zero `from 'ts-morph'` imports, and (c) have its tests
   pass with no TypeScript fixture project loaded. Any file that can't meet these is
   dialect, not kernel.

3. Set up `packages/ts-archunit/` as a re-export alias of `packages/ts/`. Verify the **entire exports map**, not just the root: `/helpers`, `/rules/*`, `/presets`, `/graphql` subpaths must all resolve identically — the root re-export is trivial, the subpath mirror is where an existing install (e.g. an external repo on `^0.9.0`) would silently break.
4. CI passes against the existing test suite (no test changes expected; only import paths inside packages might shift).

### Phase 2 — Move typed-mermaide in (~2 days)

5. Copy typed-mermaide source into `packages/mermaid/`. Update its imports to consume `@nielspeter/eess` instead of its local kernel copy.
6. Drop typed-mermaide's duplicated kernel (now redundant).
7. Run typed-mermaide's tests against the consolidated repo. Fix any drift.
8. Archive `typed-mermaide` GitHub repo with a redirect README.

### Phase 3 — Publishing pipeline (~1 day)

9. Set up multi-package publishing with **changesets, independent versioning** (decided — see "Decisions & open questions"). Empty `linked`/`fixed` groups (no lockstep); per-package changelogs; let changesets propose dependent dialect releases when a kernel bump moves their pinned range.
10. Coordinate the first release: `@nielspeter/eess@0.1.0`, `@nielspeter/eess-ts@0.1.0`, `@nielspeter/eess-mermaid@0.1.0`, and the alias bump of `@nielspeter/ts-archunit` (next minor above whatever is current at landing time — 0.12.0 as of 2026-07-03).
11. Verify all four packages install cleanly from a fresh project.

### Phase 4 — Docs + repo metadata (~2 days)

12. **Rename the GitHub repo `ts-archunit` → `eess`** (decided — see "Decisions & open questions"). GitHub auto-redirects clones, links, and badges. Update `repository` fields, docs links, and badges to the new URL. (A possible later move to an org home is a _transfer_, which also preserves redirects — separate decision, not this plan.)
13. Update README at the repo root to introduce eess as the family, name each package, and point to per-package docs.
14. Per-package READMEs.
15. Update or create eess.dev (or similar docs site) — at minimum a one-page index of the family.
16. Update package.json metadata (homepage, keywords, repository fields per package).
17. Update or write top-level CHANGELOG.

### Phase 5 — Internal artifact updates (~1 day)

18. Update calculator walkthrough imports to use `@nielspeter/eess-ts` and `@nielspeter/eess-mermaid` (the new canonical names) — model the recommended adoption pattern.
19. Update the manifesto's example code blocks to match the new package layout.
20. Update plans 0049 and 0050 to reference the new package names where they currently say `@nielspeter/ts-archunit`.

## Decisions & open questions

### Decided (2026-07-03)

1. **Workspace tool: npm workspaces.** Consistent with ADR-001 — no new toolchain
   for contributors or CI; every existing command and the release process stay npm.
   Four packages with a trivial dependency graph (three dialects → one kernel) get
   nothing from pnpm's scale advantages. npm's two real weaknesses are mitigated as
   Phase 1 guardrails: **phantom dependencies** from hoisting are gated by a
   dogfooded arch rule (each package imports only what its own `package.json`
   declares), and the **no-`workspace:`-protocol footgun** (a lagging version range
   silently installing the published kernel instead of linking the local one) is
   gated by a CI check that all `@nielspeter/eess*` deps resolve inside the
   workspace. Revisit only if the package count grows well past a handful or a
   phantom dep escapes to a release despite the rule.

2. **Repo: rename `ts-archunit` → `eess` in place — not a new repo.** A fresh repo
   would create a window where the TS dialect lives in two live repos — the exact
   copy-drift failure mode (typed-mermaide, an external repo scripts) this plan exists to end.
   Renaming preserves what a new repo abandons: GitHub redirects for clones/links/
   badges, issues, PRs, stars, release tags v0.1.0+, npm `repository` provenance,
   and the plans/ADR/spec institutional memory. The clean slate a new repo seems to
   offer is achieved anyway — restructure on a branch (Phase 1), fresh family README
   (Phase 4). If an org home (`eess-system` or similar) is wanted later, that is a
   _transfer_ (which also preserves redirects), decided separately. Rename executes
   in Phase 4, step 12.

3. **Versioning: independent per package, via changesets.** The kernel and the
   dialects move at different speeds by design — the kernel should get boring and
   stable while dialects iterate — so lockstep would force a kernel version bump
   every time `eess-md` ships a patch, and vice versa, inflating the changelog with
   no-op bumps and making "what actually changed in the kernel?" unanswerable from
   the version alone. Independent versioning keeps each package's semver honest: a
   consumer pinning `@nielspeter/eess@^0.3` isn't dragged forward by dialect churn.
   Changesets is the tool — it handles independent versioning, works with npm
   workspaces (decision 1), generates per-package changelogs, and models the
   dependency graph so a kernel bump correctly proposes dialect releases when their
   pinned range needs to move (which also feeds the local-linking guardrail from
   decision 1). Set `linked`/`fixed` groups to empty — no forced lockstep. The one
   coupling to respect: a **breaking** kernel change fans out to dialect major bumps;
   changesets surfaces that at release time rather than hiding it. Configured in
   Phase 3, step 9.

4. **Claim the unscoped `eess` npm name: yes (not yet executed).** Confirmed
   available (npm 404) as of 2026-07-03. Publish deferred — will file a placeholder
   (version `0.0.1`, README pointing at the scoped `@nielspeter/eess-*` packages) to
   block squatters when convenient; blocked only on npm auth, not on any dependency.
   The real packages stay scoped; the unscoped name is defensive only. Can be done
   independent of the rest of Phase 3.

_All open questions resolved. Plan 0051 is decision-complete and ready to schedule._

## Out of scope (recap)

- Cross-validation primitive (plan 0059).
- Markdown dialect (plan 0058).
- Workflow dialect (future plan, only if demanded).
- Hard rename / removal of `@nielspeter/ts-archunit` (1.0 concern, possibly never).
- Repo-rename of `typed-mermaide` (just archive).
- Changes to the rule-builder DSL surface — strictly mechanical extraction, no API redesign.

## Strategic note

This plan is the gate that unlocks every other EESS-flavored plan. Cross-validation, the Markdown dialect, executable-ADR compilation, and downstream EESS work all want the kernel to be a separately installable package. Without consolidation, every new dialect either re-copies the kernel (the typed-mermaide failure mode) or tunnels through ts-archunit (the wrong shape). Land 0051 first.

After consolidation, the work order becomes (reordered 2026-07-03 — 0058 promoted ahead of 0059):

1. **0051** — this plan; the structural move.
2. **0058** — Markdown dialect (`@nielspeter/eess-md`). Promoted: it has proven field demand — the same validator scripts (link graph, code pointers, tiered ADR enforcement) were hand-built in another internal repo, copied into `an external repo/tools/`, and are drifting; a published dialect package ends the per-repo copy/paste. an external repo is customer zero. Ships text-level citation checks that seed 0059.
3. **0059** — cross-validation primitive (`@nielspeter/eess-crossvalidate`). Ships the unique product capability. First cross-check: upgrade the MD→TS test-citation tie from 0058 to AST-grounded, then Mermaid↔TS; also the embedded-Mermaid-block composition (MD fenced blocks handed to the Mermaid dialect).
4. **Workflow dialect** — future plan, numbered when scheduled (only if user demand emerges).
5. **Executable ADR compilation** — small CLI helper that reads `## Enforcement` sections from ADRs and emits rule stubs. Could be its own package or part of `@nielspeter/eess`. Decide when shipping.

The product after 0051 + 0058 + 0059 is already category-defining: TS + MD + Mermaid + cross-validation under one brand, on one kernel, with the manifesto's framing intact — and with a production migration (an external repo) proving the "no custom code per repo" claim.
