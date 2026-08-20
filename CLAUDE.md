# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**eess** is a deterministic "compiler for specs" that grounds AI coding agents: markdown specs, diagrams, ADRs, and architecture rules are validated against the code — and each other — so drift fails the build. It is a **family**: a dialect-independent kernel (`@nielspeter/eess`) with sibling dialects — `eess-ts` (the flagship TypeScript dialect, evolved from ts-archunit's engine), `eess-mermaid`, `eess-md`, and `eess-crossvalidate`. The repo dogfoods itself — the validate chain enforces these specs against this code.

**Spec:** `docs/manifesto.md` is the design specification, together with the binding decisions in `/adr/`. All implementation must align with them.

## Architecture Decision Records (ADRs)

**CRITICAL:** All architectural decisions are documented in `/adr/`. These decisions are **binding** and must be followed in all plans and code. Read relevant ADRs before implementing features.

| ADR                                                       | Title           | Key Takeaway                                                                                                             |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [001](./adr/001-toolchain-node-vitest-eslint-prettier.md) | Toolchain       | Node 24 + TS ~5.9 (pinned to ts-morph) + Vitest 4 + ESLint 10 + Prettier 3.8. No Bun.                                    |
| [002](./adr/002-ts-morph-ast-engine.md)                   | AST Engine      | ts-morph 27 for all AST and type checking. No tree-sitter/SWC/raw TS API.                                                |
| [003](./adr/003-fluent-builder-dsl.md)                    | DSL Pattern     | Fluent builder with method chaining. `entry(p).that().<predicate>.should().<condition>.check()`                          |
| [004](./adr/004-esm-only-package.md)                      | Module Format   | ESM only. `"type": "module"`, Node.js >=24. No dual CJS/ESM.                                                             |
| [005](./adr/005-no-any-no-type-assertions.md)             | Type Safety     | No `any`, no `as` casts. Use ts-morph type guards. Only `eslint-disable` at JS interop boundaries.                       |
| [006](./adr/006-framework-rules-architecture.md)          | Framework Rules | Rules are code, not config. Separate npm packages per framework. Presets are functions.                                  |
| [007](./adr/007-isolate-ast-engine-boundary.md)           | Engine Boundary | Confine ts-morph behind one engine module; batch-first boundary. (Proposed; confinement `pending`)                       |
| [008](./adr/008-caller-owns-reporting.md)                 | Reporting       | Detection is separate from emission. One `reportViolations`; presets take `{ report }` (default unchanged).              |
| [009](./adr/009-agent-first-failure-surfaces.md)          | Fail-Closed     | A check that cannot fail is worth less than no check. Ported from `ts-archunit` ADR-008; six binding rules.              |
| [010](./adr/010-a-pass-is-constructed-from-evidence.md)   | Vacuity Proof   | A pass is constructed from evidence — `{ violations, examined }` — never a default. Prospective on the fold (plan 0088). |

### ADR authoring convention — the Enforcement table (eess enforcement-table v1)

Every ADR ends with a `## Enforcement` section: a table with **Clause | Tier |
Mechanism | Status** rows, one per enforceable clause. This is gated in CI —
`check:corpus` runs eess-md's `adrEnforcement` (section + tier validity +
citations resolve), and `check:crossval` resolves cited `it('…')` titles against
the real test AST. Rules:

- **Tier** (1–5, per the EESS manifesto): 1 static · 2 behavioral · 3 operational · 4 semantic · 5 ratification.
- **Mechanism**: name what actually checks the clause. Cite file paths in backticks (they must exist) and test citations as `` `path/to/file.test.ts` `` · `it('exact title')` on the same row (the title must exist in that file, and be unique across the suite — duplicate titles are ambiguous to the resolver).
  - **"Exact" means the raw source text of the title, character for character** — the resolver compares what the test file _says_, not what the string evaluates to. A title containing an escaped delimiter is cited with the escape: `it('it\'s fine')`, not `it('it's fine')`. A title containing a backtick is cited whole, which means the code span needs a double-backtick fence: ``` ``it('catches `HACK` in a comment')`` ```. Prefer titles that need no escaping — a raw-text key is your formatter's to change, so `prettier` restyling a quoted title can turn a correct citation red.
