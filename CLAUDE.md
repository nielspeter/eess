# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**eess** (Executable Enforceable Specification System) is a deterministic "compiler for specs" that grounds AI coding agents: markdown specs, diagrams, ADRs, and architecture rules are validated against the code — and each other — so drift fails the build. It is a **family**: a dialect-independent kernel (`@nielspeter/eess`) with sibling dialects — `eess-ts` (the flagship TypeScript dialect, evolved from ts-archunit's engine), `eess-mermaid`, `eess-md`, and `eess-crossvalidate`. The repo dogfoods itself — the validate chain enforces these specs against this code.

**Spec:** `docs/manifesto.md` is the design specification, together with the binding decisions in `/adr/`. All implementation must align with them.

## Architecture Decision Records (ADRs)

**CRITICAL:** All architectural decisions are documented in `/adr/`. These decisions are **binding** and must be followed in all plans and code. Read relevant ADRs before implementing features.

| ADR                                                       | Title           | Key Takeaway                                                                                       |
| --------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| [001](./adr/001-toolchain-node-vitest-eslint-prettier.md) | Toolchain       | Node 24 + TS ~5.9 (pinned to ts-morph) + Vitest 4 + ESLint 10 + Prettier 3.8. No Bun.              |
| [002](./adr/002-ts-morph-ast-engine.md)                   | AST Engine      | ts-morph 27 for all AST and type checking. No tree-sitter/SWC/raw TS API.                          |
| [003](./adr/003-fluent-builder-dsl.md)                    | DSL Pattern     | Fluent builder with method chaining. `entry(p).that().<predicate>.should().<condition>.check()`    |
| [004](./adr/004-esm-only-package.md)                      | Module Format   | ESM only. `"type": "module"`, Node.js >=24. No dual CJS/ESM.                                       |
| [005](./adr/005-no-any-no-type-assertions.md)             | Type Safety     | No `any`, no `as` casts. Use ts-morph type guards. Only `eslint-disable` at JS interop boundaries. |
| [006](./adr/006-framework-rules-architecture.md)          | Framework Rules | Rules are code, not config. Separate npm packages per framework. Presets are functions.            |
| [007](./adr/007-isolate-ast-engine-boundary.md)           | Engine Boundary | Confine ts-morph behind one engine module; batch-first boundary. (Proposed; confinement `pending`) |

### ADR authoring convention — the Enforcement table (eess enforcement-table v1)

Every ADR ends with a `## Enforcement` section: a table with **Clause | Tier |
Mechanism | Status** rows, one per enforceable clause. This is gated in CI —
`check:corpus` runs eess-md's `adrEnforcement` (section + tier validity +
citations resolve), and `check:crossval` resolves cited `it('…')` titles against
the real test AST. Rules:

