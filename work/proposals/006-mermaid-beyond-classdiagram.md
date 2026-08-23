# Proposal 006 — Mermaid beyond `classDiagram`, and diagrams embedded in Markdown

**State:** Draft — filed 2026-08-22; **reviewed 2026-08-22** (architect · product · enforcement), ruling `Split and sequence` — see `## Review` below. The existing-code survey
below was run before filing and **it materially changed the ask**: half of what
was requested already ships. What survives is smaller, sharper, and split into
two questions that deserve different answers.
**Priority:** Medium — extends adoption surface. ~~It does not close a gap between
what eess claims and what it checks: `eess-mermaid` has never claimed to model
sequence, flow or state diagrams, so nothing here is currently over-claimed.~~
**⚠️ Falsified by this proposal's own review and annotated rather than edited away
(`PROPOSALS.md`, "Corrections stay in the record").** `docs/manifesto.md:223` marks
`## Mermaid Semantic Schemas — shipped` — where the manifesto defines _shipped_ as
"exists, runs in CI today" — over a `graph TD` example that no eess grammar parses.
So a gap between claim and check does exist. Filed as
[bug 0217](../bugs/0217-the-manifesto-marks-flow-diagrams-shipped.md); whether that
makes this proposal High is left to the author, and the Priority above is unchanged
pending that decision rather than silently revised.
**Origin:** inbound — a consuming project whose entire diagram corpus is
Markdown-embedded, and whose diagram types `eess-mermaid` does not model. The
project holds **155 mermaid fences across 32 documents and zero `.mmd` files**.
**Affects:** `@nielspeter/eess-mermaid` (parsers, `diagram()` entry point) ·
`@nielspeter/eess-crossvalidate` (`md-mermaid` subpath) · **and `@nielspeter/eess-ts` for
Ask B** — added after review: both "Strong" rows need a right-hand side that dialect does
not have (`ArchCall` is the syntactic callee, not a resolved class→class edge; enums are not
in the `types()` element set at all).

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
  mermaid fences at `packages/crossvalidate/src/md-mermaid.ts:186` and feeds the
  fence string straight to `diagram()` at
  `packages/crossvalidate/src/md-mermaid.ts:120`.

  > **These pointers went stale TWICE.** Re-anchored once after
  > [bug 0209](../bugs/fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)
  > moved both lines — and the same PR's later commits moved them again, onto
  > `suggestion:` and a JSDoc line, which is what all three reviewers found. Corrected
  > below to `:186`/`:120` and recorded rather than quietly fixed: a survey that cannot
  > cite its own evidence on the second attempt is a survey defect, and this lane already
  > records the same shape for proposal 004. `check:corpus` stayed green through both
  > rounds — `:56`/`:57` first, then `:143`/`:93` — because the pointer rule proves a line
  > **exists**, not that it still says what the citing prose claims. Filed as
  > [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md). The survey originally cited `:56`/`:57`, which the fix
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

