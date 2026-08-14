# eess Development Roadmap

**Spec:** `docs/manifesto.md` + the binding decisions in `adr/`.

The board for **work**. Open items first, shipped history last. **Every row links
to a real plan file** — there are no numberless "ideas" and no numbers reserved
for plans that do not exist. If it is worth listing, it is worth a Draft. Nothing
here is externally promised.

This repo is a **new, experimental, private** product. Its history starts at plan
0051 (the consolidation onto the shared kernel); the TypeScript dialect's own
prior feature work lives in the separate ts-archunit product and is not tracked
here.

For what the packages are and what the gate chain runs, see the README and
`CLAUDE.md` — the README's Packages table is the copy `check:spec` gates against
the workspace, so this board deliberately keeps no second, unchecked one.

**Released:** `@nielspeter/eess` and `@nielspeter/eess-ts` at `0.2.1`; the other
four dialects at `0.1.2`.

---

## Vocabulary

**State** is the working method's own, so a row means exactly what the plan
header says: `Draft` (written, not committed to) · `Ready` (floor frozen,
buildable) · `Done`.

**Priority** is scaled to what this product claims, the same way
[`BUGS.md`](../bugs/BUGS.md)'s Severity is. A bug's severity asks how badly a
defect breaks the promise that a green gate means something; a plan's priority
asks how much the work strengthens it:

| Priority   | Meaning                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **High**   | closes a gap between what eess **claims** and what it **checks** — a green run means more after this lands than before       |
| **Medium** | extends reach, ergonomics, or adoption surface — a green run means the same, there is just more of it or it is easier to get |
| **Low**    | speculative or demand-driven — the product is whole without it, and doing it now would be guessing                           |

**Priority is not a schedule.** It ranks what the work is worth, never whether it
can start — that is the `Blocked on` column's job, and the two are independent. A
`High` row can be unstartable and a `Low` row buildable this afternoon.

**To start work:** pick the highest-priority row whose `Blocked on` reads
_buildable now_. Then `/plan-ready` to freeze its floor, and `/plan-build`.

---

## To do

