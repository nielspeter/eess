# Dogfood coverage — eess as customer zero (plan 0060)

**Phase 0 audit run:** 2026-07-04, report-only, over the 5-package workspace
(`core`, `ts`, `mermaid`, `md`, `crossvalidate`; the alias package is excluded
a-priori — a re-export shim whose only import is its target by design).
**Raw inventory: 356 violations across 12 of 24 candidate rules.**

This file is the plan's central audit surface: every adopted rule, every
a-priori exclusion with its reason, every rejected rule with its reason. The
README's coverage claim links here. Inline sanctions use the tool's own
mechanism — `// eess-exclude <rule-id>: <reason>` — so the full sanction
list is greppable.

## Gate status — ALL ACTIVE (plan 0060 complete 2026-07-04; `check:spec` added by 0061 2026-07-06)

| Gate               | Dialect                             | Enforces on this repo                                                                                                                                                                               |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:integrity`  | (hand script)                       | package.json phantom deps + local linking — deliberately not a dialect (JSON isn't a dialect language)                                                                                              |
| `check:arch`       | eess-ts                             | cross-package boundaries (kernel purity, dialect isolation, ADR-002 raw-ts ban) + internal policy over every package                                                                                |
| `check:diagram`    | eess-mermaid                        | `docs/architecture.mmd` (kernel charter) — every class carries `<<kernel>>`                                                                                                                         |
| `check:crossval`   | eess-crossvalidate                  | diagram↔code (both directions, kernel charter) + ADR↔test citations resolve in the AST                                                                                                              |
| `check:corpus`     | eess-md                             | 100 docs (plans/adr/bugs/docs): links with static-site resolution, live code pointers, tiered ADR enforcement                                                                                       |
| `check:spec`       | eess-md + kernel `correspondence()` | markdown _specs_ bound to code — README Packages table ↔ workspace (names both ways + Status↔version), CLAUDE.md ADR index ↔ `adr/*.md` (both ways + link resolve). See `spec.rules.ts` (plan 0061) |
| `check:nonvacuity` | (harness)                           | every gate above proven to FAIL on committed violating fixtures — no green-but-empty gates                                                                                                          |

**Every dialect enforces on its own repo.** ADR Enforcement clauses across the
seven ADRs: **14 `gated` · 1 `pending`** (ADR-007 confinement — the declared
honest gap, its own future plan) **· 6 `manual`/tier-5**. Rule candidates from
the audit: 24/24 adopted, 0 rejected.

## Phase 0 inventory and dispositions

Clean at audit (adopt as-is; non-vacuity proofs land in Phase 6):
`layering/ts/cli-is-a-leaf`, `layering/mermaid/cli-is-a-leaf`,
`layering/{ts,mermaid}/no-upward-imports`, `cycles/package-toplevel-folders`,
`security/no-console-outside-cli`, `security/no-eval`,
`hygiene/no-stub-comments`, `hygiene/no-empty-bodies`,
`quality/no-magic-numbers`, `metrics/max-complexity-10`,
`metrics/max-method-lines-50`.

| Rule                                  | Raw | Disposition                                                                                                                                                                                                                                                              |
| ------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layering/md/no-upward-imports`       | 2   | **FIX** — real violations: `md/conditions/{pointer-resolve,resolve}.ts` import from `builders/`. Hoist the shared piece below the builder layer.                                                                                                                         |
| `errors/no-silent-catch`              | 7   | **FIX** — bind and handle (or bind + explain) every catch.                                                                                                                                                                                                               |
| `quality/no-public-fields`            | 3   | **FIX** — `ArchRuleError.violations` → readonly getter (API-shape preserved); `RunScheduler.runCount` ×2 → getter.                                                                                                                                                       |
| `metrics/max-parameters-4`            | 1   | **FIX** — `InconsistentSiblingsBuilder.buildFolderViolations` (5 params → options object).                                                                                                                                                                               |
| `quality/jsdoc-on-public-methods`     | 99  | **ADOPT + FIX ALL** — md 8, mermaid 18, ts 73, **core 0 (kernel already fully documented)**. These are the fluent surfaces users hover in IDEs; product-grade docs, not busywork.                                                                                        |
| `typescript/no-type-assertions`       | 39  | **ADOPT + FIX ALL** — first mechanical enforcement of ADR-005 (eslint has no as-ban configured; bare casts exist, e.g. `core/baseline.ts:91`). Each site: remove the cast, or sanction as a documented boundary via `eess-exclude` with reason. Zero bare sites at exit. |
| `typescript/no-non-null-assertions`   | 16  | **ADOPT + FIX ALL** — same treatment as above.                                                                                                                                                                                                                           |
| `hygiene/no-dead-modules`             | 17  | **ADOPT with a-priori exclusion** — all 17 are entry points (package `index.ts`, subpath-export modules, CLI bins). The exclusion list _is_ the `package.json` `exports`+`bin` map: entry points are import-graph roots by definition. Zero genuinely dead files found.  |
| `hygiene/no-unused-exports`           | 159 | **ADOPT scoped to non-entry modules** — raw count dominated by the public API surface (exports exist _for_ consumers, invisible to reverse-dep analysis). Phase 4 applies the entry-point exclusion and fixes the true remainder (de-export or delete).                  |
| `security/no-process-env-outside-cli` | 6   | **ADOPT with a-priori exclusion** — all 6 in `core/ansi.ts` (NO*COLOR/FORCE_COLOR) + `core/environment.ts` (CI detection): these modules \_are* the environment boundary; reading `process.env` is their declared purpose. Everything else stays banned.                 |
| `metrics/max-methods-20`              | 6   | **ADOPT with a-priori exclusion of `**/builders/**`+ kernel`RuleBuilder`** — ADR-003's fluent DSL makes a wide method surface the _design_ (`ClassRuleBuilder`'s 37 methods are the API). Non-builder classes stay bounded.                                              |
| `metrics/max-class-lines-300`         | 1   | Same ADR-003 exclusion (kernel `RuleBuilder`, 353 lines — the base of the fluent grammar).                                                                                                                                                                               |

**Rejected rules: 0.** Every candidate rule is adopted (11 already clean, 12 with fixes and/or a-priori exclusions above, 1 pending feasibility below).

**Deferred to Phase 4 decision:** `hygiene/no-only-in-tests`-style test rules — test
files are outside the build tsconfigs; requires a second `workspace()` over dev
tsconfigs. Adopted if the load cost is acceptable, else rejected here with that
reason.

## Fix workload — CLOSED OUT (2026-07-04, decision 1 honored: no baseline)

From 356 raw at audit to **0 violations across both rule files**
(`arch.rules.ts` + `arch.internal.rules.ts`, combined `check:arch`, gated in CI):

- 13 structural fixes (layering 2, catches 7, fields 3, params 1) — all real.
- 99 JSDoc blocks written against the actual method sources.
- 55 assertion sites: **42 real fixes** (`in`-narrowing, type predicates,
  `Function.prototype.call`, destructuring/guards) + **13 sanctioned** interop
  boundaries. **Non-null: 16/16 real-fixed, zero sanctions.**
- 32 unused-export dispositions: 2 deleted as dead, 4 un-exported, the rest
  kept for declaration-emit or test consumption — each sanctioned with the
  stated reason.

### Sanction manifest (inline `eess-exclude`, greppable)

`grep -rn "eess-exclude" packages/*/src` — current counts:
**13** × `eess/adr005-no-type-assertions` (tuple-union rest params ×5, jiti/`Function`
interop, compiler-internal `Symbol.links`, optional-peer `require()`, module shapes),
**19** × `eess/no-unused-exports` (exported-signature types required by
declaration emit; test-suite consumers). **0** × everything else.

### Product bugs found and fixed by this phase's dogfooding

1. `noPublicFields` flagged ES `#private` fields (no scope modifier →
   reported public). Fixed in the rule + regression test.
