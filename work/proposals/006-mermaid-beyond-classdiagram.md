# Proposal 006 — Mermaid beyond `classDiagram`, and diagrams embedded in Markdown

**State:** Draft — filed 2026-08-22, not yet reviewed. The existing-code survey
below was run before filing and **it materially changed the ask**: half of what
was requested already ships. What survives is smaller, sharper, and split into
two questions that deserve different answers.
**Priority:** Medium — extends adoption surface. It does not close a gap between
what eess claims and what it checks: `eess-mermaid` has never claimed to model
sequence, flow or state diagrams, so nothing here is currently over-claimed.
**Origin:** inbound — a consuming project whose entire diagram corpus is
Markdown-embedded, and whose diagram types `eess-mermaid` does not model. The
project holds **155 mermaid fences across 32 documents and zero `.mmd` files**.
**Affects:** `@nielspeter/eess-mermaid` (parsers, `diagram()` entry point) ·
`@nielspeter/eess-crossvalidate` (`md-mermaid` subpath).

## The ask, as received

- **A.** eess should read diagrams **embedded in Markdown fences**, not only
  standalone diagram files.
- **B.** eess should support the **diagram types real corpora actually use**, not
  only `classDiagram` and `erDiagram`.

## Measured evidence

The reporting corpus, counted by scanning to the first non-blank, non-directive
line inside each ` ```mermaid ` fence:

| Type              | Count | Modelled by `eess-mermaid` |
| ----------------- | ----- | -------------------------- |
| `graph`           | 60    | no                         |
| `sequenceDiagram` | 56    | no                         |
| `flowchart`       | 23    | no                         |
| `stateDiagram-v2` | 8     | no                         |
| `erDiagram`       | 5     | **yes**                    |
| `gantt`           | 3     | no                         |
| `classDiagram`    | **0** | yes                        |

**155 fences · 32 documents · 0 standalone diagram files.** So the flagship
diagram type this dialect was built for does not occur in this corpus at all,
and the one modelled type that does occur is a 3% minority.

One instrument note, recorded because this proposal is partly _about_ honest
measurement: a first pass counted 152 and missed the three `gantt` diagrams,
because it read the line immediately after the fence and those fences open with
a blank line. A count that reads position rather than content undercounts
silently.

## Existing code survey

### Ask A **already ships** — twice

Markdown-fence extraction of mermaid diagrams is built, shipped and dogfooded.

- `eess-md`'s document model exposes every fence:
  `packages/md/src/model/document.ts:36` carries
  `{ lang, value, line }`, and every document carries
  `packages/md/src/model/document.ts:64`.
- `eess-crossvalidate`'s `md-mermaid` binding consumes exactly that: it selects
  mermaid fences at `packages/crossvalidate/src/md-mermaid.ts:143` and feeds the
  fence string straight to `diagram()` at
  `packages/crossvalidate/src/md-mermaid.ts:93`.

  > Re-anchored after [bug 0209](../bugs/fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)
  > moved both lines. The survey originally cited `:56`/`:57`, which the fix
  > turned into unrelated JSDoc — `check:corpus` stayed green because the
  > pointer rule proves a line **exists**, not that it still says what the
  > citing prose claims. The claim itself is unchanged: fence extraction ships.

- Its sibling `md-mermaid-er` does the same for ER, selecting on fence **content**
  at `packages/crossvalidate/src/md-mermaid-er.ts:53`.

Verified by running it: `diagram(fenceString)` parses a lifted fence today. The
entry point at
`packages/mermaid/src/core/diagram.ts:7` takes _either_
a file path _or_ a diagram string — the
`packages/mermaid/src/core/diagram.ts:5` branch decides
which. Reading a fence needs no new capability.

**This is the fourth proposal in this lane to ask for something that exists**
(001, 003, 004 preceded it). The pattern holds: the ask was written from the
front door — `eess-mermaid`'s own `diagram()` looks like a single-file API — not
from the code.

### Ask B is genuinely new, and the infrastructure is proven

Grammars are Langium, one file per type, and they are **small**:

| Grammar                 | Size   |
| ----------------------- | ------ |
| `class-diagram.langium` | 1362 B |
| `er-diagram.langium`    | 1295 B |

Adding a type costs one `.langium` grammar, one `parse-*.ts`, and its `collect*`
functions — the shape both existing parsers already follow
(`packages/mermaid/src/index.ts:21`,
`packages/mermaid/src/index.ts:86`). The mechanism is not the
hard part.

## What the survey leaves

Ask A collapses from "build fence support" into two much smaller things:

- **A1 — discoverability.** The capability lives in `eess-crossvalidate`'s
  bindings, not in `eess-mermaid`'s own surface. A reader of the mermaid dialect
  cannot find it. This is plausibly a docs answer, or a thin re-export.
- **A2 — attribution.** `diagram(fenceString)` returns a project whose
  `filePath` is `undefined`, so a violation cannot point at the Markdown file
  and line. `md-mermaid` works around this by re-attributing in `identify`
  (with a source comment saying exactly that). Every future fence consumer will
  have to repeat that workaround, or forget to. **A `diagram()` overload
  accepting `{ file, line }` provenance would make the workaround unnecessary
  — this is the one piece of Ask A that is real, and it is small.**

Ask B stands, but must be argued **per type**, not as one ask.

## The enforcement question — the part that decides Ask B

Per ADR-009, a capability that cannot go red is worth less than no capability.
A grammar is cheap; a **break class** is the real cost. What corruption must
produce a violation, for each requested type?

| Type              | Candidate break class                                                                      | Strength                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `sequenceDiagram` | participants ↔ real modules/classes; messages ↔ real calls between them                    | **Strong** — this is `classDiagram`'s correspondence argument applied to interactions, and it is checkable against the TS dialect |
| `stateDiagram-v2` | states ↔ members of a TS union/enum; transitions ↔ methods that perform them               | **Strong** — a state added in code and not in the diagram is a real, common drift                                                 |
| `flowchart`       | node ids ↔ files/modules, but only under a caller-declared mapping — labels are free prose | **Weak** — no intrinsic binding; needs the consumer to declare what a node denotes                                                |
| `graph`           | same as `flowchart` (`graph` is its older spelling)                                        | **Weak** — same                                                                                                                   |
| `gantt`           | none found. A schedule has no code counterpart                                             | **None** — should be rejected outright                                                                                            |

**The 60 `graph` + 23 `flowchart` diagrams — 54% of the corpus — are the weakest
case, and the largest.** That inversion is the central finding of this proposal:
adoption pressure and enforcement value point in opposite directions here. A
grammar for `flowchart` would parse 83 diagrams and be able to assert almost
nothing about them without the consumer first declaring a node→artifact mapping.

If Ask B ships at all, the honest order is `sequenceDiagram`, then
`stateDiagram-v2`, and `flowchart`/`graph` only behind a declared mapping.

## Open questions

These are the author's to settle; the review should argue them, not resolve them.

1. **Is `eess-mermaid` a diagram-file dialect or a corpus dialect?** Today
   `diagram()` takes one input and `md-mermaid` supplies the corpus loop from a
   sibling package. Whether fence iteration belongs _in_ the mermaid dialect is a
   placement decision, and it is the one that decides A1.
2. **Does a weak break class justify a grammar?** A `flowchart` parser has real
   non-enforcement value — rendering checks, node-reference validation via the
   existing `validateReferences`. Is "it parses and validates internal
   references" enough for a dialect whose thesis is that drift fails the build?
3. **Does the declared-mapping shape already exist?** `md-mermaid-er`'s
   `entity(doc)` callback is exactly a caller-declared mapping. If `flowchart`
   support is a `node(doc, id)` callback, that is a precedent to copy rather than
   a mechanism to invent — and it would change the answer to question 2.

## Out of scope

- **`gantt`.** No code correspondence exists. Named here so the decision is on
  the record rather than implied by omission.
- **Rendering, layout or diagram generation.** eess validates artifacts; it does
  not produce them.
- **The `md-mermaid` crash on mixed corpora.** Surveying this proposal found that
  `md-mermaid` selects fences by `lang` alone and calls `diagram()` with no error
  handling, so a single non-`classDiagram` mermaid fence aborts the whole preset
  — while its sibling `md-mermaid-er` filters on content and handles parse
  errors. That is a defect in shipped code, not a design question, and belongs in
  the bug lane. It is noted here only because it blocks Ask A for exactly the
  corpora Ask A is about.
