# Plan 0089: Family standalone sufficiency — per-dialect re-export surface + `check:family`

## Status

- **State:** Draft — created 2026-08-10 as the deliberate split from plan 0088.
  **Split again 2026-08-12:** this plan carried four phases, of which two required
  0088 Phase 4's folded kernel seam. The plan named that honestly ("the dependency
  is Phase-3-scoped, not plan-wide") but naming it does not make it closable —
  Phases 1–2 would merge while Phases 3–4 sat open behind another plan's phase.
  The fold-dependent half is now
  [0101](./0101-sibling-gates-go-fail-closed.md). What remains here is
  **independent of 0088 and buildable now**: the per-dialect re-export surface and
  the rules that guard it. _(The same rewrite removed a duplicated tail — this
  file carried two divergent copies of Out of scope / Success definition /
  Progress ledger, disagreeing on whether crossvalidate is an exception and on
  whether 0088's exception list is honoured or superseded. The refined copy is
  kept.)_
- **Priority:** High — standalone sufficiency is a claim each published dialect
  makes on npm today, and nothing checks it. That is a claim-versus-check gap
  independent of the fold; the fold only makes it more expensive to leave open.
- **Effort:** Medium — verification-driven; the shake-out per package dominates.
- **Created:** 2026-08-10

## Problem

Each sibling dialect promises to be a complete tool on its own: a user installing
only `@nielspeter/eess-md` — or `-mermaid`, `-gherkin`, `-crossvalidate` — gets
everything they need with no awareness that `@nielspeter/eess` exists. The
mechanics are already right (the kernel is each package's transitive
`dependency`, `^0.2.0`). What is missing is the **re-export surface** and its
guard.

Verification (2026-08-10): none of eess-md, eess-mermaid, eess-gherkin,
eess-crossvalidate overrides `collectViolations`; only `mermaid/src/index.ts` even
re-exports `TerminalBuilder`. They consume the kernel through `RuleBuilder` /
`correspondence` / their own builders (`rows`, `docs`, `links`, `pointers`). So
which kernel exports each sibling must re-export has never been established — and
eess-ts's own "exception" list (`correspondence`, `matchSelections`, `applyFixes`)
is **dialect-specific**, not a family answer: md's users need `applyFixes`
(autofix), crossvalidate's need `correspondence` / `matchSelections`.

This generalizes eess-ts's invariant from 0088 to the whole family. It does not
depend on the fold — the promise is live on the registry now.

## Implementation phases

### Phase 1 — Shake out each sibling's re-export surface

