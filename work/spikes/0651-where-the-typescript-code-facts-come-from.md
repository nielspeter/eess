# Spike 0651: where the TypeScript code facts come from

Measured 2026-11-14, at the maintainer's request to decide
[proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s open question 1
(ask A2) "logically, from the patterns we already have, and spike if needed". The request came
after [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s review: all four
lenses held it, and two of them traced the blocks to A2. Product found the line rule has no user
until a producer exists; the architect and enforcement lenses found 0649's reconciliation needs
whole-repository facts, which is a producer's job. Time-boxed to about an hour. It brings back a
decision, made so it can be overruled. Code pointers are as at `main` 9a7a16ad.

## The question

[Plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md) defines `CodeFacts`: plain data, consumer-side in eess-md, holding a `coverage` set and
`names` (each a declaration, an import or a use, a declaration carrying its `end`, `scope`,
`container` and attached `doc`). Who produces it for TypeScript, and in which package?

[Proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) left two candidates:

- eess-ts, whose output would meet the contract only structurally, since eess-ts cannot import
  eess-md;
- eess-crossvalidate's `md-ts`, beside `adrCitationsResolve`.

## What the repository already decides

Read, not recalled:

1. **The AST walk belongs to eess-ts.**
   - ts-morph is the one AST engine ([ADR-002](../../adr/002-ts-morph-ast-engine.md)), and eess-ts is
     the dialect that owns it.
   - [ADR-007](../../adr/007-isolate-ast-engine-boundary.md), still Proposed with its confinement
     `pending`, sets the direction: ts-morph behind one boundary, and the boundary batch-first. Its
     rejected alternative is a boundary that "leaks the chatty access pattern" of live nodes walked
     by callers.
   - eess-crossvalidate has followed this on every TypeScript read. Both of its md↔ts and
     gherkin↔ts readers say "via eess-ts's public API; no ts-morph here, per [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)"
     (`packages/crossvalidate/src/md-ts.ts:152`, `packages/crossvalidate/src/gherkin-ts.ts:87`).
   - So a producer that walks every identifier cannot live in crossvalidate, which would have to
     walk ts-morph nodes it was handed. It needs a new eess-ts surface, since none of eess-ts's
     builders (`modules`, `classes`, `functions`, `types`, `calls`, `slices`) yields names, uses or
     doc spans.
2. **eess-ts cannot name eess-md's type.** The `eess/ts-isolated` arch rule forbids it
   (`arch.rules.ts:267-272`). Only eess-crossvalidate imports two dialects
   (`packages/crossvalidate/package.json` peers on all four), and its package description names as
   its job: "bind two dialects' artifacts and fail when they drift"
   (`packages/crossvalidate/package.json:4`).
3. **The pattern for "an eess-ts fact read on the Markdown side" exists, and has one shape.**
   - eess-ts exposes an element model with precomputed accessors: `ArchCall`, selected by
     `calls(project).select()`.
   - Crossvalidate maps it to the Markdown side, translating paths between the project and the
     corpus: `adrCitationsResolve(corpus, project)`, `extractTestDefs` at
     `packages/crossvalidate/src/md-ts.ts:115-145`.
   - It reports an input that loaded nothing with its own helpers (`projectLoadedNothing`,
     `withEmptySource`, `packages/crossvalidate/src/shared.ts:126-140`).
   - Every md↔ts binding shipped so far is that shape. None is a structural contract between two
     dialects.

## Measured

Prototype: `scripts/measure-code-facts.mjs`, committed with this record. It loads the six package
tsconfigs through eess-ts's public `project()` and walks each covered file's identifiers once (the
instrument's declaration list, and `getJsDocs()` for the attached doc only). It shapes the facts to
the contract, then applies [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s line rule, with the enforcement review's stale-facts guard,
to every reference the stock pattern reads through eess-md. Node 24, at 9a7a16ad, one run of
14.1 s.

| measure                                                             | result                                                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| projects loaded                                                     | 6, in 3.27 s                                                                                                                                                      |
| files covered                                                       | 1,342                                                                                                                                                             |
| facts, walking every covered file                                   | 223,896 (51,330 declarations, 10,782 imports, 161,784 uses), in 4.12 s; heap 1,398 MB                                                                             |
| facts, walking only the files the references cite                   | 149 files, 41,283 identifiers, in 0.13 s; heap 863 MB, almost all of it the projects' load                                                                        |
| declarations with an attached doc                                   | 5,368; none ends at or after its name's line, so [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s refusal never fires on a real producer |
| a fact on the cited line without the name in its text (stale facts) | 0, as fresh facts should give                                                                                                                                     |
| references examined                                                 | 484 (the rule itself ran in 17 ms)                                                                                                                                |

The rule's classes over those 484 references, all and live:

| class                                            | all        | live       |
| ------------------------------------------------ | ---------- | ---------- |
| holds as code                                    | 96         | 57         |
| lies in the declaration's doc comment            | 59         | 33         |
| declared once, elsewhere (drift)                 | 122        | 54         |
| in the named declaration's body                  | 39         | 23         |
| imported only                                    | 24         | 11         |
| used only                                        | 10         | 7          |
| declared more than once                          | 14         | 8          |
| declared only as a local                         | 12         | 8          |
| no fact of the name in the file                  | 48         | 19         |
| text only                                        | 2          | 0          |
| not covered by these tsconfigs                   | 48         | 22         |
| stale line, ambiguous path, not code, not a name | 3, 4, 1, 2 | 0, 0, 1, 2 |

Against the judged samples, matched on document, name and pointer (some rows' lines moved since):

- **Holders:** 17 of the 18 that still match are judged correct and go green. The one that does not
  is h05, a range whose first line misses, already recorded as a known false red in
  [plan 0648](../plans/completed/0648-md-a-code-reference-still-appears-in-its-file.md). One
  `.github` file is not covered.
- **Misses:** 13 judged drifted go red as drift, 1 as a local. 5 judged "in-body" (the doc comment
  just above the declaration) go green, as they should. 3 judged drifted go green; these are
  exactly the three earlier reviews already settled: m02 is the judge's own error, and m10 and m22
  are the disputed closing lines of a doc comment.
- **Span sample:** 14 correct go green, and all 7 drifted go red as body lines. 5 correct go red as
  body lines, the known cost of [spike 0646](./0646-what-ask-a1-of-proposal-021-reads-and-judges.md)'s
  S2.

Coverage, of the 170 cited files: 149 are covered by the package tsconfigs and 21 are not. The 21
are `scripts/` (13), `.github/`, `eslint.config.ts`, `kit/`, `arch.rules.ts`, two `package.json`s
and a README.

## What the measurement adds

1. **A producer over TypeScript is feasible, and its facts carry the rule.** Built on facts from
   eess-ts's own project, the rule reproduces every verdict the earlier judged samples and reviews
   reached. That is the reconciliation [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md) could not do with the instrument, whose classes
   differ.
2. **What the producer walks is the whole cost.** Every covered file costs 4.1 s and 0.5 GB of facts;
   the cited files alone cost 0.13 s. [Plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s contract is plain data, which the reviews kept for
   good reasons (it can be listed, copied and checked). An eager producer therefore pays for every
   file unless it knows which files the documents cite. Only a component that sees both the corpus
   and the project knows that.

## Options

- **A. eess-ts produces `CodeFacts` itself**, structurally identical to eess-md's type. Rejected:
  - it is the family's first data contract between two dialects held only structurally, so it needs
    an ADR, as the proposal recorded;
  - eess-ts does not see the corpus, so it walks every covered file (4.1 s, 0.5 GB here) or invents
    a lazy, function-shaped contract that the reviews rejected for `CodeFacts`;
  - path translation between the project and the corpus would fall to every caller.
- **B. eess-ts walks; crossvalidate binds.** eess-ts gains a names element in `ArchCall`'s pattern:
  an engine-neutral model, selected by a builder, its walk bounded to the files the selection asks
  for. Crossvalidate's `md-ts` maps it to `CodeFacts` by a real import of both dialects, translates
  paths, and offers the preset. This follows every shipped md↔ts binding, needs no new ADR, and
  costs the cited files only.
- **C. crossvalidate walks ts-morph nodes** taken from an eess-ts selection (a module's
  `SourceFile`). Rejected: it moves the identifier walk out of eess-ts, against [ADR-002](../../adr/002-ts-morph-ast-engine.md), [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s
  direction, and crossvalidate's own "no ts-morph here".
- **D. eess-md takes a project.** Rejected: `eess/md-isolated` forbids eess-md importing eess-ts,
  and eess-md would gain a parser, which [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) kept out of it from the first review.

## Decided, 2026-11-14

**B.** The reasons, in order of weight:

- the walk must sit in eess-ts ([ADR-002](../../adr/002-ts-morph-ast-engine.md), [ADR-007](../../adr/007-isolate-ast-engine-boundary.md), and crossvalidate's practice), and eess-ts cannot
  name eess-md's type;
- the binding of two dialects is crossvalidate's stated job, and every md↔ts binding already has
  this shape;
- only the binder sees both the corpus and the project, so only it can bound the walk to the cited
  files, which is a factor of 30 in walk time here;
- the binder already holds the project, so the empty-facts finding can name its tsconfig, which
  eess-md's builder cannot ([bug 0641](../bugs/0641-the-empty-source-finding-names-no-source.md)).

In more detail:

1. **eess-ts: a `names(project)` element.**
   - An engine-neutral model, as `ArchCall` is: file, name, kind, line, and for a declaration its
     `end`, `scope`, `container` and attached `doc`.
   - Selected by a builder, so it inherits the base surface and `.select()`.
   - Its walk is bounded to the files its file predicates select (`resideInFile`, `resideInFolder`),
     never every file and then a filter. The bound is the measured cost.
   - The element's own rules (a name banned in a folder, for example) come for free with the
     builder. Whether they earn the builder is a question for A2's plan.
   - An additive eess-ts minor.
2. **eess-crossvalidate `md-ts`: the binding and the preset.**
   - A helper builds `CodeFacts` for the files a set of mentions cites, from the project, with paths
     translated to the corpus's form.
   - A preset in `adrCitationsResolve`'s shape runs [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)'s condition over a corpus and a
     project, and reports an empty project by name.
   - This is the line rule's first user, and the shape in which this repository will wire it.
3. **eess-md: [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md) keeps `CodeFacts` as plain data**, consumer-side, usable by hand or from any
   other producer. Its own builder still reports facts that loaded nothing, for a hand-built
   caller.
4. **No new ADR.** No contract crosses two dialects except through crossvalidate's real imports.
   [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)'s direction is followed, not changed.

**Consequences for [plan 0649](../plans/0649-md-a-code-reference-resolves-at-its-lines.md)**, to fold into its rewrite:

- Its reconciliation moves here or to A2's plan; this spike's numbers are its baseline.
- Its figures are replaced by the table above.
- It releases together with A2's two parts, so the contract ships with a user.
- The emptiness helper is needed both in crossvalidate (already, `withEmptySource`) and at
  eess-md's builder; lifting it to `@nielspeter/eess/internal` first, with the dropped `undecided`
  count the architect lens found, is one small refactor that both sides then use.

**Not decided here:**

- the names element's exact shape and name;
- whether it carries predicates of its own;
- the preset's name and options;
- what this repository does about the 21 uncovered cited files (`scripts/` most of all).

Those belong to A2's plan. The 1.4 GB heap of an unbounded walk is the reason the bound is a
requirement, not an optimisation.

## Corrections

None yet.