- **Tier** (1–5, per the EESS manifesto): 1 static · 2 behavioral · 3 operational · 4 semantic · 5 ratification.
- **Mechanism**: name what actually checks the clause. Cite file paths in backticks (they must exist) and test citations as `` `path/to/file.test.ts` `` · `it('exact title')` on the same row (the title must exist in that file, and be unique across the suite — duplicate titles are ambiguous to the resolver).
- **Status** (fixed vocabulary): `gated` (mechanism runs in CI, failing blocks) · `warn` (runs, reports, doesn't block) · `pending` (decided, mechanism known, not yet green/wired) · `manual` (human review; no mechanism possible) · `n/a` (context/rationale; nothing to enforce) · `deprecated` (no longer in force, kept for history).

## IMPORTANT: ADR Compliance

**Before writing ANY code or plan, check the ADRs.** Every ADR is binding. Specifically:

- **ADR-005 (Type Safety):** Never use `any`. Never use `as` type assertions. Use ts-morph `Node.isClassDeclaration()` etc. for type narrowing. Use explicit type annotations instead of `as` on literals. Only `eslint-disable` at unavoidable JS interop boundaries (with explanation).
- Reference ADRs by number when making design decisions in plans or code comments.

## Plans

Implementation plans are in `/work/plans/`. Completed plans move to `/work/plans/completed/`. The roadmap is `/work/plans/ROADMAP.md`. (ADRs stay at `/adr/`.)

Plans follow a specific format: Status/Priority/Effort header, Problem section, phased implementation with real code examples, Files Changed per phase, Test inventory, Out of Scope section. See existing plans for examples.

## Key Implementation Rules

From the ADRs:

- **TypeScript strict mode** with `noUncheckedIndexedAccess: true` (ADR-001)
- **ESM only** — `"type": "module"`, `module: "Node16"`, `moduleResolution: "Node16"` (ADR-004)
- **ts-morph for all AST operations** — never use raw `typescript` compiler API directly (ADR-002)
- **Fluent builder pattern** — rules read like English: `.that().extend('X').should().notContain(call('Y')).check()` (ADR-003)
- **Vitest for tests** — fixture-based, no mocking of ts-morph
- **No `any`, no `as` type assertions** — use ts-morph type guards (`Node.isClassDeclaration()` etc.) for narrowing, explicit type annotations instead of `as` on literals. Only `eslint-disable` at unavoidable JS interop boundaries with explanation. (ADR-005)

## Dependencies

| Package                | Purpose                                                | Required in    |
| ---------------------- | ------------------------------------------------------ | -------------- |
| `ts-morph` ^27         | TypeScript AST analysis, type checker                  | Core           |
| `picomatch` ^4         | Glob pattern matching                                  | Core           |
| `vitest` ^4            | Test runner                                            | Dev / peer dep |
| `typescript` ~5.9      | Type checking, compilation (pinned to ts-morph compat) | Dev            |
| `eslint` ^10           | Linting (flat config, `eslint.config.ts`)              | Dev            |
| `typescript-eslint` ^8 | Type-checked ESLint rules (unified package)            | Dev            |
| `prettier` ^3.8        | Formatting                                             | Dev            |

No runtime dependencies beyond ts-morph and picomatch. The tool is a dev dependency.

## Project Structure (target)

```
eess/
├── adr/                    # Architecture Decision Records (binding)
├── docs/                   # manifesto, walkthrough, VitePress guide
├── work/                   # engineering corpus (mutable work artifacts)
│   └── plans/              # implementation plans (→ completed/, wont-do/)
├── packages/
│   ├── core/               # @nielspeter/eess — the dialect-independent kernel (rule engine)
│   ├── ts/                 # @nielspeter/eess-ts — TypeScript dialect (ts-morph); the flagship
│   ├── mermaid/            # @nielspeter/eess-mermaid — Mermaid class diagrams
│   ├── md/                 # @nielspeter/eess-md — Markdown corpus (links, pointers, ADR tables)
│   └── crossvalidate/      # @nielspeter/eess-crossvalidate — bind two dialects, fail on drift
├── scripts/                # check-*.mjs dogfood gates + nonvacuity fixtures
├── skills/                 # AI integration layer: eess-adr-author + eess-adr-validate agent skills
├── kit/                    # the portable working-method kit (plan 0068): skills + templates + bootstrap
├── arch.rules.ts           # dogfood: architecture rules over this repo
├── spec.rules.ts           # dogfood: bind README/ADR-index specs to code
├── mermaid.rules.ts        # dogfood: diagram ↔ code correspondence
├── docs/architecture.mmd   # the kernel diagram (cross-validated)
├── tsconfig.json
└── package.json
```

## Common Commands

```bash
npm run test          # run vitest
npm run lint          # eslint
npm run format        # prettier --write
npm run typecheck     # tsc --noEmit
npm run build         # tsc (emit to dist/)
npm run validate      # full gate chain (build + all check:* + typecheck + lint + format + test)
```

## For coding agents

This repo validates its own specs against its own code — treat those gates as
compiler feedback, not optional lint. When you change code, docs, ADRs, plans,
or diagrams, run the relevant gate and fix what it reports:

- `npm run check:spec` — the README Packages table and the ADR index table
  above must stay in sync with the workspace and `adr/`. If you add/remove a
  package or an ADR, this fails until you update the matching table row.
- `npm run check:corpus` — cross-links and `path:line` code pointers in
  `work/`, `adr/`, and `docs/` must resolve. A pointer you cite must hit the
  real line.
- `npm run check:ledger` — honesty at close: a _done_ plan (a terminal `State:`
  token, or a plan in `work/plans/completed/`) carries no silently-open `- [ ]`.
  Close a plan by disposing every box (done-otherwise / deferred→<home> /
  dropped-on-purpose / validation-owed) and moving it to `completed/`. Dogfoods the
  `eess-md` `honestyAtClose` preset that the portable kit under `kit/` ships.
- `npm run check:arch` / `check:diagram` / `check:crossval` — architecture,
  the kernel diagram, and their agreement.

Each gate prints a violation with a file, a line, a message, and (often) a fix.
The output is written to be **agent-actionable** — every violation surfaces its
rationale (`.because`), a `Fix:` line (the rule's `suggestion`), and a `Docs:`
link where present, so a failing gate reads as an instruction, not just an error.
Add `--format json` for a machine-readable stream, e.g.
`eess-ts check spec.rules.ts --format json` — each violation carries
`file`/`line`/`message`/`ruleId`/`because`/`suggestion`/`docs`. A gate
failing is not a blocker to route around; it is the repo telling you a spec and
the code have drifted. Fix the drift (either side), then re-run.

For a fast pre-commit / on-save loop, `npm run check:fast` runs just the spec and
architecture gates (corpus + spec + arch), skipping build, tests, lint, and the
slower gates — the "shift feedback left" tier. Run the full `npm run validate`
before proposing a commit.

On success, every gate reports what it actually scanned — a summary line with
the denominator and elapsed time — so a fast green is provably non-vacuous, not
a silent no-op:

- `check:corpus` → `✓ corpus integrity — 104 checks across 46 documents, 0
violations (254ms)`, with per-check counts above it (documents live/frozen,
  links, live `path:line` pointers, ADRs).
- `check:arch` / `check:spec` → `✓ eess-ts — N rules across M files · 0 failing
(Xs)`; `check:diagram` → the same for `eess-mermaid`.

If a count reads zero or far lower than expected, the gate matched nothing —
treat that as a red flag (a vacuous rule or wrong glob), not a pass. These
summaries print to **stderr in terminal format only**, so `--format json` /
`github` output on stdout stays machine-clean.

## Commit Messages

- Use conventional commits (feat:, fix:, refactor:, test:, docs:, chore:)
- First line under 72 characters
- No AI attribution in commits or PRs