For each of `packages/md`, `packages/mermaid`, `packages/gherkin`,
`packages/crossvalidate`: enumerate the kernel exports its own sources actually
import (the dialect's real touch surface), plus what its _own_ documented public
API promises its users. The re-export set is the union — what the dialect's code
needs and what its users are told they can call. Differences between the two
lists are the shake-out artefacts: a kernel export the docs promise but the code
never touches is either a gap (re-export it) or a doc bug (don't).

**Deliverable:** a per-package matrix in `work/dogfood-coverage.md` (the audit
surface already names the dogfooding coverage). **Files changed:** each sibling's
`index.ts` (+ any doc claim that is corrected instead of honoured).

**The enforcement is eess rules, not script tests.** The guarantees this plan
makes are _architecture of the family_ — the exact thing eess-ts rules are for.
So the re-export completeness and the sibling boundaries become a rules file
(`family.rules.ts` at the repo root, checked by a new `check:family` gate), so
nothing can silently regress a dialect's standalone sufficiency:

```ts
// family.rules.ts — dogfood: the family's own boundaries, as eess-ts rules
// (ADR-006: rules are code)
import { project, modules } from '@nielspeter/eess-ts'

// 1. No dialect may import another dialect's package directly — they all
//    join only through @nielspeter/eess (the shared kernel). EXCEPTION: the
//    existing arch.rules.ts carve-out, carried forward — crossvalidate is
//    deliberately exempt because its whole job is to bridge dialects
//    (arch.rules.ts:10 "only eess-crossvalidate bridges them"; verified:
//    packages/crossvalidate/src/{md-ts,mermaid-ts,gherkin-ts,md-mermaid}.ts
//    import the siblings directly). Apply the isolation rule per-dialect for
//    ts/md/mermaid/gherkin only; crossvalidate is the bridge, not a violation.
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('packages/{ts,md,mermaid,gherkin}/src/**')
  .should()
  .notImportFromCondition('packages/{ts,md,mermaid,gherkin,crossvalidate}/**')
  .check()

// 2. Each dialect's index re-exports what its own body imports from the kernel —
//    the re-export-completeness guard. The per-dialect allowlist is explicit:
//    eess-ts's index deliberately does NOT re-export `correspondence` /
//    `matchSelections` / `applyFixes` (0088's exception — they serve
//    crossvalidate/md, and matchSelections backs eess-ts's own cross-layer
//    builder), while crossvalidate's index MUST re-export them. The rule reads
//    each package's own allowlist before asserting completeness.
modules(project('tsconfig.json'))
  .that()
  .resideInFile('packages/*/src/index.ts')
  .should()
  .satisfy(reExportsWhatBodyUsesWithAllowlist)
  .check()

// 3. The kernel never imports a dialect (it is the seam, not a join).
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('packages/core/src/**')
  .should()
  .notImportFromCondition('packages/{ts,md,mermaid,gherkin,crossvalidate}/**')
  .check()
```

The custom condition (`reExportsWhatBodyUses`) is defined via
`defineCondition` in the rule file, reading each package's own sources and
asserting every kernel symbol those sources import is also re-exported from that
package's `index.ts` — the standalone invariant, mechanically. This is the
dogfood: the tool that guards family architecture is the family's own tool.

**Tests:** the rule file itself is executable (its violations are the
reconciliation list as errors); `check:family` wired into `validate`; plus the
unit cases for `reExportsWhatBodyUsesWithAllowlist` (a missing re-export reds, a
complete one greens — the same fixture-style test the other dogfood rules carry).

**Non-vacuity:** `check:family` is a new gate, so it gets a committed violating
fixture in `scripts/check-nonvacuity.mjs` — a temp sibling-import probe for rule 1
(a `packages/md/src` file importing `@nielspeter/eess-ts`) and a temp `index.ts`
that drops a kernel re-export for rule 2, each asserted to make `check:family`
exit non-zero naming the violation. A negative rule whose globs silently match
zero is exactly the failure class `check:nonvacuity` exists for; the harness must
prove each `family.rules.ts` rule can fail. (The unit cases are vitest; the
harness row is the gate-level proof.)

### Phase 2 — Standalone-consumption test per dialect

A fixture that installs **only** the dialect package (dist, as a foreign consumer
would) and runs its primary path — md: `check` over a live corpus; mermaid:
diagram check; gherkin: scenario check. No `@nielspeter/eess` import in sight.
(0088 Phase 4 builds the same fixture for eess-ts as part of the fold; this phase
does not wait on it — the shape is small and the promise is already live.)

**`crossvalidate` is the deliberate exception — per its nature, not an
oversight.** `eess-crossvalidate` is a _binding_ tool: its function is to join
two dialects, it declares them as `peerDependencies`, and "run a two-dialect
correspondence with crossvalidate installed alone" is not satisfiable. Its
standalone-consumption fixture installs **crossvalidate + the two dialects it
binds** (honoring its peer deps) and asserts the correspondence works with no
`@nielspeter/eess` import in sight. This is the same deliberate-exception shape
0088 carves for `correspondence`/`matchSelections`. The per-dialect sufficiency
invariant stands for md/mermaid/gherkin; crossvalidate's guarantee is "one
package + its peers, no kernel."

**Files changed:** a `tests/standalone/` per package (or a shared script if the
shape generalizes). **Tests:** the four fixtures, each asserting the dialect's
CLI/gate works with nothing but the single package (plus peers, for
crossvalidate) installed.

## Test inventory

- Phase 1: `family.rules.ts` — the dialect-isolation and re-export-completeness
  rules, run via `check:family` (wired into `validate`); unit cases for the
  `reExportsWhatBodyUsesWithAllowlist` custom condition (missing re-export reds,
  complete greens) + its non-vacuity harness row (a temp sibling-import probe and
  a temp dropped-re-export probe, each reddening `check:family`).
- Phase 2: **four** standalone-consumption fixtures — md/mermaid/gherkin install
  the single dialect alone; **crossvalidate installs the dialect + its two peer
  dialects** (its binding nature is the deliberate exception), each with no
  `@nielspeter/eess` import in sight.

## Out of scope

- **The fold itself** (engine rejoining, ADR-008/009 port) — plan
  [0088](./0088-fold-ts-archunit-into-eess.md). This plan does **not** depend on
  it; both can proceed in either order.
- **Reconciling the sibling dogfood gates to fail-closed** —
  [0101](./0101-sibling-gates-go-fail-closed.md), the other half of this split.
  That work cannot start until the folded kernel seam exists; this can.
- **Sibling engine features beyond the re-export surface** — e.g. md adopting
  `terms()`/`vocabulary()` (proposal 001), or any dialect gaining new capability
  from the ported engine. New _surface_ is a proposal/plan.
- **Standalone sufficiency for `eess-ts` itself** — 0088's binding invariant.

## Success definition

- **Md/mermaid/gherkin** usable alone: correct re-export surface + a passing
  standalone-consumption fixture. **Crossvalidate** usable as "one package + its
  two peer dialects, no kernel" — its binding nature is the deliberate exception.
- `family.rules.ts` enforces the family's boundaries (with the crossvalidate
  bridge carve-out carried from `arch.rules.ts`) and per-dialect re-export
  completeness (with the explicit per-dialect allowlist) via `check:family` in
  `validate` — rules, not script tests, so nothing can silently regress them.
- The eess-ts "exception" list from 0088 is honored by the per-dialect allowlist
  (each dialect re-exports the kernel surface its own users touch, minus the
  named exceptions).
- `npm run validate` green with `check:family` live and proven non-vacuous.

## Progress ledger

- [ ] Phase 1 — per-dialect re-export shake-out + `family.rules.ts` (with
      crossvalidate bridge carve-out + allowlist) + `check:family` + non-vacuity row
- [ ] Phase 2 — standalone-consumption fixtures (md/mermaid/gherkin alone;
      crossvalidate with its peers)