4. **Which authority owns the set of modelled diagram kinds, and what fails when the parser
   set and a binding's selector disagree?** Today: nobody, and nothing. Five kind-lists live
   across two packages. This question was raised by the review rather than the submission,
   and ~~[plan 0214] is the attempt to answer it — its registry design is where the answer will
   be argued.~~ **0214 no longer answers this.** Four drafts of a registry were each
   falsified (see that plan's "What four drafts got wrong"), and it now explicitly declines:
   _"this plan does not publish a kind registry."_ **OQ4 is therefore un-owned and stays
   open here**, which is the right home — a proposal outlives the plans it spawns, and the
   four falsifiers plus the suppression-registry constraint are the floor a fifth attempt
   must clear.

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

## Review — 2026-08-22

**Ruling: Split and sequence**

Three lenses — architect, product, enforcement — reviewed this independently and reached
the same ruling. The survey discipline is right and the break-class table is the correct
instrument; what fails is that this is four-to-six shippable things under one header, and
the column that decides Ask B is unmeasured judgment printed in the same visual grammar as
measured counts.

**The proposal's own defects, recorded rather than fixed away.** Its re-anchored code
pointers were stale a **second** time, landing on `suggestion:` and on a JSDoc line, in the
same paragraph that diagnoses pointer staleness — all three reviewers found it
independently. Its Priority rationale ("nothing here is currently over-claimed") is
falsified by this repo's own design spec: `docs/manifesto.md` marks
`## Mermaid Semantic Schemas — shipped`, where _shipped_ is defined as "exists, runs in CI
today", and its only worked example is a `graph TD` — a kind `FOREIGN_HEADER` denylists by
name. Either this is High priority or the manifesto owes a status correction. And it has
**no acceptance criteria at all**: zero occurrences of "non-vacuity", "fixture",
"examined", "tier" or "warn". `PROPOSALS.md` requires the break class _and how
non-vacuity is kept_; this delivered the first and omitted the second — proposal 001's
recorded correction, committed again.

**Two findings outrank the design question and leave for the bug lane.**
[Bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md):
`diagram()` dispatches on content, so any non-`classDiagram` input is probed against the
filesystem — measured, a fence body that is a path causes an arbitrary local file read
whose content reaches CI output, and a fence naming a real `.mmd` is compared against code
as that file. That makes Ask A2 a soundness fix with an ergonomics rider, not the reverse.
[Bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md) already routes the shared
diagram-kind predicate here, and this proposal never mentions it — a dangling
forward-reference to the highest-value, lowest-cost item in the area.

**Ask A does not survive as one ask.** Fence extraction ships; A1 is a narrower docs gap
than stated (`packages/mermaid/README.md` never mentions fences, and nothing under `docs/`
mentions `md-mermaid`); A2 is now bug 0211's fix; and a third piece the proposal does not
contain — extracting `declaredKind()` into `eess-mermaid` — is the one that removes three
of four duplicate copies of diagram-kind knowledge.

**Ask B is not costed correctly.** Both "Strong" rows need a right-hand side `eess-ts`
does not have: `ArchCall` is the syntactic callee, not a resolved class→class edge, and
enums are not in the `types()` element set at all — yet `eess-ts` is not in `Affects:`.
The Strong/Weak axis also collapses under its own logic, because `stateDiagram-v2` needs a
caller-declared mapping exactly as `flowchart` does; the axis that survives is whether a
diagram element carries an identifier _intended_ to denote a code identifier. The cost
model quotes the ER shape (parser + collectors, no builder) while Ask B's value argument
assumes the classDiagram shape (models → predicates → conditions → builder, barrel, CLI,
`check:family`, docs, changeset, fixtures) — an order of magnitude apart. And adding a
modelled kind means _removing_ entries from a fail-closed denylist written days earlier,
with nothing keeping the grammar set and the selector in lockstep: ship a grammar, forget
`FOREIGN_HEADER`, and every fence of that kind is skipped while the gate prints a
denominator and exits 0.

**Dogfooding inverts the proposed order.** This repo's own corpus holds `classDiagram`,
`erDiagram` and one `graph` — the kind rated Weak — and **zero** `sequenceDiagram` or
`stateDiagram`. The lane has direct precedent for parking on that ground: plan 0096 put the
ER binding out of scope indefinitely for want of an `erDiagram` here. So Ask B's two Strong
rows would ship capabilities eess cannot run against itself, proved only by synthetic
fixtures.

**Open questions.** Not resolved here. But OQ1's "corpus dialect" branch is **gated shut**
by `arch.rules.ts`'s `eess/mermaid-isolated`, and reversing that is a new binding decision
that belongs in an ADR rather than a plan bullet — the proposal should say so before the
author decides. OQ2's fallback rests on `validateReferences`, which has no production
caller. And answering OQ3 "yes" obliges rewriting the table OQ2 depends on, which makes
**OQ3 the blocking one**, not OQ2 as ordered. A fourth question is owed and missing: which
authority owns the set of modelled diagram kinds, and what fails when the parser table and
the fence selector disagree? Today the answers are "nobody" and "nothing".

### Disposition, per ask

A proposal is a design record; it does not become work. Accepted parts are implemented by
plans — one each, because they have different closure conditions — and this record points at
them. Rejected parts stay here with the reason, so the same ask does not return.

| ask                                                                                                | disposition            | owner                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** — discoverability: fence support exists but is unfindable from `eess-mermaid`'s own surface | **Accepted**           | [plan 0212](../plans/0212-eess-mermaid-fence-discoverability.md) — narrow: `packages/mermaid/README.md` never mentions fences, and nothing under `docs/` mentions `md-mermaid`. Two paragraphs, not a re-export                                                                                                                                                             |
| **A2** — `diagram()` provenance, so a fence consumer need not re-attribute                         | **Accepted, reshaped** | [plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md), sequenced **after** [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md) — the sniffing defect makes this a split entry point (path loader / source parser). 0211 lands `(text)`; this plan adds and consumes `provenance`                                                    |
| **A3** — extract `declaredKind()` into `eess-mermaid` _(not in the submission; found by review)_   | **Accepted**           | [plan 0214](../plans/0214-extract-the-diagram-kind-predicate.md); folds in [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md) and fixes it by testing the **declared kind** rather than the raw fence body. ~~removes three of four duplicate copies of diagram-kind knowledge~~ — **falsified**: moving the lexer removes none of the four kind lists; see 0214 |
| **B** — `sequenceDiagram`                                                                          | **Held**               | not rejected, not ready. Needs the deciding measurement (what fraction of participants resolve to real classes), an `eess-ts` cost line — `ArchCall` is the syntactic callee, not a resolved class→class edge — and a dogfood consumer, since this repo has none                                                                                                            |
| **B** — `stateDiagram-v2`                                                                          | **Held**               | same, plus a new element type: enums are not in `types()` at all                                                                                                                                                                                                                                                                                                            |
| **B** — `flowchart` / `graph`                                                                      | **Held**               | blocked on OQ3. If a caller-declared mapping is the mechanism, this becomes shippable on the same shape as ER — and the ordering above inverts                                                                                                                                                                                                                              |
| **B** — `gantt`                                                                                    | **Rejected**           | no code counterpart. Schedules are not specs, dates drift by design, and no author would fix the finding. On the record so the ask does not return                                                                                                                                                                                                                          |

**Not this proposal's to sequence.** Bugs 0210 and 0211 are defects in shipped code, found
while reviewing this design. They are named above because they gate two accepted parts, but
they belong to the bug lane and close on their own terms.

**Before any Ask B part leaves Held**, this record owes an `## Acceptance criteria` section
in proposal 001's shape: one criterion per submode per type, each naming its fixture file and
the substring the assertion keys on — comparison submode, parse-failure path, and selector.
That is the half `PROPOSALS.md` requires and this submission omitted.
