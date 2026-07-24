# eess Development Roadmap

**Spec:** `docs/manifesto.md` + the binding decisions in `adr/`.

The board for **work**. Open items first, shipped history last. **Every row links
to a real plan file** — there are no numberless "ideas" and no numbers reserved
for plans that do not exist. If it is worth listing, it is worth a Draft.

**State** is the working method's own vocabulary, so a row means exactly what the
plan header says: `Draft` (written, not committed to) · `Ready` (floor frozen,
buildable) · `Done`. **Priority:** P1 do next · P2 worth doing, unblocked · P3
blocked on an external signal.

---

## State of play — 2026-07-24

**0077 shipped** (merged 2026-07-24, PR #22) — the author→validate→fix loop as the
`adr-enforce` **Workflow**, with the author/verifier separation _enforced_
structurally (separate `agent()` context + `model:` split). Dogfooded twice on
ADR-007's confinement clause; one item is `validation-owed` (the fix path is
code-verified but never fired live). No bug is open ([`BUGS.md`](../bugs/BUGS.md) —
0074 fixed). Six open plans, all `Draft`; three are blocked on signals that do not
exist yet (adopter data, adopter feedback, a mechanism nobody has). A 2026-07-23
attempt to unblock 0073 with ts-archunit as a proxy corpus was rejected (fixture
noise + thin signal — recorded in the plan).

**Released v0.2.1** — `@nielspeter/eess` and `@nielspeter/eess-ts` to `0.2.1`
(the other four dialects unchanged at `0.1.2`). Ships the
[bug 0074](../bugs/fixed/0074-init-esm-type-module.md) fix: the CLI loads its
config through jiti, so `eess-ts check` no longer crashes on its own scaffolded
config in a CommonJS-default project — the first thing a new adopter hit.

To start work: pick a P2, run `/plan-ready` to freeze its floor, then
`/plan-build`.

---

## To do