- **Status** (fixed vocabulary): `gated` (mechanism runs in CI, failing blocks) · `warn` (runs, reports, doesn't block) · `pending` (decided, mechanism known, not yet green/wired) · `manual` (human review; no mechanism possible) · `n/a` (context/rationale; nothing to enforce) · `deprecated` (no longer in force, kept for history).

**Authoring a row.** To make a clause enforceable, use the `eess-adr-author` skill
(translate the clause → the right mechanism + an honest row), then `eess-adr-validate`
(adversarial faithfulness check) — or run both as one enforced step via
`.claude/workflows/adr-enforce.mjs`, which keeps the author and validator as separate
agents on different models so neither blesses its own work (plan 0077).

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
├── .claude/workflows/      # adr-enforce.mjs — enforced author→validate→fix loop, separate agents (plan 0077)
├── kit/                    # the portable working-method kit (plan 0068): skills + templates + bootstrap
├── arch.rules.ts           # dogfood: architecture rules over this repo
├── family.rules.ts         # dogfood: sibling dialects re-export what they need (plan 0089)
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
  real line. It also binds `work/proposals/` to `work/plans/`: an accepted
  proposal (`**Ruling: Ship as-is**`/`Ship with changes`) needs a plan that
  declares `**Implements:** proposal NNN` against it (a prose mention doesn't
  count), and a malformed `**Ruling:**`/`**Implements:**` line or one naming a
  proposal that doesn't exist is reported rather than silently ignored.
- `npm run check:ledger` — honesty at close: a _done_ plan (a terminal `State:`
  token, or a plan in `work/plans/completed/`) carries no silently-open `- [ ]`.
  Close a plan by disposing every box (done-otherwise / deferred→<home> /
  dropped-on-purpose / validation-owed) and moving it to `completed/`. Dogfoods the
  `eess-md` `honestyAtClose` preset that the portable kit under `kit/` ships.
- `npm run check:arch` / `check:diagram` / `check:crossval` — architecture,
  the kernel diagram, and their agreement.
- `npm run check:family` — each sibling dialect (`eess-md`, `-mermaid`,
  `-gherkin`, `-crossvalidate`) re-exports every kernel symbol its own
  source imports, so installing one dialect never requires a second, direct
  `@nielspeter/eess` install (plan 0089).
- `npm run check:release` — every package you changed declares a release. Touch
  anything under `packages/<name>/` and that package needs a changeset naming it
  (`npx changeset`), or an explicit `'@nielspeter/eess-<x>': none` if the change
  ships nothing a consumer can observe. Tests and package-local docs count as
  changes — the definition is changesets' own, and declining the bump is your
  call to declare, not the tool's to guess. This is the only gate that reads a
  **base ref**: `EESS_RELEASE_BASE`, else the PR's target, else `origin/main`,
  else `main`, and it hard-errors rather than pretending nothing changed, so a
  shallow clone fails loudly (CI needs `fetch-depth: 0`).
  It also reads the changeset **body**: one that marks a breaking change — a line
  starting `**Breaking …**`, a `## Breaking` heading, or `BREAKING CHANGE` — must
  bump at least one package past `patch`, because npm refuses to re-publish a
  version and `publish.yml` ships with provenance. On `0.x` a break is a `minor`;
  `major` claims 1.0 stability. An UNMARKED break is not caught — the gate reads
  the marker, not your prose (bug 0184). A break in a package others depend on
  must also NAME them in the same changeset — otherwise the dependent ships the
  break to its own adopters under a changelog reading "Updated dependencies"
  (bug 0185).

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

On success, SOME gates report what they actually scanned — a summary line with
the denominator and elapsed time — so a fast green is provably non-vacuous rather
than a silent no-op. **Which gates do is uneven, and knowing which is the point:**

| gate                                                            | success summary                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `check:corpus`                                                  | `✓ corpus integrity — 906 checks across 118 documents, 0 violations (4.00s)`, with per-check counts above it |
| `check:ledger`                                                  | `✓ honesty at close — 49 done-items across 118 records …`                                                    |
| `check:baseline`                                                | `✓ baseline (recommended) — 4 floor rules across N source files · 0 violations`                              |
| `check:diagram`                                                 | `✓ eess-mermaid — 1 rule across 1 file · 0 failing (246ms)`                                                  |
| `check:arch` · `check:spec` · `check:family` · `check:crossval` | **nothing** — a bare exit 0                                                                                  |

The emitter lives only in `eess-mermaid`'s CLI and was never ported to
`eess-ts`'s, so the two gates carrying this repo's architecture and spec
enforcement announce a clean run with no denominator at all
([bug 0174](./work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md)).

Where a count IS printed, a zero or an unexpectedly low one means the gate matched
little or nothing — treat that as a red flag (a vacuous rule or wrong glob), not a
pass. **Read that instruction narrowly:** the rule/file counts in the
`eess-mermaid` line count declared rules, which do not drop when a selector goes
dead, so they detect a mis-wired rule FILE and not a mis-wired rule. The number
that answers vacuity for a rule is `examined` (ADR-010), which the floor reads and
no CLI currently prints. Until 0174 is fixed, a green `check:arch` is evidence
that nothing failed, not evidence that anything was examined — for that, run the
suite or `check:nonvacuity`, which fires all 41 fixtures.

These summaries print to **stderr in terminal format only**, so `--format json` /
`github` output on stdout stays machine-clean.

## Commit Messages

- Use conventional commits (feat:, fix:, refactor:, test:, docs:, chore:)
- First line under 72 characters
- No AI attribution in commits or PRs
