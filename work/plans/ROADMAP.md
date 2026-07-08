# eess Development Roadmap

**Spec:** `docs/manifesto.md` + the binding decisions in `adr/`.

eess is a family: a dialect-independent kernel (`@nielspeter/eess`) with sibling
dialects — `eess-ts` (the flagship TypeScript dialect, evolved from ts-archunit's
engine), `eess-mermaid`, `eess-md`, and `eess-crossvalidate` — cross-validated
against each other and dogfooded against this repo. See the manifesto and the
calculator walkthrough (`docs/eess-walkthrough-calculator.md`) for the framing.

This repo is a **new, experimental, private** product. Its history starts at plan
0051 (the consolidation onto the shared kernel); the TypeScript dialect's own
prior feature work lives in the separate ts-archunit product and is not tracked
here.

---

## Track

| Order | Plan                                                                                | Ships                                                                             | Status  | Depends on       |
| ----- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | ---------------- |
| 1     | [Consolidation — `eess` monorepo (0051)](./0051-consolidation-eess-monorepo.md)     | `@nielspeter/eess` kernel + `eess-ts`, `eess-mermaid` on it                       | Built ✓ | —                |
| 2     | [Markdown dialect (0058)](./0058-markdown-dialect-eess-md.md)                       | `@nielspeter/eess-md` — corpus links, code pointers, tiered ADR enforcement gate  | Built ✓ | 0051             |
| 3     | [Cross-validation primitive (0059)](./0059-cross-validation-eess-crossvalidate.md)  | `@nielspeter/eess-crossvalidate` — `correspondence()`, Mermaid↔TS + MD↔TS presets | Built ✓ | 0051, 0058       |
| 4     | [Full-coverage dogfooding (0060)](./0060-full-coverage-dogfooding.md)               | eess validates eess for real — all six gates active + proven non-vacuous          | Built ✓ | 0051, 0058, 0059 |
| 5     | [Spec↔code hard feedback PoC (0061)](./0061-spec-code-hard-feedback-poc.md)         | `rows()` + md `.select()`; `check:spec` binds README + ADR-index to code          | Built ✓ | 0058, 0059, 0060 |
| 6     | [Correspondence ergonomic bricks (0062)](./0062-correspondence-ergonomic-bricks.md) | split `keyBy` on `correspondence()` + `files()` selection factory                 | Built ✓ | 0061             |
| 7     | [Deterministic autofix (0066)](./0066-eess-deterministic-autofix.md)                | `--fix` for unique link/pointer resolutions — kernel `ArchFix` + md fixers        | Built ✓ | 0062             |
| 8     | Workflow dialect (future, numbered when scheduled)                                  | `@nielspeter/eess-workflow` — only if demand emerges                              | idea    | 0051             |

---

## What's built

A dialect-independent kernel with four dialects, all dogfooded against this repo:

- **`@nielspeter/eess`** — the kernel: rule engine, `correspondence()` primitive,
  `ArchFix` autofix model. No dialect knowledge.
- **`@nielspeter/eess-ts`** — the TypeScript dialect (ts-morph): imports, bodies,
  layers, types, presets, CLI, body-analysis matchers.
- **`@nielspeter/eess-mermaid`** — Mermaid class diagrams.
- **`@nielspeter/eess-md`** — Markdown corpus: link/pointer resolution, tiered ADR
  enforcement tables.
- **`@nielspeter/eess-crossvalidate`** — binds two dialects (Mermaid↔TS, MD↔TS) so
  drift in either fails the build.

The `npm run validate` chain runs all six gates (`check:spec`, `check:corpus`,
`check:arch`, `check:diagram`, `check:crossval`, non-vacuity) plus typecheck,
lint, format, and the full test suite — eess enforcing its own specs against its
own code.

---

## Next

No externally-committed roadmap. This is an experimental repo; the next dialect
(workflows) ships only if demand emerges. Design ideas are captured as new plans
under `work/plans/` when scheduled.

[Plan 0067](./0067-harness-informed-roadmap.md) captures harness-engineering
learnings (from OpenAI's and Stripe's public write-ups): quick wins landed
(`check:fast`, agent-actionable gate output), plus proposed phases — coverage
grades over time, broader autofix, an author→validate→fix loop, and the Tier 2/3
mechanization frontier.
