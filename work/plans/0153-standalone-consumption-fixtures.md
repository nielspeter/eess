# Plan 0153: Standalone-consumption fixtures for md/mermaid/gherkin/crossvalidate

## Status

- **State:** Draft — split from [plan 0089](./completed/0089-family-standalone-sufficiency.md)'s
  own Phase 2, 2026-08-16. 0089 carried two phases: Phase 1 (per-dialect
  re-export shake-out + `family.rules.ts`/`check:family`) and Phase 2 (this
  plan). Phase 1 alone consumed a full build, a six-persona review that found
  3 Critical + 7 Important issues, a fix pass, and an independent
  re-verification round before it was genuinely done — five rounds of work
  for what was meant to be half the plan. Building Phase 2 in the same pass,
  with less rigor than Phase 1 just required, was the wrong tradeoff — this
  repo does not ship half-built phases in one PR; it splits instead. 0089
  closed covering only what it actually delivered (Phase 1); this plan is
  Phase 2's real home, to be built and reviewed with its own full PR.
- **Priority:** Medium — real claim-versus-check gap (each dialect's own
  README/`package.json` promises standalone installability, and Phase 1's
  `check:family` only proves re-export _completeness_, not that a live
  install with nothing else on disk actually runs), but not urgent: nothing
  currently regresses silently without it, and `check:family` already covers
  the more common failure mode (a missing re-export).
- **Effort:** Medium — genuinely new mechanism, no precedent to copy. 0088's
  own Test Inventory claimed a dist-only black-box fixture for `eess-ts`
  ("installs only `@nielspeter/eess-ts` (dist)... runs the full path
  `init → check → diagnose`"), but what actually shipped is
  `packages/ts/tests/standalone-surface.test.ts` — a source-level
  `import * as ns` re-export-completeness check, not a dist-only install.
  Confirmed by exhaustive search (`find . -iname "*standalone*"`, `grep` for
  `dist`/`npm pack`/`black-box` across `packages/ts/tests/`) turning up
  nothing else anywhere in the repo. This plan is not following an existing
  pattern for a fourth dialect; it is building this repo's first genuine
  dist-only consumption fixture, for four dialects at once. (0088's own
  overclaim is a separate, disclosed finding — not this plan's to fix; noted
  for whoever next touches that closed plan's record.)
- **Created:** 2026-08-16

## Problem

Each sibling dialect promises to be a complete tool on its own: a user
installing only `@nielspeter/eess-md` — or `-mermaid`, `-gherkin`,
`-crossvalidate` — gets everything they need with no second install. Plan
0089 Phase 1 proved the _re-export surface_ is complete (`check:family`), but
completeness of what's exported is not the same claim as "a fresh install
with nothing else on disk actually works." Nothing in this repo runs a
dialect package from its published `dist/`, in isolation, and exercises its
real primary path.

## Implementation

A fixture that installs **only** the dialect package (`dist`, as a foreign
consumer would) and runs its primary path — md: `check` over a live corpus;
mermaid: diagram check; gherkin: scenario check. No `@nielspeter/eess` import
in sight.

**`crossvalidate` is the deliberate exception — per its nature, not an
oversight.** `eess-crossvalidate` is a _binding_ tool: its function is to
join two dialects, it declares them as `peerDependencies`, and "run a
two-dialect correspondence with crossvalidate installed alone" is not
satisfiable. Its standalone-consumption fixture installs **crossvalidate +
the two dialects it binds** (honoring its peer deps) and asserts the
correspondence works with no `@nielspeter/eess` import in sight. This is the
same deliberate-exception shape 0088 carves for `correspondence`/
`matchSelections`. The per-dialect sufficiency invariant stands for
md/mermaid/gherkin; crossvalidate's guarantee is "one package + its peers, no
kernel."

**Design questions to resolve before freeze (`/plan-ready`), not yet
answered here:**

- Exact mechanism: a real `npm pack` + isolated `node_modules` install per
  fixture (heaviest, most faithful), or a lighter proxy (import directly from
  each package's own `dist/`, in a script or test, with an explicit assertion
  that grep-confirms zero `@nielspeter/eess`/sibling-dialect imports anywhere
  in that `dist` bundle's own module graph)? The build's own judgment call —
  reserved for whoever builds this — should pick the cheapest mechanism that
  still proves the real claim, not one that's true by construction.
- Where the fixtures live: `tests/standalone/` per package (matching 0089's
  own "Files changed" note), or a shared root-level script (mirroring how
  `check:family`/`check:docs-code` are structured)?
- Whether this is wired into `npm run validate` directly, or lives in a
  slower, separate tier (a real `npm pack` + install cycle is not cheap;
  `check:family`'s own devops review found even a static AST gate costs
  ~5-6s in the fast tier).

**Files changed:** a `tests/standalone/` per package (or a shared script if
the shape generalizes, per the design question above).

## Test inventory

**Four** standalone-consumption fixtures — md/mermaid/gherkin install the
single dialect alone; **crossvalidate installs the dialect + its two peer
dialects** (its binding nature is the deliberate exception), each with no
`@nielspeter/eess` import in sight, each asserting the dialect's own
CLI/gate genuinely runs against a live fixture corpus, not just that its
imports resolve.

## Out of scope

- **The fold itself** — plan [0088](./completed/0088-fold-ts-archunit-into-eess.md).
- **The re-export-completeness half of standalone sufficiency** — plan
  [0089](./completed/0089-family-standalone-sufficiency.md)'s own Phase 1,
  already closed.
- **Reconciling the sibling dogfood gates to fail-closed** — plan
  [0101](./completed/0101-sibling-gates-go-fail-closed.md).
- **Standalone sufficiency for `eess-ts` itself** — 0088's own binding
  invariant, already covered by `standalone-surface.test.ts` (source-level;
  see this plan's own Effort note on the gap between that and a genuine
  dist-only install, which 0088 never actually built despite claiming to).
- **Sibling engine features beyond the re-export surface** — new capability
  is a proposal/plan, not this one.

## Success definition

- **Md/mermaid/gherkin** usable alone: a passing standalone-consumption
  fixture, a real isolated install (or an equally-faithful proxy, decided at
  build time and justified), running the dialect's own primary path.
- **Crossvalidate** usable as "one package + its two peer dialects, no
  kernel" — a passing fixture proving the same.
- `npm run validate` green throughout (or the fixture's own tier explicitly
  justified if excluded from the fast/default path).

## Progress ledger

- [ ] Design the fixture mechanism (real install vs. proxy), resolved before
      `/plan-ready` freezes this plan.
- [ ] Four standalone-consumption fixtures built, green.