| Item                                                                                        | Priority | State | Ships                                                                                                                                                                      | Blocked on                                                                             |
| ------------------------------------------------------------------------------------------- | -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [0076 — broader deterministic autofix](./0076-broader-deterministic-autofix.md)             | P2       | Draft | extend the `ArchFix` model past link/pointer to other **provably-unique** repairs; two originally-named candidates fail that test and are recorded as rejects              | — buildable now                                                                        |
| [0073 — violation telemetry + rule staleness](./0073-violation-telemetry-rule-staleness.md) | P2       | Draft | aggregate `--format json` runs + baselines → dominating-pattern analysis, human-ratified rule proposals, retirement signals (_decay_) + coverage grades trended (_growth_) | real, churning adopter — ts-archunit rejected 2026-07-23 (fixture noise + thin signal) |
| [0075 — manifesto reconciliation](./0075-manifesto-reconciliation.md)                       | P3       | Draft | restructure into thesis · shipped doctrine · horizon; give the binding doc an Enforcement table and Tier-5 ratification                                                    | adopter feedback                                                                       |
| [0078 — workflow dialect](./0078-workflow-dialect.md)                                       | P3       | Draft | `@nielspeter/eess-workflow` — CI workflows validated against `package.json` scripts and the packages table                                                                 | demand; the dogfood case may not justify a sixth package                               |
| [0079 — Tier 2/3 mechanization](./0079-tier-2-3-mechanization.md)                           | P3       | Draft | bind a clause to a _behaviour_, not just to a test's name — the frontier eess has never crossed                                                                            | a mechanism; none exists, and an 83-talk sweep found none                              |
| [0081 — port checkAll](./0081-port-checkall.md)                                             | P3       | Draft | test-file terminal for an array of rules — run all, aggregate, throw one `ArchRuleError`; the one ts-archunit 0.17.0 export eess-ts still lacks                            | demand — a test-file adopter (eess's CLI already aggregates)                           |

Six Drafts, none committed to — they came from [plan 0067](./completed/0067-harness-informed-roadmap.md)'s proposed phases and the [external-signals research](../research-external-signals-2026-07.md); 0081 came from the 2026-07-23 ts-archunit parity audit. Nothing here is externally promised.

---

## Shipped

| Plan                                                                                          | Ships                                                                                                                                                                                      | State |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| [0051 — consolidation onto one kernel](./completed/0051-consolidation-eess-monorepo.md)       | `@nielspeter/eess` kernel + `eess-ts`, `eess-mermaid` on it                                                                                                                                | Done  |
| [0058 — Markdown dialect](./completed/0058-markdown-dialect-eess-md.md)                       | `@nielspeter/eess-md` — corpus links, code pointers, tiered ADR enforcement gate                                                                                                           | Done  |
| [0059 — cross-validation primitive](./completed/0059-cross-validation-eess-crossvalidate.md)  | `@nielspeter/eess-crossvalidate` — `correspondence()`, Mermaid↔TS + MD↔TS presets                                                                                                          | Done  |
| [0060 — full-coverage dogfooding](./completed/0060-full-coverage-dogfooding.md)               | eess validates eess for real — all six gates active + proven non-vacuous                                                                                                                   | Done  |
| [0061 — spec↔code hard feedback PoC](./completed/0061-spec-code-hard-feedback-poc.md)         | `rows()` + md `.select()`; `check:spec` binds README + ADR-index to code                                                                                                                   | Done  |
| [0062 — correspondence ergonomic bricks](./completed/0062-correspondence-ergonomic-bricks.md) | split `keyBy` on `correspondence()` + `files()` selection factory                                                                                                                          | Done  |
| [0066 — deterministic autofix](./completed/0066-eess-deterministic-autofix.md)                | `--fix` for unique link/pointer resolutions — kernel `ArchFix` + md fixers                                                                                                                 | Done  |
| [0067 — harness-informed roadmap](./completed/0067-harness-informed-roadmap.md)               | `check:fast` + agent-actionable gate output (closed at Phase 1; its four proposed phases are the unnumbered rows above)                                                                    | Done  |
| [0068 — working-method kit](./completed/0068-working-method-kit.md)                           | portable method: docs + seed templates + skills (`/plan-*`, `/bug`, universal `/close`) + one promoted gate (`check:ledger`); the freeze stays a skill-borne habit                         | Done  |
| [0069 — spec-corpus reach](./completed/0069-spec-corpus-reach.md)                             | `eess-gherkin` sibling dialect · md↔gherkin citation crossval · erDiagram grammar + parameterized table↔diagram binding · vocabulary primitive · external-root pointers                    | Done  |
| [0070 — caller owns reporting](./completed/0070-caller-owns-reporting.md)                     | split detect/report/throw — one format-aware reporter; presets emit `--format json` + a non-throwing return; kills double-print (ADR-008)                                                  | Done  |
| [0071 — ts-archunit parity](./completed/0071-ts-archunit-parity.md)                           | `recommended` + `agentGuardrails` presets · `explain --format agent` + `imperative` metadata · `tsconfig()` rule · `eess-ts init` (builder-expanded floor)                                 | Done  |
| [0072 — adoption surface](./completed/0072-adoption-surface.md)                               | front-door README inversion (the wedge) · manifesto heritage + constraints-not-a-map + staleness stance · agent-loop recipes (Action/hook/AGENTS.md) · 5-min red gate                      | Done  |
| [0080 — gherkin↔ts crossvalidation](./completed/0080-gherkin-ts-crossvalidation.md)           | scenario↔test binding, both directions — `scenarioTestsResolve` + `scenariosCovered`; live in `check:crossval` (2026-07-23) over `specs/scenario-binding.feature`, with a nonvacuity probe | Done  |
| [0077 — author → validate → fix loop](./completed/0077-author-validate-fix-loop.md)           | `adr-enforce` **Workflow** — author/verifier separation _enforced_ (separate `agent()` context + `model:` split); bounded 1-fix loop, green-or-escalate; dogfooded on ADR-007 confinement  | Done  |

---

## What's built

A dialect-independent kernel with five dialects, all dogfooded against this repo:

- **`@nielspeter/eess`** — the kernel: rule engine, `correspondence()` primitive,
  `ArchFix` autofix model. No dialect knowledge.
- **`@nielspeter/eess-ts`** — the TypeScript dialect (ts-morph): imports, bodies,
  layers, types, presets, CLI, body-analysis matchers.
- **`@nielspeter/eess-mermaid`** — Mermaid class diagrams.
- **`@nielspeter/eess-md`** — Markdown corpus: link/pointer resolution, tiered ADR
  enforcement tables.
- **`@nielspeter/eess-gherkin`** — Gherkin feature files; citations crossvalidate
  against the Markdown corpus.
- **`@nielspeter/eess-crossvalidate`** — binds two dialects (Mermaid↔TS, MD↔TS) so
  drift in either fails the build.

The `npm run validate` chain runs every gate (`check:spec`, `check:corpus`,
`check:ledger`, `check:arch`, `check:diagram`, `check:crossval`, non-vacuity)
plus typecheck, lint, format, and the full test suite — eess enforcing its own
specs against its own code.

This repo is a **new, experimental, private** product. Its history starts at plan
0051 (the consolidation onto the shared kernel); the TypeScript dialect's own
prior feature work lives in the separate ts-archunit product and is not tracked
here.
