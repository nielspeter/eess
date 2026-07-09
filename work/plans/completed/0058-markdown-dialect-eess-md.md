# Plan 0058: Markdown Dialect — `@nielspeter/eess-md`

## Status

- **State:** IMPLEMENTED 2026-07-03 on branch `eess-consolidation` (`packages/md`, `@nielspeter/eess-md`, 24 tests). All 5 phases built: corpus() loader (mdast+GFM), docs()/links()/pointers() entry points, haveSection/haveTable/haveTableRowsSatisfying conditions, opt-in adrEnforcement() preset (subpath `/rules/adr`), README + plain-MADR + non-English-localization acceptance tests. Review revisions applied (adrEnforcement opinionated + generic-fitness acceptance test; neutral examples + minimal frozen default; haveSection dual-use). Not merged/published.
- **Priority:** P1 once 0051 lands — **promoted ahead of 0059** (see "Why this jumps the queue")
- **Effort:** ~1 week
- **Created:** 2026-07-03
- **Depends on:** Plan 0051 (kernel extraction — `@nielspeter/eess` must exist as an installable package). Conceptually depends on the EESS manifesto (`docs/manifesto.md`).

## Review outcome (2026-07-03 — architect + product)

**Verdict: proceed — this is the model dialect.** It faithfully follows the
established loader + entry-points + preset-as-function pattern, keeps its parser
(mdast) in the package, and maps "frozen = report never fail" / "ambiguous =
report not fail" onto the kernel's existing `warn()`/`severity()`/`excluding()`
rather than inventing severity machinery. Address before/while implementing:

