# Plan 0060: Full-Coverage Dogfooding — the eess family as customer zero

## Status

- **State:** IMPLEMENTED 2026-07-04 — all seven phases (0–6) executed under the no-shortcuts invariant. 356 raw violations → 0 by real fixes (no baselines); all six gates active in validate+CI and proven non-vacuous via committed violating fixtures (check:nonvacuity); three product bugs found and fixed by the dogfooding (noPublicFields #private, inert exclusion comments, CLI .ts loading — the last from the pre-plan hack incident); two generic eess-md features shipped (static-site link resolution: tryExtensions/tryIndex/rootDir; HTML-comment sanctions through the kernel exclusion pipeline); all 7 ADRs enforceable (14 gated · 1 pending · 6 manual). Coverage: work/dogfood-coverage.md, claimed in README.
- **Priority:** P1 — the strongest pre-publish confidence signal there is. The user has gated the external cutover (publish, GitHub rename, claim `eess`) on the family being "confirmed as a replacement for ts-archunit." A repo that fully enforces its own specs with its own tools _is_ that confirmation.
- **Effort:** ~2–3 weeks, honestly stated. Includes: a Phase 0 audit whose violation inventory sizes the rest; fixing (not baselining) whatever the eess-ts rules surface; completing the architecture diagram until diagram↔code agrees within its declared charter; two real eess-md features; migrating all **seven** ADRs; and possibly refactoring the crossvalidate presets to return builders (owned explicitly in Phase 2 if chosen). If Phase 0's inventory is larger than this estimate absorbs, that is reported and re-planned — not absorbed by weakening a check.
- **Created:** 2026-07-04
- **Depends on:** Plans 0051/0058/0059 (built, green on `eess-consolidation`), commit `5a159c1` (eess-ts CLI loads `.ts` rule files via jiti). **Explicitly does NOT depend on plan 0049** (recommended preset, still draft) — see Phase 4; this plan's experience feeds 0049, not the reverse.

## As-built record (2026-07-04)

Executed in one working session on branch `eess-consolidation`, in the reviewed
phase order. Final state: `npm run validate` exit 0 — six gates + **2061 tests
across 6 packages**, nothing merged to main, nothing published.

| Phase | Delivered                                                                                                                                         | Commit(s)                                  | Deviation from plan                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 0     | Report-only audit: **356 raw violations across 12/24 candidate rules**, all dispositioned in `work/dogfood-coverage.md`                           | `b01fa91`                                  | As planned. 11 rules already clean at audit; 0 rejected.                                                                   |
| 1     | eess-mermaid: `docs/architecture.mmd` (kernel charter) + `mermaid.rules.ts` via real CLI; `check:diagram`; CLI rebranded mermaidunit→eess-mermaid | `8537166`                                  | As planned. Also fixed a SPEC.md relations table mangled by an earlier prettier pass.                                      |
| 2     | eess-crossvalidate: `scripts/check-crossval.mjs` — diagram↔code (both dirs) + ADR↔test; `check:crossval`                                          | `0b92133`                                  | Wiring option **(a)** chosen (script, not the preset refactor) — cheapest, matches check-corpus.                           |
| 3     | All **7** ADRs migrated to enforceable `## Enforcement` tables; `adrEnforcement` in `check:corpus`; CLAUDE.md convention                          | `89f40d6`                                  | The AST citation gate caught two real issues mid-migration (tests-excluded tsconfig; duplicate test title).                |
| 4     | `arch.internal.rules.ts` — internal policy over all packages; **356→0** by real fixes; `check:arch` runs both rule files                          | `f22fc86`, `581ad10`, `b0e6091`, `19eae43` | **Ran 3 parallel fixer subagents** on file-partitioned work-lists. Effort ~1 day, under the ~3-day estimate (parallelism). |
| 5     | eess-md: `resolve({tryExtensions,tryIndex,rootDir})`; HTML-comment sanctions in the kernel; corpus → 100 docs, pointers on                        | `4fd273a`                                  | Added `rootDir` (not in plan) — site-absolute `/page` links needed it; block-form sanctions for reflow-safety.             |
| 6     | `check:nonvacuity` harness (7 gates) in validate + CI; coverage doc finalized; README "eess validates eess"                                       | `6229a50`                                  | Harness gained a 7th gate (pointers) beyond the plan's list.                                                               |

**Prep commits (before the plan, same effort):** `5a159c1` (CLI `.ts` loading — the fix that replaced the caught hack), `1fc0726`/`f3270e1` (the initial link + arch dogfood the plan grew from), `47435cd`/`77859a2` (typed-mermaide grammar spec salvage).

### Honest accounting

- **Effort:** ~1 working session, well under the ~2–3 week estimate — the estimate assumed serial hand-fixing; the 170-item fix workload was fanned out to three subagents on disjoint file partitions. The estimate was honest for a solo human; parallel agents changed the constant.
- **No-shortcuts invariant held:** 0 baselines, 0 silencing overrides. 32 inline `eess-exclude` sanctions, each with a written reason, greppable, counted in the coverage doc. Non-null assertions: 16/16 real-fixed, zero sanctions.
- **Three product bugs found by the dogfooding, all fixed** (not worked around):
  1. `noPublicFields` flagged ES `#private` fields (`581ad10`) — rule fix + regression test.
  2. **Inline exclusion comments were inert** for most conditions (violations lacked `ruleId`; the matcher requires it) — kernel `applyFilters` now stamps it; a 7-test end-to-end regression suite added (the bug survived because only unit tests existed). This was the highest-value find.
  3. CLI couldn't load `.ts` rule files (`5a159c1`) — the pre-plan hack incident, fixed with jiti.
- **Two generic features shipped** (lego-bricks, no SSG named): static-site link resolution, and the exclusion mechanism now speaking markdown via the same kernel pipeline. Plus a non-English column alternative removed from the defaults (`b0e6091`).
- **ADR statuses (25 clauses, 7 ADRs):** 14 `gated` · 1 `pending` (ADR-007 confinement — the declared honest gap, its own future plan) · 6 `manual`/tier-5. `manual` count is 6, `pending` 1.
- **Both user decisions honored:** absolute no-baseline (decision 1); six-value ADR status vocabulary documented in CLAUDE.md (decision 2).

### Corrections to the record

- Phase 4's commit message says the audit found "39 sites" for `no-type-assertions`; the run surfaced **39** flagged at audit, **55 assertion sites total** across as + non-null (39 + 16) — the coverage doc has the exact split.
- Phase 5's commit message says "e2e suite (10 tests)"; the committed suite is **7 tests** (`packages/ts/tests/integration/exclusion-comments-e2e.test.ts`). Content is as described; the count in that message is wrong.

## Review outcome (2026-07-04 — architect + product)

**Verdict: right goal and invariant; first draft not executable as written.** Both reviewers converged on the same core finding: the draft cited APIs that do not exist — "the planning-stage version of the faked dogfood." All findings are folded into this revision:

| Finding                                                                                                                                                                                      | Resolution in this revision                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Fabricated APIs (`doNotResideInFolder`, multi-glob `resideInFolder`, `--rules` flag, `.check()` on void presets, `direction` option, console rule in hygiene, cycles in architecture family) | Every code sample below uses only verified shipped API (file:line evidence in the review transcripts)                                      |
| "Recommended preset" doesn't exist (0049 is draft)                                                                                                                                           | Phase 4 enumerates concrete shipped families; 0060's results feed 0049's design                                                            |
| Void-throwing presets can't live in CLI rule files (loader drops non-`.check` items silently)                                                                                                | Phase 2/3 wiring is scripts (the `check-corpus.mjs` pattern) — or an owned preset refactor, decided in Phase 2                             |
| Unscoped `both`-completeness = class inventory incl. generated/CLI classes; kernel is mostly functions/types; duplicate class names across packages                                          | A-priori diagram charter declared in this plan (kernel classes only); invariant amended to distinguish a-priori scope from scoping-to-pass |
| `dir` defaults to `docs/adr/**` — our ADRs live at `/adr`; example would green-but-empty                                                                                                     | `dir: 'adr/**'` written into the wiring; non-vacuity proof doubles as the guard                                                            |
| Manifesto blesses `pending`/ratchet; draft banned baselines absolutely                                                                                                                       | Decided by the user: absolute — fix everything (see Decisions)                                                                             |
| Scattered `because:` comments aren't auditable                                                                                                                                               | Central exclusions manifest + public counts (`work/dogfood-coverage.md`)                                                                   |
| No inventory before committing to "fix everything"                                                                                                                                           | New Phase 0: report-only audit run; wrong-by-design rules pre-classified                                                                   |
| Phase order contradicted the strategic note (0% dialects scheduled last)                                                                                                                     | Reordered: 0 → mermaid → crossvalidate → ADR migration → eess-ts internal → eess-md features → consolidate                                 |
| "VitePress mode" names one SSG                                                                                                                                                               | Generic `resolve({ tryExtensions, tryIndex })` instead                                                                                     |
| Six-vs-seven ADR drift; ADR-007's confinement rule currently violated by the code                                                                                                            | Seven ADRs throughout; the 007 gap is pre-declared as expected honest output, not a surprise                                               |
| Root `arch.rules.ts` would become a god-file; alias package unaccounted                                                                                                                      | Per-package rule files; root keeps cross-package only; alias excluded with written reason                                                  |

## Problem

We built a four-dialect family whose entire thesis is "a project's specs should validate themselves" — and the repo that builds it validates itself at **~10%**. The scaffold is real (every check runs the actual product path — CLI/library — after the `.mjs`-side-script hack was caught and fixed), but the enforcement is thin, and two of the four dialects guard **nothing** of our own work.

### Current coverage (honest baseline)

| Check (in CI)     | Uses                               | What it actually enforces on our repo                                              | Coverage |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| `check:integrity` | **not eess** — hand-written `.mjs` | `package.json` phantom-dep + local-linking. Legit guardrail, but dogfoods nothing. | n/a      |
| `check:arch`      | **eess-ts** (real CLI)             | 5 rules, only `resideInFolder` + `notImportFrom` — **package boundaries only**.    | ~10%     |
| `check:corpus`    | **eess-md**                        | **links only**; corpus has 1 link. Pointers off, ADR preset off, `docs/` excluded. | ~10%     |
| _(none)_          | **eess-mermaid**                   | No `.mmd` in the repo is validated.                                                | **0%**   |
| _(none)_          | **eess-crossvalidate**             | The headline diagram↔code / ADR↔test capability guards nothing of ours.            | **0%**   |

## Goal

Each of the four dialects fully enforces on our own repo, wired into `validate` + CI, so that "eess validates eess" is true in substance. **The gates go green because the code/docs/diagram were made correct — never because a check was weakened, scoped down after failing, baselined, overridden, or ignored.** "100%" is not a vibes number: the deliverable includes a concrete coverage checklist (`work/dogfood-coverage.md` — dialects × artifact types × rules adopted, with exclusion counts) so the claim survives a skeptical reader.

### No-shortcuts invariant (binding on every phase)

This plan exists because our dogfooding was ~10% dressed up as done. It must not repeat that. Therefore:

- **No baselines — absolute (user decision 1).** We do not grandfather existing violations to get a green gate. Every rule we adopt, we make pass by **fixing the code**.
- **No severity overrides to silence.** We do not downgrade a failing rule to a warning to get a green.
- **No scoping-to-pass.** We do not narrow a correspondence, glob, or root set _in response to a red check_ to make violations disappear.
- **No ignore-lists as escape hatches.** `frozen` folders (historical/terminal) are legitimate; an ignore added _specifically to hide a live violation we don't want to fix_ is not.
- **A rule is only "done" when proven non-vacuous** — a committed violating fixture makes it exit 1 in a CI-checked way — **and** green on real input. Green-but-empty is failure.

**A-priori declarations are not shortcuts.** A scope, exclusion, or rejected rule declared **in this plan or in the exclusions manifest _before_ the corresponding check first runs**, with a written architectural reason, is a design decision — auditable and reviewable. The same narrowing made _after_ seeing a red check, to make it green, is the dodge this invariant bans. The line is temporal and documented: declared up front with a reason = architecture; retrofitted to pass = shortcut. Without this distinction the invariant would ban the only honest configurations of the tools being dogfooded (e.g. `noDeadModules`' own docs prescribe `.excluding('index.ts')`).

**Central audit surface.** All exclusions, rejected rules, and declared scopes live in one reviewable place: `work/dogfood-coverage.md` — the coverage checklist plus the exclusions manifest ("N rules adopted, M rejected: …", each with its reason). Scattered comments don't count as the manifest; the README's coverage claim links to it.

### Pre-classified wrong-by-design rules (declared now, before any check runs)

Per the a-priori clause, these are declared up front with reasons — not discovered mid-phase:

1. **`noUnusedExports` / `noDeadModules` over public API surfaces.** On a _library_, every `index.ts` public export is "unused" internally by definition, and exports consumed only by tests are invisible to the build project (see Phase 4 — `tsconfig.build.json` excludes `tests/`). These rules run scoped to internal (non-entry-point) modules with `.excluding()` per their own documented pattern, or are rejected with that reason in the manifest.
2. **Generated code** (`packages/mermaid/src/parser/generated/**`). "Fix the code" is meaningless for generated files; they are excluded from style/hygiene/metrics rules with that written reason. Import-boundary rules still apply to them.
3. **The alias package** (`packages/ts-archunit`). A re-export shim whose only import is its target by design; excluded from the `workspace()` rule set with that reason in the manifest.

## Implementation phases

Ordered by credibility-per-effort (the two 0% dialects first — matching the strategic note), each phase landing its CI gate independently so a partial delivery still leaves shipped, green, honest coverage.

### Phase 0 — audit run + inventory (~0.5 day)

Run every candidate eess-ts rule family and the eess-md pointer check over the repo **report-only** (a throwaway script printing violations; not wired to CI, no gate). Publish the violation inventory in `work/dogfood-coverage.md` as the plan-of-record for Phases 3–5, with each finding classified: _fix_ / _wrong-by-design (manifest)_. Discovery is not a shortcut — the invariant governs end states, not measurement. This converts the effort estimate from hope into fact; if the inventory is large, the timeline is re-planned openly with those numbers (decision 1: fix everything — the date moves, the gate does not weaken).

**Files:** `work/dogfood-coverage.md` (new).

### Phase 1 — eess-mermaid: the family architecture diagram, validated (~1 day)

Take eess-mermaid from 0%.

- **Fix the CLI branding first** — `packages/mermaid/src/cli/index.ts` still prints `mermaidunit`; this phase's snippets go in the README, so the rebrand (help text, config filename additionally accepting `eess-mermaid.config.ts`) lands here, not later.
- Add `docs/architecture.mmd` — a class diagram with the **declared charter: the kernel's classes** (`packages/core/src/**` — `RuleBuilder`, `TerminalBuilder`, `CorrespondenceBuilder`, `ArchRuleError`, …). This charter is the a-priori scope for Phase 2's completeness check, declared here per the invariant. Rationale: the family is mostly functions and types — a class-complete diagram over all packages would be an inventory of CLI plumbing and Langium-generated AST classes, architecturally the least interesting view; and duplicate class names across packages (`ClassRuleBuilder`, `RunScheduler` exist twice) would make name-keyed correspondence ambiguous. Kernel-only is the honest, meaningful, unambiguous scope — and it is written down _before_ the check exists.
- Add `mermaid.rules.ts` using the real API (`classes(d)`, `haveStereotype`, `notDependOnStereotype`) and run it with the **real CLI syntax** — positionals are rule files; the diagram loads inside:

```ts
// mermaid.rules.ts
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('docs/architecture.mmd')

export default [
  // every class in the charter diagram declares its kernel role
  // (haveStereotype takes a string — no regex overload exists)
  classes(d).should().haveStereotype('kernel'),
]
```

```bash
eess-mermaid check mermaid.rules.ts   # NOT: check <diagram> --rules <file> (no such flag)
```

**Files:** `docs/architecture.mmd` (new), `mermaid.rules.ts` (new), `packages/mermaid/src/cli/*` (branding), `package.json` (`check:diagram`), `.github/workflows/ci.yml`.

### Phase 2 — eess-crossvalidate: both presets live on our own repo (~1–1.5 days)

The headline capability. **Wiring constraint (from review):** `diagramMatchesCode` and `adrCitationsResolve` return `void` and throw — the eess-ts CLI loader accepts only objects with `.check()` and silently drops anything else, so these **cannot live in a CLI rule file**. Two honest wirings; pick in this phase and record why:

- **(a) Script, matching the existing `check-corpus.mjs` pattern** — `scripts/check-crossval.mjs` importing the built presets. Lowest cost, consistent with the eess-md dogfood.
- **(b) Refactor the presets to return rule builders** (then they compose with any CLI runner — the more framework-correct shape per the lego-bricks principle). This is **new API scope owned explicitly here** if chosen: signature change in `@nielspeter/eess-crossvalidate` + tests, not a side effect.

Default to (a) for this plan and file (b) as a candidate follow-up, unless (b) turns out trivial during implementation.

```js
// scripts/check-crossval.mjs — real signatures: void, throws; option is `completeness` ('both' is default)
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { project } from '@nielspeter/eess-ts'
import { corpus } from '@nielspeter/eess-md'

const p = project('packages/core/tsconfig.build.json') // the diagram's declared charter (Phase 1)

// diagram ↔ code, both directions, within the charter scope declared in Phase 1
diagramMatchesCode(diagram('docs/architecture.mmd'), p, {
  scope: '**/packages/core/src/**', // a-priori charter, NOT a reaction to a red check
})

// ADR ↔ test — every it('…') an ADR cites must exist in the AST.
// dir MUST be set: the default is 'docs/adr/**' and ours live at /adr —
// omitting it would silently check zero documents (green-but-empty).
adrCitationsResolve(corpus({ roots: ['adr/**'] }), project('packages/ts/tsconfig.build.json'), {
  dir: 'adr/**',
})
```

When the diagram↔code check first fails (it will — the diagram is new), the fix is **completing the diagram or correcting the kernel** until both directions agree _within the declared charter_ — not shrinking the charter. The charter was fixed in Phase 1; from here on, narrowing it to pass is the banned move.

**Files:** `scripts/check-crossval.mjs` (new), `package.json` (`check:crossval`), `.github/workflows/ci.yml`; if (b): `packages/crossvalidate/src/*` + tests.

### Phase 3 — the executable-ADR migration (~1.5 days)

The manifesto's centerpiece applied to us. Migrate **all seven ADRs** (001–007) to the enforceable format and turn `adrEnforcement` on.

- The format is **mostly already fixed by the tool** (`packages/md/src/rules/adr.ts`): `## Enforcement` section, table columns matched by `/tier/i`, `/mechanism/i`, `/status/i`, tiers 1–5, citations as backticked paths + `it('…')` titles. The only genuinely open convention is the **status column's allowed values** (the preset doesn't validate them) → decided: the six-value vocabulary in Decisions. Version-label the format in the migration commit so a future change has a known blast radius (7 ADRs + preset defaults).
- **Pre-declared honest outcome:** ADR-007 (engine isolation) is Proposed and its confinement rule is _currently violated_ (ts-morph imported directly across eess-ts, e.g. `packages/ts/src/rules/hygiene.ts:1`). The migrated table declares that clause honestly (status `pending` per the decided vocabulary) rather than claiming a green it doesn't have — that IS the tool working, not a plan failure. Closing the 007 gap is its own future plan, not smuggled in here.
- Wire via an extension of the existing corpus script (same void-preset constraint as Phase 2): `adrEnforcement(corpus({ roots: ['adr/**'] }), { dir: 'adr/**' })` added to `scripts/check-corpus.mjs`.
- Update `CLAUDE.md`'s ADR guidance — the authoring convention changes for all future ADRs (this file was missing from the draft's file lists).

