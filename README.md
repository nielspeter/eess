# eess

**Architecture guardrails for AI coding agents.** _Deterministic gates that
ground the agent loop — drift fails the build._

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org/)

AI agents ship code that compiles, passes review at a glance, and quietly
violates the decisions your team spent months establishing — generic errors
instead of your typed ones, inline logic instead of the shared helper, an
import that breaches a layer boundary, a stub that looks finished. A rule in
the prompt is a suggestion; a rule in code cannot be escaped. eess turns your
architecture into rules that run in CI and in the agent's own loop, with
violations written for the agent to fix: what's wrong, **why** it matters, and
**how** to fix it.

## Sixty seconds to an enforced floor

```bash
npm install -D @nielspeter/eess-ts
npx eess-ts init          # scaffolds arch.rules.ts (editable guardrails), config, npm scripts
npx eess-ts check         # runs them — violations carry because / Fix / file:line
```

Then hand the rules to your agent — `explain --format agent` emits an
imperative, sentinel-wrapped block for `AGENTS.md` / `CLAUDE.md`, regenerated
from the actual rules so the agent's instructions can never drift from what CI
enforces:

```bash
npx eess-ts explain arch.rules.ts --format agent >> AGENTS.md
```

When the agent violates a rule anyway, `eess-ts check --format json` gives it
the violation, the rationale, and the suggested fix — in its edit loop, not in
next week's review. See the [agent integration recipes](./docs/agent-integration.md)
for CI, Claude Code hooks, and the AGENTS.md workflow, and the
[`eess-ts` guide](./packages/ts/README.md) for the full DSL (imports, layers,
function bodies, types, metrics, smells).

## It grows into a family

The guardrails are the front door. Behind it, eess is a **compiler for
specs**: markdown ADRs, Mermaid diagrams, Gherkin features, and architecture
rules validated against the code — and against each other — so drift in either
direction fails the build. New here? [What is eess?](./docs/what-is-eess.md) is
a five-minute intro; the [manifesto](./docs/manifesto.md) is the full design;
the [worked example](./docs/eess-walkthrough-calculator.md) builds it up step
by step.

Artifacts are **siblings, not hierarchical**: TypeScript, Mermaid diagrams, and
Markdown specs all sit on equal footing, validated by one shared kernel. This
monorepo is built the same way — a dialect-independent kernel with dialects as
sibling packages around it.

## Packages

| Package                                                      | What it validates                                                        | Status |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------ |
| [`@nielspeter/eess`](./packages/core)                        | The kernel — rule engine, no dialect knowledge                           | 0.2.x  |
| [`@nielspeter/eess-ts`](./packages/ts)                       | TypeScript source (imports, bodies, layers, types)                       | 0.2.x  |
| [`@nielspeter/eess-mermaid`](./packages/mermaid)             | Mermaid class diagrams                                                   | 0.1.x  |
| [`@nielspeter/eess-md`](./packages/md)                       | Markdown corpus — links, code pointers, ADR tables                       | 0.1.x  |
| [`@nielspeter/eess-gherkin`](./packages/gherkin)             | Gherkin features — scenarios as citable elements                         | 0.1.x  |
| [`@nielspeter/eess-crossvalidate`](./packages/crossvalidate) | Cross-validation — diagram↔code, ADR↔test, story↔scenario, scenario↔test | 0.1.x  |

Each dialect depends only on the kernel and its own parser (ts-morph for TS, Langium for Mermaid, mdast for Markdown, a line grammar for Gherkin). The Markdown dialect ([plan 0058](./work/plans/completed/0058-markdown-dialect-eess-md.md)) and cross-validation between dialects ([plan 0059](./work/plans/completed/0059-cross-validation-eess-crossvalidate.md)) are sibling packages on the same kernel — new dialects land without restructuring.

## eess validates eess

Green checkmarks are gameable — agents are measurably good at making a test
pass without solving the problem. eess's answer is that every gate must
**prove it can fail**: this repository is customer zero, every dialect
enforces on the repo that builds it, in CI, with no baselines and no silenced
rules —

- `check:arch` — eess-ts validates the monorepo's own architecture: kernel purity, dialect isolation, and an internal policy (layering, cycles, security, hygiene, metrics, the ADR-005 `as`/`!` bans) over every package ([arch.rules.ts](./arch.rules.ts), [arch.internal.rules.ts](./arch.internal.rules.ts))
- `check:diagram` — eess-mermaid validates [docs/architecture.mmd](./docs/architecture.mmd), the kernel's class diagram
- `check:crossval` — eess-crossvalidate keeps that diagram and the kernel's code in agreement (both directions), resolves every test an ADR cites against the real AST, and binds each Gherkin scenario to the test that proves it (both directions) — a renamed or uncited scenario fails the build
- `check:corpus` — eess-md validates 100 markdown docs: cross-links, live `path:line` code pointers, and the tiered `## Enforcement` table in every [ADR](./adr)
- `check:spec` — eess-md + `correspondence()` bind markdown _specs_ to code: this Packages table stays in sync with the workspace, and the [CLAUDE.md](./CLAUDE.md) ADR index stays in sync with [`adr/`](./adr) — drift either way fails the build ([spec.rules.ts](./spec.rules.ts))
- `check:nonvacuity` — every gate above is proven to fail on committed violating fixtures: no green-but-empty gates

The full audit surface — every adopted rule, every exclusion with its written reason — is [work/dogfood-coverage.md](./work/dogfood-coverage.md).

## AI integration layer

The deterministic gates prove a rule _exists_ and the code _satisfies_ it — not that the rule _means_ what the ADR clause says. That last check is a judgment (Tier 4), so it's done by an agent. [`skills/`](./skills) ships two Claude Code skills for the loop: **`eess-adr-author`** (translate a decision into an enforceable rule + an honest Enforcement row) and **`eess-adr-validate`** (adversarially audit that the rule faithfully enforces the clause). See [skills/README.md](./skills/README.md).

## Development

npm workspaces. Build order is kernel → dialects (a dialect typechecks against the kernel's built declarations).

```bash
npm install
npm run build        # all packages, in dependency order
npm run test         # all workspaces
npm run typecheck
npm run lint
```

Releases use [changesets](https://github.com/changesets/changesets) with independent per-package versioning (`npm run changeset` to record a change, `npm run version-packages` to apply bumps).

## License

MIT