| Item                                                                                                 | Priority | State | Ships                                                                                                                                                                                                                                                                                                                                                 | Blocked on                                                                             |
| ---------------------------------------------------------------------------------------------------- | -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [0076 — broader deterministic autofix](./0076-broader-deterministic-autofix.md)                      | Medium   | Draft | extend the `ArchFix` model past link/pointer to other **provably-unique** repairs; two originally-named candidates fail that test and are recorded as rejects                                                                                                                                                                                         | — buildable now                                                                        |
| [0073 — violation telemetry + rule staleness](./0073-violation-telemetry-rule-staleness.md)          | Low      | Draft | aggregate `--format json` runs + baselines → dominating-pattern analysis, human-ratified rule proposals, retirement signals (_decay_) + coverage grades trended (_growth_)                                                                                                                                                                            | real, churning adopter — ts-archunit rejected 2026-07-23 (fixture noise + thin signal) |
| [0075 — manifesto reconciliation](./0075-manifesto-reconciliation.md)                                | High     | Draft | restructure into thesis · shipped doctrine · horizon; give the binding doc an Enforcement table and Tier-5 ratification                                                                                                                                                                                                                               | adopter feedback                                                                       |
| [0078 — workflow dialect](./0078-workflow-dialect.md)                                                | Low      | Draft | `@nielspeter/eess-workflow` — CI workflows validated against `package.json` scripts and the packages table                                                                                                                                                                                                                                            | demand; the dogfood case may not justify a sixth package                               |
| [0079 — Tier 2/3 mechanization](./0079-tier-2-3-mechanization.md)                                    | High     | Draft | bind a clause to a _behaviour_, not just to a test's name — the frontier eess has never crossed                                                                                                                                                                                                                                                       | a mechanism; none exists, and an 83-talk sweep found none                              |
| [0081 — port checkAll](./0081-port-checkall.md)                                                      | Low      | Draft | test-file terminal for an array of rules — run all, aggregate, throw one `ArchRuleError`; the one ts-archunit 0.17.0 export eess-ts still lacks                                                                                                                                                                                                       | demand — a test-file adopter (eess's CLI already aggregates)                           |
| [0088 — fold ts-archunit 0.59 into eess](./0088-fold-ts-archunit-into-eess.md)                       | High     | Draft | fold its 0.59 engine back into kernel + eess-ts; port ts-archunit ADR-008/009 as eess ADR-009/010 (the fail-closed doctrine); author the breaking release as merged changesets; correct the stale "eess is ahead" record                                                                                                                              | — buildable now                                                                        |
| [0089 — family standalone sufficiency](./0089-family-standalone-sufficiency.md)                      | High     | Draft | each dialect usable alone — per-dialect re-export surface shaken out and guarded by `family.rules.ts` + a new `check:family` gate (crossvalidate's guarantee is "one package + its two peers")                                                                                                                                                        | — buildable now                                                                        |
| [0090 — adopt ts-archunit work corpus](./0090-adopt-ts-archunit-work-corpus.md)                      | Medium   | Draft | migrate ts-archunit's plans/bugs/ADRs/docs into eess — history frozen as heritage under `docs/heritage/`, open engine work re-numbered + re-homed onto the eess board                                                                                                                                                                                 | 0088 (retirement context); per-item re-homing decision in Phase 1                      |
| [0091 — cross-dialect examples, checked](./0091-cross-dialect-examples-checked.md)                   | Medium   | Ready | dogfood `eess-crossvalidate` as **executing** examples — one per README binding (green + red + non-vacuity, incl. a new `adrCitationStats` on md-ts) + all six internal deps declared `workspace:*`; the five legacy `examples/` tests stay typecheck-only (deferred)                                                                                 | — buildable now                                                                        |
| [0096 — dogfood missing crossvalidate bindings](./0096-dogfood-missing-crossvalidate-bindings.md)    | High     | Draft | mount `md↔gherkin` + `md↔mermaid` in `check:crossval` on the repo's own artifacts (plant a real `scenario-binding.feature` citation; validate embedded `mermaid` fences) — the project dogfoods 5 of 7 bindings, not 3; `md↔mermaid-er` parked (no erDiagram)                                                                                         | — buildable now                                                                        |
| [0100 — publish the fold, retire ts-archunit](./0100-publish-the-fold-retire-ts-archunit.md)         | High     | Draft | the acts that cannot land in a PR — the coordinated six-package release, `npm deprecate @nielspeter/ts-archunit`, repo archival, and the retirement test that flips ADR-009's row to `gated`; split off 0088 so that plan closes at merge                                                                                                             | 0088 + 0089 + 0101 merged                                                              |
| [0101 — sibling gates go fail-closed](./0101-sibling-gates-go-fail-closed.md)                        | High     | Draft | opt the four sibling dogfood gates into the folded honest-gate seam — classify every silent-empty selection (`.expectEmpty()`, fix, or in-scope-with-reason), zero baselines; file what the honesty surfaces as its own bugs                                                                                                                          | 0088 Phase 4 (the folded kernel seam)                                                  |
| [0142 — bind accepted proposals to plans](./0142-bind-proposals-to-plans.md)                         | Medium   | Ready | make `**Ruling:` a literal, parseable field (skill + `PROPOSALS.md` + five real files); gate proposal→plan linkage in `check:corpus` via a declared `**Implements:**` back-reference — closes what [bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md) diagnosed, after its own six-persona review found the naive Fix unbuildable | — buildable now                                                                        |
| [0145 — crossvalidate: detect a stale `@wip` exemption](./0145-crossvalidate-stale-wip-detection.md) | Medium   | Ready | `scenarioExemptionsCurrent` + `citedScenarioSites` on `eess-crossvalidate`'s `gherkin-ts` subpath — a strong-tier, `bad-release-e2e.mjs`-shaped non-vacuity fixture, folding in one row of bug 0112; implements [proposal 005](../proposals/005-crossvalidate-stale-wip-detection.md), accepted after a third review round                            | — buildable now                                                                        |

**Read of the board (2026-08-12).** All seven `High` rows are honesty work, and
three can be started today: **0088**, **0089**, and **0096**, none of which waits
on anything. 0101 needs 0088's folded kernel seam, 0100 needs the three code plans
merged, 0075 waits on adopter feedback, 0079 on a mechanism nobody has, and every
`Low` row on a signal that does not exist yet. The one `Ready` row, 0091, is also
buildable now — so there are four items that could start this afternoon.

**Why three cells changed on 2026-08-12.** The `Blocked on` column was carrying
_relationships_ as if they were _dependencies_ — 0088's cell described its own
scope, 0096's named its sibling lane, and 0091's transcribed "in the same class
as 0089" into a blocker, against that plan's own frozen header ("No prerequisite
plan; it stands on its own"). 0089's cell dropped the phase qualifier its plan
states explicitly. Net effect: the board reported the only `Ready` plan on it as
unbuildable, and made 0088 look like a pin holding four rows when it holds one
and a half. A relationship worth recording belongs in `Ships` or in the plan; this
column answers one question only — can it start?

---

## Shipped

`Closed` is the date the plan file entered `completed/` — read from git, not
maintained by hand.

| Plan                                                                                          | Ships                                                                                                                                                                                      | Closed     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [0051 — consolidation onto one kernel](./completed/0051-consolidation-eess-monorepo.md)       | `@nielspeter/eess` kernel + `eess-ts`, `eess-mermaid` on it                                                                                                                                | 2026-07-09 |
| [0058 — Markdown dialect](./completed/0058-markdown-dialect-eess-md.md)                       | `@nielspeter/eess-md` — corpus links, code pointers, tiered ADR enforcement gate                                                                                                           | 2026-07-09 |
| [0059 — cross-validation primitive](./completed/0059-cross-validation-eess-crossvalidate.md)  | `@nielspeter/eess-crossvalidate` — `correspondence()`, Mermaid↔TS + MD↔TS presets                                                                                                          | 2026-07-09 |
| [0060 — full-coverage dogfooding](./completed/0060-full-coverage-dogfooding.md)               | eess validates eess for real — all six gates active + proven non-vacuous                                                                                                                   | 2026-07-09 |
| [0061 — spec↔code hard feedback PoC](./completed/0061-spec-code-hard-feedback-poc.md)         | `rows()` + md `.select()`; `check:spec` binds README + ADR-index to code                                                                                                                   | 2026-07-09 |
| [0062 — correspondence ergonomic bricks](./completed/0062-correspondence-ergonomic-bricks.md) | split `keyBy` on `correspondence()` + `files()` selection factory                                                                                                                          | 2026-07-09 |
| [0066 — deterministic autofix](./completed/0066-eess-deterministic-autofix.md)                | `--fix` for unique link/pointer resolutions — kernel `ArchFix` + md fixers                                                                                                                 | 2026-07-09 |
| [0068 — working-method kit](./completed/0068-working-method-kit.md)                           | portable method: docs + seed templates + skills (`/plan-*`, `/bug`, universal `/close`) + one promoted gate (`check:ledger`); the freeze stays a skill-borne habit                         | 2026-07-09 |
| [0069 — spec-corpus reach](./completed/0069-spec-corpus-reach.md)                             | `eess-gherkin` sibling dialect · md↔gherkin citation crossval · erDiagram grammar + parameterized table↔diagram binding · vocabulary primitive · external-root pointers                    | 2026-07-13 |
| [0070 — caller owns reporting](./completed/0070-caller-owns-reporting.md)                     | split detect/report/throw — one format-aware reporter; presets emit `--format json` + a non-throwing return; kills double-print (ADR-008)                                                  | 2026-07-14 |
| [0071 — ts-archunit parity](./completed/0071-ts-archunit-parity.md)                           | `recommended` + `agentGuardrails` presets · `explain --format agent` + `imperative` metadata · `tsconfig()` rule · `eess-ts init` (builder-expanded floor)                                 | 2026-07-14 |
| [0067 — harness-informed roadmap](./completed/0067-harness-informed-roadmap.md)               | `check:fast` + agent-actionable gate output; closed at Phase 1, its four proposed phases re-homed as numbered rows on the board above                                                      | 2026-07-19 |
| [0072 — adoption surface](./completed/0072-adoption-surface.md)                               | front-door README inversion (the wedge) · manifesto heritage + constraints-not-a-map + staleness stance · agent-loop recipes (Action/hook/AGENTS.md) · 5-min red gate                      | 2026-07-19 |
| [0080 — gherkin↔ts crossvalidation](./completed/0080-gherkin-ts-crossvalidation.md)           | scenario↔test binding, both directions — `scenarioTestsResolve` + `scenariosCovered`; live in `check:crossval` (2026-07-23) over `specs/scenario-binding.feature`, with a nonvacuity probe | 2026-07-23 |
| [0077 — author → validate → fix loop](./completed/0077-author-validate-fix-loop.md)           | `adr-enforce` **Workflow** — author/verifier separation _enforced_ (separate `agent()` context + `model:` split); bounded 1-fix loop, green-or-escalate; dogfooded on ADR-007 confinement  | 2026-07-24 |
| [0082 — doc code-fence check gate](./completed/0082-doc-code-fence-typecheck.md)              | `check:docs-code` — `tsc` + `@typescript-eslint/no-deprecated` over self-contained doc fences (`validate` + `ci.yml`); caught 4 real doc bugs on first run, incl. the flagship one-pager   | 2026-07-28 |
