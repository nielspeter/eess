# Plan 0069: Spec-Corpus Reach — Gherkin, erDiagram, Vocabulary

## Status

- **State:** Draft — evidence gathered from a real consumer corpus; API sketches
  are directional, not frozen. Genericity-reviewed 2026-07-13: Gherkin is a
  sibling dialect + crossvalidate pairing (not an eess-md bolt-on, no kernel
  change), and every house shape is a consumer parameter.
- **Priority:** P2 — first demand-driven dialect growth from a corpus eess did not
  shape; unblocks validating reverse-engineered spec packages
- **Effort:** phased below; Phases 1–2 ≈ 2 sessions, 3 ≈ 1–2 sessions, 4 ≈ 1
  session, 5 ≈ 0.5 session
- **Created:** 2026-07-13

## Problem

eess-md was pointed at a **real consumer spec corpus** — 261 markdown documents
reverse-engineered from a legacy JVM system by an extraction-agent pipeline
(DDD bounded contexts, entity specs, user stories with Gherkin scenarios, ADRs,
process flows, a traceability matrix). The spike (2026-07-13, evidence
internalized below) proved two things at once:

**What already works — and caught real defects on first contact:**

- `corpus()` + `links()`: 892 internal cross-links checked → **1 broken link
  found** (a story pointing at a `.feature` file that doesn't exist).
- `docs()` shape conformance: 44 entity specs → all carry the required
  `Properties` table; 24 ADRs → **1 missing `## Consequences` found**.
- `rows()` / `adrEnforcement()` are applicable as-is (index↔file binding; the
  enforcement-table convention, if the consumer adopts it).

**Where eess goes blind — the gaps, quantified:**

| #   | Gap                                     | Blocked surface (measured)                                                                                                                    |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `corpus()` loads only `.md`             | 22 `.feature` files can't even be loaded as documents                                                                                         |
| 2   | No Gherkin reader / scenario resolver   | **464 scenarios**; 26 prose refs (`See x.feature - "Scenario title"`, 17 naming a specific scenario) — the whole story↔behavior layer ungated |
| 3   | eess-mermaid parses only `classDiagram` | **46 docs** carry `erDiagram`; no table↔diagram consistency check possible                                                                    |
| 4   | No named-reference primitive            | 20 bounded-context names, 47 aggregate-root declarations, 168 glossary terms — name-in-prose references resolve nothing                       |
| 5   | `pointers()` is same-repo only          | 11 legacy source files cited by the traceability matrix live outside the repo — unverifiable                                                  |

The through-line: for spec-corpus validation eess is **not** missing language
dialects for _code_ — it is missing one small **format dialect** (#1/#2), one
grammar extension (#3), one resolver primitive (#4), and one option (#5). Each
phase below is independently shippable and independently valuable.

**Genericity rule for every phase** (this is a generic tool, reviewed
2026-07-13): the _format_ eess understands must be a standard (Gherkin, Mermaid
erDiagram, GFM tables); the _house shape_ (section names, column names,
citation prose) is always a **consumer-supplied parameter** in their rules
file — never baked into a package. Where a convention is needed (citations),
**eess defines it and consumers adopt it** — the same move as `check:crossval`'s
`` `file.test.ts` `` · `it('title')` citation convention.

## Implementation phases

### Phase 1 — `@nielspeter/eess-gherkin`: a sibling format dialect

Follows the family architecture (every format is a sibling dialect with its own
loader — eess-ts loads `.ts`, eess-mermaid loads `.mmd`; cross-format checks
live in `eess-crossvalidate`): a **tiny dialect package** that loads `.feature`
files and exposes features/scenarios as first-class elements. The line grammar
is trivial (`Feature:`, `Scenario:`, `Scenario Outline:`, tags).

```ts
import { features } from '@nielspeter/eess-gherkin'

const f = features({ roots: ['specs/behaviors/features/**'] })
f.scenarios() // [{ feature, title, file, line, tags }]
```

No kernel/`corpus()` change is needed: the md corpus's `fileIndex` already
indexes every file (the spike's broken-link catch _was_ a `.feature` target), so
markdown links to feature files already resolve today.

**Files changed:** `packages/gherkin/**` (new package: loader + model +
builder), workspace + README Packages row (`check:spec` will demand it), tests.

### Phase 2 — md↔gherkin citation crossvalidation (the behavior gate)

A `md-gherkin` pairing in `eess-crossvalidate`: **scenario citations in
markdown must resolve to a real scenario in a real feature file** — the exact
analogue of the existing `it('…')` test-title resolver. eess **defines the
citation convention** (a backticked feature path + a quoted scenario title on
the same line; matcher configurable for transition periods); a consumer corpus
migrates its prose refs to it — for the measured corpus that is 26 lines, a
one-off chore that belongs to the consumer.

```ts
import { mdGherkin } from '@nielspeter/eess-crossvalidate'

mdGherkin(c, f).citations().should().resolve().check()
// finding: story cites "View job schedules" in job-management.feature — no such scenario
```

Non-vacuity: report `N citations across M feature files / K scenarios`.

**Files changed:** `packages/crossvalidate/src/md-gherkin.ts`, fixtures + tests
(red: citation to missing scenario / missing feature; green: resolving corpus;
guard: scenario-like prose in a code fence must not count as a citation).

### Phase 3 — `erDiagram` in eess-mermaid + parameterized table↔diagram binding

Two separable deliverables, split so the generic part stays generic:

1. **Grammar (generic):** extend the Langium grammar with `erDiagram` (standard
   Mermaid: entities, attributes, relationships) — exactly as valuable to any
   consumer as `classDiagram` is today.
2. **Binding (parameterized):** an md-table ↔ er-entity correspondence in
   `eess-crossvalidate` where the **consumer supplies** the section pattern,
   the column→attribute mapping, and the keyBy (the split-`keyBy` model from
   plan 0062). The measured corpus's `Properties` / `Property|Type|Required`
   shape appears **only in that consumer's rules file**, never in the preset.

```ts
mdMermaidEr(c, {
  table: { section: /Properties/, name: /Property/, type: /Type/ }, // consumer's shape
})
  .should()
  .agree()
  .check()
```

**Files changed:** `packages/mermaid/src/**` (grammar + model),
`packages/crossvalidate/src/md-mermaid-er.ts`, fixtures + tests.

### Phase 4 — Vocabulary primitive (named references)

A generic controlled-vocabulary check: derive a term set from the corpus (files
in a folder, headings in a glossary, values of a labeled field) and assert that
named references elsewhere resolve against it. Both the term-set derivation and
the reference matcher are **consumer parameters** — the DDD names below
(bounded contexts, aggregates) are one consumer's vocabulary, used here purely
as the worked example; nothing DDD-shaped enters the package.

```ts
const contexts = vocabulary(c, { fromFolders: 'specs/domain/*-context' })
terms(c)
  .that()
  .matchLabel(/Bounded Context:/)
  .should()
  .resolveAgainst(contexts)
  .check()
```

**Files changed:** `packages/md/src/builders/vocabulary.ts` (+ model), tests.

### Phase 5 — External-root pointers (small)

An option on `pointers()` / the corpus: resolve `path:line` pointers against an
additional root (a sibling checkout of a legacy system). Report distinctly when
the external root is absent (skipped, not passed) — never a silent pass.

**Files changed:** `packages/md/src/builders/pointers.ts`, corpus option, tests.

## Evidence (internalized, by value — spike of 2026-07-13)

Run: eess-md `dist` pointed at the consumer corpus root with
`corpus({ cwd, roots: ['specs/**'] })`. Results: 261 documents; 892 links → 1
broken; 44/44 entity specs conform; 24 ADRs → 1 missing section; 22 `.feature`
files with 464 scenarios; 46 docs with `erDiagram`; 20 bounded-context names, 47
aggregate-root declarations, 168 glossary headings; 11 external legacy-source
citations. (The spike script was scratchpad-ephemeral; this table is the record.)

## Out of scope

- **Code↔spec binding for JVM targets** — an `eess-kotlin`/JVM dialect, `.vue`
  SFC support, an OpenAPI dialect. Real gaps, different plan: this one is
  spec↔spec only.
- **Flowchart / sequence / state Mermaid grammars** — measured in the corpus
  (117 flowcharts, 40 state, 23 sequence) but no correspondence target defined
  yet; revisit when one exists.
- **Consumer-side conventions** — rule IDs (`BR-NNN`) and enforcement-table
  adoption belong to the consumer corpus, not to eess.

## Success definition

- The five gaps close as gates a consumer can run: scenario citations resolve
  (Phase 2), entity table ↔ erDiagram agree (Phase 3), named references resolve
  (Phase 4), external pointers ground or report skipped (Phase 5) — each proven
  non-vacuous with **in-repo red/green fixtures** and a scanned-count summary
  line. The fixtures are the CI gate.
- _Manual, validation-owed:_ re-running the spike's checks over the original
  consumer corpus (private, outside this repo — CI cannot exercise it) flags
  the two known defects **plus** the previously-invisible layers (scenario
  refs, diagrams, vocabulary) with real denominators.
- Nothing consumer-shaped ships in a package: section/column names, citation
  prose, and vocabularies appear only in consumers' rules files (the
  genericity rule above, checkable at review).

## Progress ledger

- [ ] Phase 1 — opaque corpus members
- [ ] Phase 2 — Gherkin scenario citations
- [ ] Phase 3 — erDiagram + table↔diagram preset
- [ ] Phase 4 — vocabulary primitive
- [ ] Phase 5 — external-root pointers

Deferred: none yet — Draft; unknowns resolve at the freeze.