2. **Inline exclusion comments were inert for most conditions** — only two
   conditions stamped `ruleId`, and the comment matcher requires it, so
   sanctions silently matched nothing (unit tests existed; no e2e coverage).
   Fixed in the kernel: `applyFilters` stamps the rule's id onto violations
   lacking one. End-to-end regression test added.
3. (Earlier phases: eess-ts CLI couldn't load `.ts` rule files — jiti fix.)

## eess-md (Phase 5 baseline, from the same audit)

- Live-pointer check over the current corpus: 3 findings — 1 genuinely stale
  (a pre-monorepo test path in plan 0055, since fixed), 2 false positives
  from example/foreign pointers → the fence-aware liveness feature.
- `docs/**` links unresolvable pending generic `tryExtensions`/`tryIndex`
  resolution (VitePress-style extensionless links).

## Spec↔code bindings (plan 0061, 2026-07-06)

Beyond "artifacts are internally honest" (`check:corpus`), `check:spec` binds
markdown _specs_ to the code they describe via kernel `correspondence()`, so
drift in either direction fails the build. Two bindings, both dogfooded:

| Spec (consumed by)                         | Bound to     | Rule id(s)                                                                   |
| ------------------------------------------ | ------------ | ---------------------------------------------------------------------------- |
| README Packages table (npm/GitHub install) | `packages/*` | `spec/readme-packages-match-workspace`, `spec/readme-status-matches-version` |
| CLAUDE.md ADR index (every agent session)  | `adr/*.md`   | `spec/adr-index-matches-files`, `spec/adr-index-links-resolve`               |

- **Consumer principle held:** both tables are read (install decisions; agent
  context) — no binding for binding's sake.
- **Sanctions on the spec gates: 0.** `grep -rn "eess-exclude" spec.rules.ts`
  → none. Zero false positives across the repo.
- **First-run catch (real drift):** the README table was missing `eess-md` and
  `eess-crossvalidate` (both in the workspace) — caught red, then fixed.
- **Closed loop verified:** a fresh agent given only the gate's `--format json`
  repaired an introduced drift with no human interpretation. `check:spec`
  wall-clock ≈ 0.4s. Full account: [plan 0061 as-built](./plans/0061-spec-code-hard-feedback-poc.md).
