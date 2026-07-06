# eess

**Executable Enforceable Specification System.** _Specifications you can run._

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 24](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org/)

A repo's architecture, diagrams, and specifications should be **executable and enforced**, not prose that drifts. eess validates each artifact against the code — and against its sibling artifacts — so drift in either direction fails the build. See the [manifesto](./docs/manifesto.md) and the [worked example](./docs/eess-walkthrough-calculator.md).

Artifacts are **siblings, not hierarchical**: TypeScript, Mermaid diagrams, and Markdown specs all sit on equal footing, validated by one shared kernel. This monorepo is built the same way — a dialect-independent kernel with dialects as sibling packages around it.

## Packages

| Package                                                      | What it validates                                   | Status |
| ------------------------------------------------------------ | --------------------------------------------------- | ------ |
| [`@nielspeter/eess`](./packages/core)                        | The kernel — rule engine, no dialect knowledge      | 0.1.x  |
| [`@nielspeter/eess-ts`](./packages/ts)                       | TypeScript source (imports, bodies, layers, types)  | 0.12.x |
| [`@nielspeter/eess-mermaid`](./packages/mermaid)             | Mermaid class diagrams                              | 0.1.x  |
| [`@nielspeter/eess-md`](./packages/md)                       | Markdown corpus — links, code pointers, ADR tables  | 0.1.x  |
| [`@nielspeter/eess-crossvalidate`](./packages/crossvalidate) | Cross-validation — bind two dialects, fail on drift | 0.1.x  |

Each dialect depends only on the kernel and its own parser (ts-morph for TS, Langium for Mermaid, mdast for Markdown). The Markdown dialect ([plan 0058](./work/plans/0058-markdown-dialect-eess-md.md)) and cross-validation between dialects ([plan 0059](./work/plans/0059-cross-validation-eess-crossvalidate.md)) are sibling packages on the same kernel — new dialects land without restructuring.

## Quick start

The TypeScript dialect is the flagship. Install it and encode an architecture rule:

```bash
npm install -D @nielspeter/eess-ts
```

```typescript
import { project, modules } from '@nielspeter/eess-ts'
import { call } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

modules(p).that().resideInFolder('src/core/**').should().notDependOn('src/operations/**').check()
```

See the [`eess-ts` guide](./packages/ts/README.md) for the full DSL, presets, CLI, and body-analysis matchers.

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

## eess validates eess

This repository is customer zero: every dialect enforces on the repo that builds it, in CI, with no baselines and no silenced rules —

- `check:arch` — eess-ts validates the monorepo's own architecture: kernel purity, dialect isolation, and an internal policy (layering, cycles, security, hygiene, metrics, the ADR-005 `as`/`!` bans) over every package ([arch.rules.ts](./arch.rules.ts), [arch.internal.rules.ts](./arch.internal.rules.ts))
- `check:diagram` — eess-mermaid validates [docs/architecture.mmd](./docs/architecture.mmd), the kernel's class diagram
- `check:crossval` — eess-crossvalidate keeps that diagram and the kernel's code in agreement (both directions) and resolves every test an ADR cites against the real AST
- `check:corpus` — eess-md validates 100 markdown docs: cross-links, live `path:line` code pointers, and the tiered `## Enforcement` table in every [ADR](./adr)
- `check:spec` — eess-md + `correspondence()` bind markdown _specs_ to code: this Packages table stays in sync with the workspace, and the [CLAUDE.md](./CLAUDE.md) ADR index stays in sync with [`adr/`](./adr) — drift either way fails the build ([spec.rules.ts](./spec.rules.ts))
- `check:nonvacuity` — every gate above is proven to fail on committed violating fixtures: no green-but-empty gates

The full audit surface — every adopted rule, every exclusion with its written reason — is [work/dogfood-coverage.md](./work/dogfood-coverage.md).

## License

MIT