**Files:** `adr/001…007-*.md` (migrate), `scripts/check-corpus.mjs` (add adrEnforcement with `dir`), `CLAUDE.md`, `work/dogfood-coverage.md`.

### Phase 4 — eess-ts: real internal architecture rules (~2–3 days, sized by Phase 0)

Grow the eess-ts dogfood from package boundaries to internal architecture — using **only shipped API** (every sample below verified against source) and the concrete rule families, **not** the nonexistent "recommended preset" (plan 0049 is draft; this phase's results — which rules survived contact with a real 1910-test codebase, which were wrong-by-design — become 0049's design input).

- **Layout:** the root `arch.rules.ts` keeps **cross-package** invariants only (current 5 rules). Intra-package rules live in per-package rule files (`packages/ts/arch.rules.ts`, `packages/core/arch.rules.ts`, …), all run by the same CLI — avoiding a five-package god-file. `check:arch` runs them all.
- **Internal layering** — corrected chains (the draft's `doNotResideInFolder` doesn't exist; the kernel's documented pattern is `satisfy(not(...))`, and `resideInFolder` is single-glob with picomatch braces):

```ts
import { workspace, modules, not, resideInFolder as inFolder } from '@nielspeter/eess-ts'

// CLI is a leaf — nothing outside cli/ imports it.
modules(p)
  .that()
  .resideInFolder('**/packages/ts/src/**')
  .and()
  .satisfy(not(inFolder('**/packages/ts/src/cli/**')))
  .should()
  .notImportFrom('**/packages/ts/src/cli/**')
  .rule({ id: 'eess-ts/cli-is-a-leaf', because: 'the CLI is an entry point, not a dependency' })

// conditions/ and predicates/ are lower layers than builders/.
modules(p)
  .that()
  .resideInFolder('**/packages/ts/src/{conditions,predicates}/**')
  .should()
  .notImportFrom('**/packages/ts/src/builders/**')
  .rule({ id: 'eess-ts/no-upward-imports', because: 'conditions/predicates are below builders' })
```

- **Cycles** — via the slices builder (not the `architecture` family, which is `mustCall`/`classMustCall` only): `slices(p).matching('packages/*/src/*/').should().beFreeOfCycles()`.
- **Console ban** — not a hygiene-family rule; expressed with primitives: `functions(p).that().resideInFolder('**/src/**').and().satisfy(not(inFolder('**/cli/**'))).should().notContain(call(/^console\./))`.
- **Hygiene family** (`noStubComments`, `noEmptyBodies`; `noDeadModules`/`noUnusedExports` per the pre-classification above).
- **Naming** — the shipped `naming` family is class-suffix oriented; module-level conventions ("condition files export `*Condition`") are custom rules built from `exportSymbolNamed`/`haveNameMatching` primitives — budgeted as custom-rule work, not "turn on a family."
- **Test hygiene (`.only` ban): scoped decision** — `tsconfig.build.json` includes only `src/`, so test files are invisible to the build workspace. Enforcing it requires a second `workspace()` over dev tsconfigs (real load cost) — do it if Phase 0 shows it cheap enough; otherwise reject in the manifest with this stated reason.
- **Every violation surfaced gets fixed in source** (decision 1: absolute — however large Phase 0's count is). No `arch.baseline.json`.
- **CI note (why build-first is load-bearing, stated so nobody "optimizes" it):** cross-package imports resolve against each package's `dist` declarations; pre-build, the workspace can't resolve `@nielspeter/eess*` and every import rule silently degrades. `check:arch` stays after `npm run build`.

**Files:** `arch.rules.ts` (cross-package only), `packages/*/arch.rules.ts` (new), source fixes per Phase 0's inventory, `work/dogfood-coverage.md`.

### Phase 5 — eess-md: pointers + generic link resolution (~2 days)

<!-- eess-exclude-start corpus/pointers-resolve: the plan text quotes the illustrative/stale pointers it discusses -->

1. **Live-vs-example pointers (new generic feature).** The false positives found during dogfooding (illustrative `file.ts:10-20`, quoted-foreign `[id].vue:160`) are a real gap for _any_ markdown corpus. Fix in the tool, not with ignores: **(a)** pointers inside fenced code blocks are non-live (fences already carry language metadata in the model — extend the pointer collector to skip them); measure what false positives remain; **(b)** only if (a) leaves real residue, add a linter-standard disable-comment convention — and route every use of it through the exclusions manifest, because an example-marker on a stale live pointer would be the banned move with new syntax. Then enable pointer checking for the whole live corpus and fix every genuinely stale pointer (e.g. the pre-monorepo `tests/rules/typescript.test.ts:77-80` citation).
<!-- eess-exclude-end -->
2. **Generic link resolution (not "VitePress mode").** Ship `resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })` — one primitive covering VitePress/Docusaurus/MkDocs/GitBook conventions without naming any SSG in our API (the codebase already carries a cautionary precedent of a leaked non-English column alternative in `adr.ts` defaults — flagged for cleanup here). Then include `docs/**` in the corpus roots and fix broken links found.
3. Both features land with eess-md unit tests + violating fixtures (non-vacuity).

**Files:** `packages/md/src/builders/pointers.ts` + model (fence-aware liveness), `packages/md/src/builders/links.ts` (`resolve` options), `packages/md/tests/*`, `scripts/check-corpus.mjs` (roots += `docs/**`, pointers on), corpus fixes.

### Phase 6 — consolidate + the coverage claim (~0.5 day)

- Final `check:*` surface in `validate` + CI (build-first, reason documented): `integrity`, `arch`, `diagram`, `crossval`, `corpus`.
- `work/dogfood-coverage.md` finalized: the checklist (dialect × artifact × rules adopted), exclusion counts with reasons, links from `README.md` — the "eess validates eess" claim made checkable, not asserted.
- Non-vacuity harness: committed violating fixtures + an expect-exit-1 script wired into CI, so the proof is a CI property, not a one-time ritual.
- Update walkthrough/manifesto references, `work/plans/ROADMAP.md`, memory.

**Files:** `package.json`, `.github/workflows/ci.yml`, `README.md`, `work/dogfood-coverage.md`, `docs/eess-walkthrough-calculator.md`, `work/plans/ROADMAP.md`, non-vacuity fixtures + script.

## Verification (the dogfood checks _are_ the tests)

- `check:diagram` — the charter diagram valid under the mermaid dialect via the real CLI, exit 0.
- `check:crossval` — diagram↔code agrees in both directions **within the Phase-1 charter**, ADR↔test citations resolve (`dir` correctly set — proven non-vacuous so green-but-empty is impossible), exit 0.
- `check:corpus` — links (incl. `docs/**` via generic resolution) + live pointers over the whole corpus + `adrEnforcement` on all seven ADRs, exit 0.
- `check:arch` — cross-package + per-package internal rules, **no baseline file** (decision 1), no silenced rules, exit 0 because the source was fixed.
- **Non-vacuity in CI:** every gate has a committed violating fixture and an expect-exit-1 check.
- **Audit surface:** `work/dogfood-coverage.md` lists every adopted rule, every rejected rule with reason, every a-priori scope — and the README claim links to it. Grep-clean holds for the mechanical part (`*.baseline.json`, `.severity('warn')` as mute), the manifest covers what grep can't (`.excluding()` uses, `overrides`, root/scope declarations — each traceable to an a-priori entry).
- Full `npm run validate` green across all 6 packages plus all five dogfood gates.

## Out of scope

Genuinely separate work — **not** dodges:

- **The external cutover** (publish, rename, claim `eess`) — user-gated, unaffected.
- **Closing the ADR-007 confinement gap** (ts-morph isolation inside eess-ts). Phase 3 makes the gap _visible and honestly labeled_; the refactor to close it is its own plan.
- **Plan 0049 (recommended preset)** — consumes this plan's findings; not built here.
- **Rewriting `check:integrity`** in a dialect — JSON isn't a language any dialect models; the hand script is the right tool.
- **New dialects** — separate future plans.

Not carved out: "enabling every rule" is still not optional-by-default. Every shipped rule family is either adopted (and the code made compliant) or rejected in the manifest with a written reason. The manifest's rejected-count is public.

## Decisions (made by the user, 2026-07-04)

1. **Absolute: fix everything.** ~~Pending/ratchet vs. absolute no-baseline~~ — the user chose the hard line. The eess-ts arch gate never carries a pending state: whatever Phase 0's inventory shows, every violation of an adopted rule is fixed in source before the gate ships, and **the timeline grows to fit the inventory** (reported with numbers, re-planned openly — never absorbed by weakening a check). The manifesto's ratchet mechanism remains a product feature for external adopters; customer zero doesn't use it. Consequence accepted: the baseline feature stays un-dogfooded by this repo (its coverage comes from its unit tests), and if Phase 0 lands big, this plan's end date moves — visibly.
2. **ADR status vocabulary: the richer set.** The status column uses six values, documented in `CLAUDE.md` during Phase 3:
   - `gated` — mechanism runs in CI; failing blocks.
   - `warn` — mechanism runs in CI; reports without blocking.
   - `pending` — decided, mechanism known, not yet green/wired (ADR-007's confinement clause starts here).
   - `manual` — enforced by human review; no mechanism is possible.
   - `n/a` — clause is context/rationale; nothing to enforce (distinct from `manual`: no human gate either).
   - `deprecated` — clause no longer in force (superseded rows kept for history).

   Note the coherence with decision 1: `pending` in an ADR table is the tool _honestly describing_ a gap in the code (ADR-007); it is not an escape state for the arch gate, which under decision 1 must be fixed to green. If the preset later grows an `allowedStatuses` option to validate values, this vocabulary is what we pass — generic option, project-specific values.

## Strategic note

This plan is the difference between "we built a self-validation framework" and "we run a self-validating repo." The phase order now matches that: the two 0%-dialects and the executable-ADR migration — the manifesto's headline claims made real on our own repo — land first, each with its own CI gate, so even a partial delivery ships the credibility core. The eess-ts internal rules and eess-md features follow, sized by a Phase 0 inventory instead of hope. And the review that produced this revision is itself the lesson applied: the first draft preached no-shortcuts while citing five APIs that don't exist — surveyed, corrected, and now every code sample in this plan is checked against shipped source.