- **Genericness of `adrEnforcement()` (product, Critical).** The tiered
  `## Enforcement` model (tier + mechanism + status, tiers 1–5, the
  `gated/pending/soft-flag/…` vocabulary) is the EESS/an external repo methodology, not a
  universal ADR shape (MADR/Nygard have none of it). The generic primitives
  (`haveSection`, `haveTable`, `haveTableRowsSatisfying`, `resolve`,
  `haveUniqueIds`) stay in `eess-md`; **frame `adrEnforcement()` as an explicitly
  opinionated preset** ("implements the EESS enforcement-tier model — bring your
  own via `haveTableRowsSatisfying` if your ADRs differ"), and add a **non-an external repo
  acceptance test** (a plain-MADR corpus expressing its rules purely via the
  primitives) alongside the external repo parity test, to prove a stranger gets value
  without touching `adrEnforcement()`.
- **Neutral primary examples (product, Important).** Lead the README/`corpus({…})`
  example with neutral defaults (`docs/**`, `src/**`, English headers,
  `completed`/`archived` frozen only); move the non-English-header / Nuxt-`.nuxt` /
  `work/**` / `[id].vue` / `delivered`/`wont-do` case to a "localization & custom
  conventions" section. Ship a **minimal universal `frozen` default**
  (`completed`, `archived`) or none, not the external repo's full lifecycle taxonomy.
- **`haveSection` dual predicate/condition (architect, Minor).** Clarify whether
  it's one phase-dispatched entry-point method or two identically-named exports,
  to avoid an import collision.

## Problem

EESS treats a repo's markdown corpus — ADRs, plans, bugs, refinement
stories, support cases — as semantic artifacts that must stay honest:
cross-links resolve, code pointers point at real lines, every ADR
clause declares how it is enforced.

That validation layer has now been **hand-built twice**:

1. another internal repo — original zero-dependency scripts.
2. `an external repo/tools/` — the same scripts, copied and adapted:
   `graph-render.ts` (cross-link graph, broken links, orphans, ID
   collisions), `spec-check.ts` (`path:line` code pointers —
   ok/stale/broken/ambiguous), `adr-enforcement.ts` (tiered
   `## Enforcement` table gate with test citations),
   `graph-fix-stale-links.ts` (link repair after doc moves).

~1,000 lines of validator logic, copy-pasted between repos, already
drifting. A third adopting repo copies again. This is **exactly the
typed-mermaide failure mode** that motivated plan 0051 — a dialect
re-implementing the kernel because no shared package exists — except
here it is the whole dialect being vendored per repo.

**The requirement this plan exists to satisfy: no custom validator
code in any repo.** A repo installs `@nielspeter/eess-md`, writes a
declarative `corpus.rules.ts` (configuration + rule invocations, the
same shape as `arch.rules.ts`), and gets the validators. Behavior
fixes and new capabilities arrive via `npm update`, not by re-syncing
scripts by hand.

## Why this jumps the queue (ahead of 0059)

Plan 0051's original work order was 0059 (cross-validation) before
0058 (Markdown dialect). Reversed, because the evidence points the
other way:

- **The MD dialect has proven demand.** Two production repos
  independently hand-built it out of real need, and the scripts are
  actively CI-gated (two workflows in an external repo).
- **Mermaid↔TS cross-validation has no known external consumer**
  waiting on it.
- **0058 seeds 0059 anyway.** The ADR test-citation check (cited
  `it('…')` must exist in the cited test file) is the simplest useful
  MD↔TS cross-check. 0058 ships it text-level; 0059 upgrades it to
  AST-grounded via `@nielspeter/eess-ts` and generalizes the pattern.
- **an external repo is customer zero.** The migration target is concrete:
  replace three CI-gated scripts with rules on the shared kernel.

New order: **0051 → 0058 → 0059 → workflow dialect (future plan, unnumbered until scheduled)**.

> Numbering note: plan 0051 originally forward-referenced these as
> 0052/0053/0054, but 0055–0057 were allocated in the meantime — plan
> numbers are monotonic and never backfilled, so the MD dialect is
> 0058 and cross-validation is 0059.

## Field evidence — decisions to lift as-is

The an external repo/another internal repo scripts battle-tested a set of design decisions.
These transfer into `eess-md` as **behavior**; the hardcoding around
them (non-English column names, specific folder names, `plan-NNN` ID
schemes) becomes **configuration**:

| Decision                             | What it means                                                                                      | Where it lands                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Gate on declaration, not hardness    | An ADR fails for a _missing_ tier/mechanism/status declaration, never for declaring a soft tier    | `rules/adr` preset                      |
| `pending` / ratchet status           | "Decided, mechanism known, not yet green" is a declared state, not a failure                       | `rules/adr` status vocabulary           |
| Frozen terminal folders              | Pointers/links in `completed/`, `fixed/`, `delivered/` describe history — reported, never failed   | corpus config + `areFrozen()` predicate |
| Fenced code is stripped              | Illustrative snippets and templates are not live claims                                            | corpus parser (always)                  |
| Ambiguous reports, never fails       | A bare-basename pointer matching several files is a hint to write the full path, not a build break | pointer conditions                      |
| Localized table headers              | Column matching by pattern (`/mekanisme\|mechanism/i`), not literal English strings                | `rules/adr` options                     |
| Basename lookup with ambiguity guard | Bare filenames resolve repo-wide only when unique                                                  | pointer/link resolution                 |

## Package layout

Assumes the post-0051 monorepo:

```
packages/md/                       # @nielspeter/eess-md
├── src/
│   ├── corpus.ts                  # corpus() loader — roots, ignore, frozen globs
│   ├── model/                     # mdast-backed element types: MdDocument, MdSection,
│   │                              #   MdTable, MdLink, CodePointer
│   ├── builders/                  # docs(), links(), pointers() entry points
│   ├── predicates/                # resideInFolder, haveNameMatching, areInternal,
│   │                              #   areLive, areFrozen, ...
│   ├── conditions/                # haveSection, haveTable, resolve, beInRange, ...
│   ├── rules/
│   │   └── adr.ts                 # adrEnforcement() preset (ADR-006: preset = function)
│   └── index.ts
└── tests/
    └── fixtures/corpus/           # mini markdown corpus + fake code tree
```

**Parser decision:** `mdast-util-from-markdown` + `mdast-util-gfm`
(micromark-based, typed, ESM-native). This is the dialect-specific
parser dependency — the analog of ts-morph for TS and Langium for
Mermaid. The zero-dependency line/regex parsing of the hand-rolled
scripts is rejected for the product: GFM tables, nested sections, and
fence edge cases are precisely where regex parsing drifts.

## API shape

All builders come from the shared kernel (`RuleBuilder<T>` over MD
element types) — same `.that().should().rule().check()` chain, same
`.because()`, `.warn()`, `.excluding()`, baseline, and formatter
machinery as every other dialect. Per the lego-bricks principle,
everything below is a generic primitive; the ADR gate is a preset
_composed from_ these primitives, not special-cased.

The primary examples use neutral, universal conventions — a `docs/**`
corpus, English section headers, and a minimal `frozen` set. Nothing here
assumes any one team's folder layout, language, or ADR methodology.
(Localization and custom conventions — non-English headers, project-specific
lifecycle folders — are shown in "Custom conventions" below.)

```typescript
import { corpus, docs, links, pointers } from '@nielspeter/eess-md'

const c = corpus({
  roots: ['docs/**'],
  // frozen folders hold historical records — drift is reported, never failed.
  // Minimal universal default; extend for your project's lifecycle folders.
  frozen: ['**/completed/**', '**/archived/**'],
  // pointer targets resolve against the repo tree, minus:
  ignore: ['node_modules/**', '.git/**', 'dist/**'],
})

// Markdown-to-markdown links resolve
links(c).that().areInternal().should().resolve().rule({ id: 'corpus/no-broken-links' }).check()

// Live code pointers are grounded (file exists, line in range)
pointers(c)
  .that()
  .areLive()
  .should()
  .resolve() // ambiguous bare basename → report only, never a failure
  .rule({ id: 'corpus/code-pointers' })
  .check()

// Frozen history: reported, never fails — reuses the kernel's warn severity
pointers(c).that().areFrozen().should().resolve().rule({ id: 'corpus/historical-drift' }).warn()
```

**`frozen` default:** ship the near-universal `completed`/`archived` only
(or nothing, requiring opt-in) — not a full lifecycle taxonomy. Teams whose
records live in `delivered/`, `wont-do/`, `fixed/`, etc. add those in config.

### Entry points

| Entry point   | Element type                         | Backing                    |
| ------------- | ------------------------------------ | -------------------------- |
| `docs(c)`     | markdown document                    | mdast root + file metadata |
| `links(c)`    | markdown link (fenced code excluded) | mdast `link` nodes         |
| `pointers(c)` | `path.ext:line[-end]` code citation  | text scan outside fences   |

### Predicates (`.that()`)

- Shared with other dialects: `resideInFolder(glob)`, `resideInFile(glob)`, `haveNameMatching(re)`
- Corpus-specific: `areInternal()` / `areExternal()` (links), `areLive()` / `areFrozen()` (frozen-glob membership), `haveSection(name)` (as predicate — "docs that have X")

**`haveSection` is one phase-dispatched method, not two exports.** Like the
existing dual-use methods in `eess-ts` (`resideInFolder`, `notImportFrom`,
`haveNameMatching` — see plan 0041's `_phase` tracking), a single
`haveSection(name)` on the `docs` builder acts as a **predicate** after
`.that()` ("docs that have section X") and as a **condition** after
`.should()` ("docs must have section X"). It is not two identically-named
exports — no import collision.

### Conditions (`.should()`)

- `haveSection(name)` — heading exists (level-aware); dual-use with the
  predicate form above
- `haveTable({ section?, columns })` — a GFM table with columns matched by pattern
- `haveTableRowsSatisfying({ section?, columns, row })` — generic row validator; `row(cells)` returns violations (this is the primitive `adrEnforcement` composes)
- `resolve()` — links: target file exists (URL-decoded, repo-root-aware); pointers: file exists and line/range within file length; bare basenames resolve when unique, ambiguous reports without failing
- `haveUniqueIds({ pattern })` — ID collision detection across the corpus

### `rules/adr` preset — an _opinionated_ preset, not a core feature

`adrEnforcement()` is **not** a headline primitive of `eess-md`; it is an
opinionated preset that implements **one specific methodology** — the EESS
enforcement-tier model (a `## Enforcement` table with tier + mechanism +
status, tiers 1–5, the `gated`/`pending`/`soft-flag`/`deferred`/`governance`
vocabulary, test citations). Most teams that use ADRs (MADR, Nygard) have
none of that. The preset is opt-in and clearly labeled as such:

> `adrEnforcement()` implements the EESS enforcement-tier model. If your
> ADRs have a different shape, compose your own gate from the generic
> primitives (`haveSection`, `haveTable`, `haveTableRowsSatisfying`,
> `resolve`) — no fork, no per-repo validator code.

It composes the generic primitives into the gate-on-declaration contract
(every matched ADR has the section, the table, valid tiers per row,
resolvable citations), emits rule ids under the `adr/` namespace so
`overrides` work per-rule (mirroring `recommended()`, plan 0049), and ships
from a sub-path (`@nielspeter/eess-md/rules/adr`) so the base dialect never
pulls it in.

**The generic-fitness bar (must hold):** a stranger with plain MADR ADRs
gets full value from `eess-md` — links resolve, pointers ground, tables and
sections validate — **without ever importing `adrEnforcement`**. That is an
explicit acceptance test (see Phase 5), not an aspiration.

### Custom conventions (localization, project-specific lifecycle)

Everything project-specific is configuration, not a fork. Column headers
match by pattern (so non-English works), frozen folders and pointer
extensions are globs, and the ADR preset's tiers/status vocabulary are
options:

```typescript
import { corpus } from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

const c = corpus({
  roots: ['work/**', 'docs/**'], // this project keeps plans under work/
  frozen: ['**/completed/**', '**/delivered/**', '**/wont-do/**', '**/archived/**'],
  ignore: ['node_modules/**', '.git/**', '.nuxt/**'], // a Nuxt app
})

adrEnforcement(c, {
  dir: 'docs/adr/**',
  columns: { tier: /tier/i, mechanism: /mechanism|mekanisme/i, status: /status/i }, // non-English header
  tiers: [1, 2, 3, 4, 5],
  verifyCitations: true, // cited paths exist; cited it('…') titles exist in cited test files
})
```

## Implementation phases

### Phase 1 — Corpus loader + document model (~1.5 days)

1. `corpus()` — walk roots, parse with mdast + GFM, strip nothing (the
   _model_ keeps fences; _link/pointer extraction_ skips them), record
   frozen membership per file.
2. `MdDocument`, `MdSection`, `MdTable` element types; `docs(c)` entry
   point on the kernel `RuleBuilder`.
3. Predicates: `resideInFolder`, `haveNameMatching`, `haveSection`.
4. Conditions: `haveSection`, `haveTable`.

**Files:** `packages/md/src/corpus.ts`, `src/model/*`,
`src/builders/docs.ts`, `src/predicates/*`, `src/conditions/structure.ts`,
`tests/fixtures/corpus/*`, `tests/docs.test.ts`

### Phase 2 — Links (~1 day)

5. Link extraction (skip fenced blocks, ignore `http(s)://`/`mailto:`,
   URL-decode `%20`, outside-repo → external).
6. `links(c)` entry point; `areInternal()`/`areExternal()`;
   `resolve()` condition; `haveUniqueIds()`.

**Files:** `src/builders/links.ts`, `src/conditions/resolve.ts`,
`tests/links.test.ts`

### Phase 3 — Code pointers (~1 day)

7. Pointer extraction (`path.ext:line[-end]`, configurable extension
   set, `[id].vue`-style brackets supported).
8. Resolution against the repo tree (full path; bare basename via
   unique-match index). Classification ok/stale/broken/ambiguous —
   ambiguous surfaces as a report-level note, never a violation.
9. `areLive()`/`areFrozen()` predicates wired to corpus frozen globs.

**Files:** `src/builders/pointers.ts`, `src/model/pointer.ts`,
`tests/pointers.test.ts`

### Phase 4 — Table row validation + `rules/adr` preset (~1.5 days)

10. `haveTableRowsSatisfying()` generic condition.
11. `adrEnforcement()` preset: section present → table present →
    columns located by pattern → each row has a valid tier → cited
    paths exist → cited `it('…')` titles found (text-level regex scan
    of the cited file, matching the hand-rolled implementation; noted
    as upgraded to AST-grounded in 0059).
12. Per-rule ids + `overrides` support.

**Files:** `src/conditions/table-rows.ts`, `src/rules/adr.ts`,
`tests/rules/adr.test.ts`

### Phase 5 — Docs + customer-zero migration (~1 day)

13. Package README + docs pages (corpus config, entry points, ADR
    preset, migration guide from hand-rolled scripts). Lead with the
    neutral example; put localization/custom-conventions in its own
    section.
14. **Acceptance test A — customer zero (an external repo):** author the
    `corpus.rules.ts` that replaces `graph-render.ts --check`,
    `spec-check.ts --check`, and `adr-enforcement.ts --check`; run
    against the real corpus; confirm identical pass/fail verdicts (same
    violations caught, no new false positives). Proves "no custom code
    per repo" for the EESS methodology.
15. **Acceptance test B — the stranger (generic fitness):** a fixture
    corpus of **plain MADR ADRs** (no enforcement tiers, English, a
    `docs/adr/**` + `docs/**` layout) that gets real value —
    link/pointer grounding, `haveSection`/`haveTable` checks — using
    **only the generic primitives, never `adrEnforcement`**. Proves the
    dialect serves a team with no EESS conventions. Without this, "no
    custom code per repo" is only proven for an external repo.
16. CHANGELOG + release coordination with the eess family versioning.

## Test inventory

- Fixture corpus with: valid ADRs, ADR missing `## Enforcement`, ADR
  with invalid tier, ADR citing a missing file, ADR citing an `it()`
  that doesn't exist, localized column headers.
- Links: valid, broken, external, `%20`-encoded, inside fenced code
  (must not register), outside-repo (must not flag).
- Pointers: ok, stale (line > file length), broken, ambiguous bare
  basename, frozen-folder drift (warn not error), range form
  <!-- eess-exclude corpus/pointers-resolve: illustrative pointer-syntax examples, not live claims -->
  (`file.ts:10-20`), bracketed route (`[id].vue:160`).
- Kernel integration: `.excluding()`, baseline mode, JSON/GitHub
  formatters all work unchanged over MD elements.
- `frozen` default is minimal (`completed`/`archived`) — a `delivered/`
  record is _not_ frozen unless configured.
- Acceptance A (phase 5): recorded an external repo verdicts vs `eess-md` verdicts.
- Acceptance B (phase 5): plain-MADR corpus validated using only generic
  primitives (no `adrEnforcement` import).

## Out of scope

- **Fixers/codemods.** `graph-fix-stale-links.ts` mutates files; this
  dialect validates only. A repair CLI is a possible later plan.
- **AST-grounded cross-validation.** Citation checks here are
  text-level. Semantic MD↔TS (and MD↔Mermaid) binding is plan 0059,
  which builds on this dialect's pointer/citation elements.
- **Embedded Mermaid block composition.** The corpus model exposes
  fenced blocks with language tags as data; handing `mermaid` blocks
  to `@nielspeter/eess-mermaid` for validation is 0059 composition
  work.
- **Graph rendering.** `graph-render.ts` also _generates_
  `docs/graph.md`; that's reporting, not validation. Could become a
  formatter/CLI feature later.
- **Schema-per-document-type** (workflow schemas etc. from the
  manifesto's Schema Layer) — the `haveTableRowsSatisfying` /
  `haveSection` primitives are the building blocks; full document
  schemas are a follow-on once real usage shapes them.

## Strategic note

This plan is the first post-consolidation dialect and the proof of
0051's core claim: a new dialect lands as a sibling package on the
shared kernel with **zero kernel duplication and zero per-repo
custom code**. an external repo (and another internal repo) migrate from vendored scripts to
`npm install @nielspeter/eess-md` + a declarative rules file — the
drift problem ends because behavior lives in one published package.

It also de-risks 0059: by the time cross-validation is designed, the
MD dialect's element model (documents, tables, pointers, citations)
exists and has a production consumer, so 0059 can ship the MD↔TS
citation upgrade as its first cross-check with a real user waiting.
