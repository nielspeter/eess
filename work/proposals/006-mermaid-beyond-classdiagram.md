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
  `packages/crossvalidate/src/md-mermaid.ts:88`.

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
  at `packages/crossvalidate/src/md-mermaid-er.ts:58`.

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
`packages/mermaid/src/index.ts:62`). The mechanism is not the
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

## Acceptance criteria

Added 2026-08-23, when [plan 0218](../plans/completed/0218-gate-proposal-acceptance-criteria.md) made the
convention enforceable. **This proposal shipped without this section** — its own review
below recorded that as a defect it committed, and the gate that now catches it found this
record on its first run.

Per capability: the break class — the specific corruption that must produce a violation —
and how non-vacuity is kept. Only the **accepted** asks are covered; the `Held` ones cannot
state a break class yet, and why is stated below rather than left blank.

| capability                                                                                                                                             | break class — what must go red                                                                                                                                                                                                                                                                             | non-vacuity                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** — fence support is discoverable from `eess-mermaid`'s own surface ([plan 0212](../plans/0212-eess-mermaid-fence-discoverability.md))            | None that a gate can produce. This is a documentation gap: `packages/mermaid/README.md` never mentions fences and nothing under `docs/` mentions `md-mermaid`. Tier 4, closed by review, and it is listed here so the absence is deliberate rather than an oversight                                       | the doc fences are compiled by `check:docs-code`, so the example cannot rot into something that does not typecheck — it does **not** require the section to exist (see [bug 0220](../bugs/0220-nothing-requires-a-public-symbol-to-be-documented.md)) |
| **A2** — `diagram()` carries provenance so a fence consumer need not re-attribute ([plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md)) | a diagram parsed from a Markdown fence reports a `filePath` that is either absent or points at something the caller must re-derive — so a violation's `file` names the wrong artifact                                                                                                                      | a fixture parsing a fence and asserting the reported source, red when provenance is dropped                                                                                                                                                           |
| **A3** — `declaredKind()` extracted into `eess-mermaid` ([plan 0214](../plans/completed/0214-extract-the-diagram-kind-predicate.md))                   | a themed `erDiagram` — one prefixed with `%%{init}%%` or `---` frontmatter — is silently dropped from the md↔mermaid binding because the selector tests the raw body instead of the declared kind. This is [bug 0210](../bugs/fixed/0210-er-fence-selector-is-an-allowlist.md), measured, not hypothetical | a committed fixture carrying a themed `erDiagram`; the binding must select it, and removing the kind predicate must red                                                                                                                               |

**The `Held` asks state no break class, and that is the reason they are Held.**
`sequenceDiagram` needs the deciding measurement (what fraction of participants resolve to
real code); `stateDiagram-v2` needs a new element type — enums are not in `types()` at all;
`flowchart`/`graph` is blocked on Open Question 3. Each row in the disposition table below
names what would unhold it. A capability with no break class is unfalsifiable, which is
precisely why these are not accepted.

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
[Bug 0210](../bugs/fixed/0210-er-fence-selector-is-an-allowlist.md) already routes the shared
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

| ask                                                                                                | disposition            | owner                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** — discoverability: fence support exists but is unfindable from `eess-mermaid`'s own surface | **Accepted**           | [plan 0212](../plans/0212-eess-mermaid-fence-discoverability.md) — narrow: `packages/mermaid/README.md` never mentions fences, and nothing under `docs/` mentions `md-mermaid`. Two paragraphs, not a re-export                                                                                                                                                                             |
| **A2** — `diagram()` provenance, so a fence consumer need not re-attribute                         | **Accepted, reshaped** | [plan 0213](../plans/0213-diagram-provenance-for-fence-callers.md), sequenced **after** [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md) — the sniffing defect makes this a split entry point (path loader / source parser). 0211 lands `(text)`; this plan adds and consumes `provenance`                                                                    |
| **A3** — extract `declaredKind()` into `eess-mermaid` _(not in the submission; found by review)_   | **Accepted**           | [plan 0214](../plans/completed/0214-extract-the-diagram-kind-predicate.md); folds in [bug 0210](../bugs/fixed/0210-er-fence-selector-is-an-allowlist.md) and fixes it by testing the **declared kind** rather than the raw fence body. ~~removes three of four duplicate copies of diagram-kind knowledge~~ — **falsified**: moving the lexer removes none of the four kind lists; see 0214 |
| **B** — `sequenceDiagram`                                                                          | **Held**               | not rejected, not ready. Needs the deciding measurement (what fraction of participants resolve to real classes), an `eess-ts` cost line — `ArchCall` is the syntactic callee, not a resolved class→class edge — and a dogfood consumer, since this repo has none                                                                                                                            |
| **B** — `stateDiagram-v2`                                                                          | **Held**               | same, plus a new element type: enums are not in `types()` at all                                                                                                                                                                                                                                                                                                                            |
| **B** — `flowchart` / `graph`                                                                      | **Held**               | blocked on OQ3. If a caller-declared mapping is the mechanism, this becomes shippable on the same shape as ER — and the ordering above inverts                                                                                                                                                                                                                                              |
| **B** — `gantt`                                                                                    | **Rejected**           | no code counterpart. Schedules are not specs, dates drift by design, and no author would fix the finding. On the record so the ask does not return                                                                                                                                                                                                                                          |

**Not this proposal's to sequence.** Bugs 0210 and 0211 are defects in shipped code, found
while reviewing this design. They are named above because they gate two accepted parts, but
they belong to the bug lane and close on their own terms.

**Before any Ask B part leaves Held**, this record owes an `## Acceptance criteria` section
in proposal 001's shape: one criterion per submode per type, each naming its fixture file and
the substring the assertion keys on — comparison submode, parse-failure path, and selector.
That is the half `PROPOSALS.md` requires and this submission omitted.

## Consumer evidence — 2026-10-07

Recorded by the coordinating agent at the maintainer's instruction, from an inbound question by an
agent working in a consuming project. It is evidence for the `Held` rows, not a new ruling, and it
changes no disposition above.

**The consumer.** One Markdown document holds one ` ```mermaid ` fence with a `sequenceDiagram` of
five participants: an actor, a service, a database, a worker, and an external HTTP service. The
external service's API is documented twice in the same repository: in prose, and as an OpenAPI
document. **The code is Python, not TypeScript.** The project already runs eess-md, eess-ts and a
non-vacuity harness in its gates.

**What it asked for**, in its own order:

1. The fence parses, and the diagram is internally consistent: every message's participants are
   declared.
2. Every message from the service to the external service names an endpoint, method and path,
   that exists in the OpenAPI document.
3. Participants map to real paths in the repository, for example the service and worker
   directories.

**Measured against this record.**

- **The `sequenceDiagram` row does not fit this consumer.** It is held on three conditions: a
  deciding measurement ("what fraction of participants resolve to real classes"), an `eess-ts`
  cost line, and a dogfood consumer in this repository. The cost line assumes a TypeScript
  codebase, which this consumer does not have, and being external it cannot be the dogfood
  consumer either.
- **Ask 1 is OQ2, asked about `sequenceDiagram`.** It needs no binding: a parser plus a check
  that the diagram agrees with itself. OQ2 asks whether that is enough for a dialect whose thesis
  is that drift fails the build, and names `validateReferences`
  (`packages/mermaid/src/parser/validate-diagram.ts:12`) as the mechanism. The Review found that `validateReferences` has no production caller, and it checks class diagrams
  only (it reads `ast.classes`), so this ask would also need a sequence parser and validator. This
  is the first consumer to ask OQ2's question, for a second diagram kind.
- **Ask 2 is not in this record or in proposal 003.** Proposal 003's OpenAPI entry binds a spec to
  route-handler code. This asks for a diagram bound to a spec, two documents and no code. Neither
  side has a dialect: no sequence parser, no OpenAPI reader.
- **Ask 3 is OQ3's mechanism.** A caller-declared mapping from participant to path is what the
  `flowchart` row is blocked on. This is a second diagram type asking for it.

**What the consumer was told.** None of the three can be expressed with released packages.
eess-mermaid models `classDiagram` and `erDiagram` only, and `eess-crossvalidate`'s fence reader
compares class diagrams only and skips a `sequenceDiagram` fence
(`packages/crossvalidate/src/md-mermaid.ts:42`, `:92-93`). A
project-local check script with its own non-vacuity fixture is the honest stopgap, labelled as the
project's check, not as eess-mermaid's. It was asked not to file in this repository, because the maintainer decides what is recorded
from an inbound question, and these asks are recorded here as evidence on OQ2, OQ3 and Ask B.

_Correction, 2026-10-07 (method review):_ the first version of this section, and its commit
message, said Ask 1 was not in this record. It is OQ2.

## Consumer evidence — 2026-10-12

Recorded by the coordinating agent at the maintainer's instruction. Same consuming project as the
2026-10-07 evidence above; reported by its agent unless marked measured here.

**What happened.** An edit to the project's one `sequenceDiagram` added two messages with a `;` in
their text — in Mermaid, `;` ends a statement — and GitHub showed "Unable to render rich display —
Parse error on line 8 … Expecting '()', 'SOLID_OPEN_ARROW', … got 'NEWLINE'" instead of the
diagram. None of the project's gates noticed; it was seen by a person opening the page. The
project recorded it as its own bug, open until after its proof of concept.

**What it needs** (its words, condensed): every Mermaid block parses. Participants being declared
would be welcome, but second — the defect class was syntax. A finding needs the file, the
fence's opening line, the line inside the diagram, and the parser's message verbatim. A docs check
should fit in seconds (its corpus job takes ~25 s); a browser in CI is costly, not ruled out.

**Its inventory:** three fences, all in `docs/` — one `sequenceDiagram`, two `flowchart`.

**Measured here, 2026-10-12** — `mermaid` 11.17.2, Node 24, in a scratch directory; nothing added
to eess. `mermaid.parse(text)` over the project's two broken message lines (with participant lines
of our own), the same lines repaired, a valid flowchart and a broken one:

| Environment         | broken sequence                                  | repaired | valid flowchart                                  | broken flowchart |
| ------------------- | ------------------------------------------------ | -------- | ------------------------------------------------ | ---------------- |
| plain Node          | error — the same "… got 'NEWLINE'" GitHub showed | ok       | **error: `DOMPurify.addHook is not a function`** | error            |
| Node + `jsdom` shim | error — the same                                 | ok       | ok (`flowchart-v2`)                              | error            |

- Plain Node is a false red on a valid flowchart: that diagram's path needs a DOM. With a `jsdom`
  window installed before `mermaid` is imported, every case is right.
- Cost: 179 MB installed (`mermaid` 153 MB), no browser; ~210 ms to start (30 ms the shim, 180 ms
  the import), then 2–8 ms per block.
- What it does not show: `parse()` is syntax, not rendering; GitHub pins its own `mermaid`
  version, so a block can parse here and fail there; only `sequenceDiagram` and `flowchart` were
  tried.

**What it bears on.** OQ2 asks whether "it parses and validates internal references" is enough for
a dialect whose thesis is that drift fails the build. This consumer asks for less — that a diagram
parses at all — and for a reason OQ2 does not consider: the manifesto's "the AI generates; the
validator checks … at every layer: spec, schema, rule, diagram" (`docs/manifesto.md:155`). An agent
edited a diagram, broke it, and no validator ran. Today `md-mermaid` parses a `classDiagram` fence
and reports one that fails, but skips every other legal kind by design
(`packages/crossvalidate/src/md-mermaid.ts:86-100`), so this defect passes every eess gate.

## Ask C — every Mermaid fence parses (added 2026-10-12)

_Not in the submission. Added at the maintainer's instruction from the evidence above, so that it
can be ruled on apart from Ask B, which it does not depend on: parsing a fence binds it to
nothing._

- **C.** Every ` ```mermaid ` fence in a corpus parses, whatever its kind, by **Mermaid's own
  parser** — the authority GitHub renders with, so eess does not keep a second grammar per kind that
  can disagree with it. A fence that fails is a finding.

**Acceptance criteria.**

- **Break class:** a fence with a syntax error — the evidence's `;` in a message — is reported with
  the file, the fence's opening line, the line inside the diagram and the parser's message.
- **Break class (false red):** a valid fence of each kind the check claims to read passes; the
  plain-Node `DOMPurify` failure above is the row that pins it.
- **Break class:** the parser cannot be loaded — not installed, or a version it cannot use — is a
  finding, never a pass and never "zero fences" (ADR-009, ADR-016).
- **Break class:** a corpus with no fences fails with the zero-examined finding unless the rule
  declares it expects none (ADR-010).
- **Disclosure:** the parser's version is part of what the check reports, since a different
  version can read a fence differently (ADR-016 rule 7).
- **Non-vacuity:** a fixture row per break class, and one row through this repository's own gate if
  it adopts the check.

## Review — 2026-10-12

**Ruling: Split and sequence**

Ask C only (architect · product · enforcement), with the existing-code survey run first. Asks A1–A3
and B keep their 2026-08-22 dispositions; this ruling restates the whole record's, unchanged, and
adds Ask C's row.

**Survey.** _Partly exists:_ `embeddedDiagramsMatchCode` already reports a `classDiagram` fence
that fails eess-mermaid's Langium grammar, at the Markdown file and fence line
(`packages/crossvalidate/src/md-mermaid.ts:90-118`), and skips every other legal kind by its
`FOREIGN_HEADER` list (`:41-42`, `:187-192`). _Precedent:_ eess-ts loads its optional `graphql` peer
through one guarded loader that reports a missing or broken install (`packages/ts/package.json:109-116`,
`packages/ts/src/graphql/schema-loader.ts:84-145`). _Genuinely new:_ parsing every kind, by the
`mermaid` package; no eess package depends on it. _Dogfood:_ this repository's own corpus
(`work/`, `adr/`, `docs/`) holds 9 `mermaid` fences — 6 at a document's top level, all of which
parse with `mermaid` 11.17.2 (measured), and 3 nested in a list, which no eess reader sees.

**What all three lenses support.** The ask is generic — any project that renders Mermaid on GitHub
or GitLab wants its blocks to parse — and correctly split from Ask B: parsing binds a fence to
nothing, so it inherits none of B's Held conditions. Using Mermaid's own parser rather than a
grammar per kind is right, and it needs no list of kinds, so it adds nothing to OQ4. The evidence
is recorded faithfully, and the criteria are written as break classes with a false-red row. Cost
holds: all 39 fences in this repository, fixtures included, parse in 0.78 s including the imports.

**Why it is held, not yet a plan.** Four things decide whether it can be built inside the family's
contracts, and the record leaves them open:

1. **`mermaid.parse()` is asynchronous; every rule surface in the family is synchronous**
   (measured: it returns a `Promise`; `check()`, `violations()`, `finishPreset` and every preset are
   synchronous). Either the family gains its first asynchronous rule surface — a change to ADR-014's
   doors, which is an ADR — or an asynchronous step builds the facts (every fence parsed in one
   batch) and a synchronous rule reads them, the shape ADR-007 and ADR-013 already set. The architect
   argued for the second; it is the author's to decide.
2. **Nested fences are not read** (bug 0290, High, fail-open): a fence in a list item or blockquote
   never reaches `MdDocument.codeBlocks`, so "every fence" is false on this repository's own corpus,
   and the zero-examined guard cannot see it. Ask C is sequenced after bug 0290, or it discloses the
   unread fences beside its count.
3. **Two parsers would judge one `classDiagram` fence, and they disagree** (measured: of 11
   class-diagram probes, 8 disagree — `mermaid` accepts generics, `namespace`, `note`, `style`,
   `click`, `direction`, a quoted label and `classDiagram-v2`, which eess-mermaid's grammar rejects;
   this repository's own "unparseable" ER fixture is valid Mermaid). The record must state which
   verdict owns "this fence is valid". The one the evidence implies — Mermaid owns syntax; a fence it
   accepts and eess-mermaid cannot model is a gap in eess, not an error in the document — needs
   md-mermaid's message to change, which is bug 0409.
4. **Placement and the dependency** are unargued. Not the kernel. `eess-crossvalidate/md-mermaid`
   imports eess-ts, which a parse-only check does not need; eess-mermaid owning the fence loop is
   OQ1's "corpus dialect" branch, already ruled to need an ADR; product argued a smaller shape — eess-md
   checking a language's code blocks with a parser the caller passes, so eess never depends on
   Mermaid. Whatever the home, `mermaid` and `jsdom` are an optional peer loaded on first use, behind
   one boundary that keeps the shim's globals out of the caller's process (measured: it adds
   `window`, `document`, `DOMParser`, `Element` to `globalThis`; under vitest that reaches the
   adopter's other tests).

   _Update 2026-10-14, on condition 2:_ bug 0290 is fixed — `codeBlocks` holds code blocks at any depth — so that
   condition is met. And "3 nested in a list" (in the Survey above) was never true: those three
   were bug 0290's own reproduction, text inside an outer ` ````text ` fence. Measured
   with mdast over the 438 tracked `.md` files in `work/`, `adr/` and `docs/`: 4 `mermaid` fences
   at the top level, 0 nested.

**Criteria the record owes** (enforcement and architect, measured):

- _The line inside the diagram._ Mermaid counts lines after removing frontmatter, a directive and
  leading blank lines: the same error reads "line 3" at body lines 3, 4, 5 and 6. Rows for
  frontmatter, a one-line and a multi-line directive, a blank lead, and one kind on the Langium
  parser (its error carries the line only in its text), each asserting the exact Markdown line; if
  the line cannot be recovered, the finding says so. Reuse the preamble walk in `declaredKind`
  (plan 0214), not a third copy.
- _Mermaid present, DOM absent._ Under plain Node a labelled flowchart, a `classDiagram`, a
  `stateDiagram-v2` and a `mindmap` fail with `DOMPurify.addHook is not a function`; an unlabelled
  flowchart, a sequence and an ER diagram pass. An exception that is not a parse error is one
  instrument finding per run, unsuppressable, naming the environment — not one syntax finding per
  fence. The false-red row must use content that reaches the sanitizer (a labelled node), or it
  passes with or without the shim.
- _A fence no diagram type matches_ — empty, a directive or comment only, a misspelt kind, a kind
  newer than the pinned parser (`zenuml` is not in core) — each gets its own remedy, verified to
  clear; none is "delete the fence".
- _What a green means:_ "parses with `mermaid` X.Y.Z", never "renders" — GitHub pins its own version
  and renders in a browser, and `parse()` accepted a `mindmap` with an unclosed `root((r)`. The
  version comes from `mermaid/package.json` (`mermaid.version` is undefined in 11.17.2), and the
  success line is asserted to carry it. A supported version range is declared, so "a version it
  cannot use" has something to test against.
- `parse(text, { suppressErrors: true })` returns `false` instead of throwing; the check must not
  take that path.
- _Dogfood is not optional:_ a production row through this repository's own gate, over the
  top-level fences in `work/`, `adr/`, `docs/` (the fixture fences that are broken on purpose stay
  out by glob, not by exclusion). The break for `docs/manifesto.md`'s `graph` fence is
  flowchart-specific (`;` is legal there); a dangling `Route -->` reds it (measured).

**Corrections to Ask C as filed** (kept, not edited away):

- "So eess does not keep a second grammar per kind that can disagree with it" is false for
  `classDiagram` and `erDiagram`, which eess-mermaid already parses — see condition 3.
- "The authority GitHub renders with" holds only per version; the criterion above replaces it.
- ADR-016 governs instruments that run out; a missing peer is ADR-009's (fail closed), and version
  disclosure follows from the tier argument above, not from rule 7. Rule 7 fits the nested-fence
  disclosure in condition 2.
- The empty-corpus criterion reads as a user opt-out the kernel deliberately does not offer
  (`packages/core/src/cardinality.ts`); it should name the existing mechanism or make "no fences" a
  configuration finding.
- The pointer `md-mermaid.ts:86-100` resolves but cites the options interface; the skip is at
  `:41-42` and `:187-192`.

**Found by this review, filed separately:** md-mermaid tells an author to "fix the diagram syntax"
for legal Mermaid that eess-mermaid's grammar does not model — a wrong remedy in shipped code (ADR-009
rule 2), recorded as bug 0409, on its own branch.

### Disposition, Ask C

| ask                                | disposition | owner                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C** — every Mermaid fence parses | **Held**    | accepted in principle by all three lenses; held on the four conditions above — the asynchronous shape, bug 0290 or a disclosure, the rule for which parser owns `classDiagram` syntax (with bug 0409), and placement — and on the criteria the record owes |

## Review — 2026-10-14

**Ruling: Split and sequence**

Ask C only, re-reviewed by architect, product and enforcement on two pieces of new evidence:

- bug 0290's fix, which will meet condition 2 once PR #204 merges;
- [spike 0411](../spikes/0411-can-the-caller-pass-mermaids-parser.md), which measures condition 4.

Asks A1–A3 and B keep their dispositions. The 2026-10-12 criteria stand, and the conditions below add
to them. One exception: its empty-corpus criterion and its correction are both replaced by
condition 9. All three lenses accept the design. It is split into two plans. The row stays `Held`
only until they are drafted, because a disposition is `Accepted` when it names its owner. A method
review of this record followed, and its corrections are applied here.

**Survey.**

- _Exists:_
  - `MdDocument.codeBlocks`, at any depth once #204 merges;
  - the preamble walk `declaredKind` (`packages/crossvalidate/src/md-mermaid.ts:47` when written), which plan
    0214 moved to eess-mermaid as `diagramKind` (`packages/mermaid/src/parser/diagram-kind.ts:10`);
  - the optional-peer precedent: eess-ts `graphql`, `packages/ts/package.json:112`;
  - `.expectEmpty()` (`packages/core/src/cardinality.ts:37`);
  - the bounded-instrument precedent (`packages/ts/src/core/disk-set.ts`);
  - `dedupeConfigFindings` in `@nielspeter/eess/internal`.
- _Genuinely new:_
  - a code-block rule surface in eess-md (none in `packages/md/src/builders/`);
  - an async step before a rule (no rule surface in the family is async);
  - a worker thread (none in `packages/*/src`).
- _Not a consumer:_ `scripts/check-docs-code.mjs` type-checks TypeScript fences across files, which a
  per-block parse cannot express. Do not cite it as one, and do not promise to migrate it.

**Placement, decided.**

- eess-md owns the loop and the parser port's type.
- eess-mermaid ships one parser behind optional peers `mermaid` and `jsdom`, and loads neither
  statically. It matches the port by shape, without importing eess-md.
- The test that the real parser fits the port lives in eess-crossvalidate, which already depends on
  both.
- Nothing moves to the kernel: one consumer does not justify a seam every dialect would carry.
- No JSON or YAML parser ships; only the Mermaid parser has a consumer.

**Conditions the plans must meet.** Each is tagged:

- _measured_: a reviewer or the spike ran it;
- _ruled_: argued from the ADRs or from order, with nothing run.

1. **Facts, then a synchronous rule** _(ruled: ADR-010, ADR-013)_.
   - An async call parses one language's blocks in one batch and returns a fact object.
   - The builder is constructed from that object, so the element set is the parsed set and
     predicates can only narrow it. The adopter's only extra token is one `await`.
   - No rule surface becomes async; a later plan that wants an async `check()` needs an ADR.
   - `examined` counts the blocks of the language the corpus holds. A block with no verdict is an
     instrument finding, never a pass.
2. **The port takes a batch and names itself** _(ruled: ADR-007's batch-first boundary; measured
   input: about 400 ms per worker cold start, architect)_.
   - The port is `{ name, version, parse(texts) }`, and `parse` may return results or a promise of
     them, so a synchronous parser needs no ceremony.
   - A parser with no identity is a configuration finding.
   - The success line names the parser: "N mermaid blocks parse with mermaid 11.17.2", never
     "render".
   - The Mermaid parser reads its version from `mermaid`'s own `package.json`.
3. **Three outcomes, classified by error shape** _(measured: spike 0411; 15 further kinds plus the
   spike's own 4, enforcement)_.
   - The outcomes are `valid`; `invalid`, with message, line where known, and remedy; and
     `unrecognised`, with remedy.
   - The Mermaid parser classifies a thrown `Error` carrying `hash` and a `MermaidParseError` as
     `invalid`, an `UnknownDiagramError` as `unrecognised`, and anything else as the instrument.
   - The **class** is never read from the message. The **line** may be: the Langium kinds carry it
     only in the message text (`line 2, column 9`). A line that cannot be read is reported as
     unknown, not guessed.
   - A resolved value that is not a parse result (what `suppressErrors` returns) is the instrument,
     not `valid`.
4. **A forged verdict is caught where it can be** _(ruled; the forgery is shown by construction,
   enforcement)_.
   - A parser that answers `valid` to everything makes every block green under a real denominator.
   - Plan A's only defence is condition 2's identity check: a stub with an identity passes.
   - Plan B's Mermaid parser parses one known-broken canary per error shape before the batch;
     accepting its own canary is an instrument finding.
   - The residual is stated: a caller who forges both identity and canaries can still lie to
     themselves.
5. **The instrument fails once, loudly** _(measured: worker exit, Node exits 13 naming nothing, and a
   parse that hangs, enforcement; missing peer, `ERR_MODULE_NOT_FOUND`, enforcement; the rest ruled:
   ADR-009, ADR-016)_.
   - Each of these is one unsuppressable finding per run, naming its cause, with a remedy that
     clears it:
     - a missing peer, with its install command;
     - a worker that exits without a result, naming the block in flight;
     - a batch past its time budget, naming the block in flight;
     - a parser version outside the declared range;
     - any thrown error that is not a parse error.
   - The budget is set from measurement. Three figures exist for 39 blocks:
     - 588 ms, the spike, repeated harness blocks;
     - 0.99 s, the architect, the same blocks without the regex;
     - 0.78 s, the 2026-10-12 review, this repository's blocks with fixtures.
   - The worker is terminated on every path.
   - "Once" needs a constant dedupe key when several rules read one failed fact object, which is
     ADR-016 C3's trap. A script gate that does not go through eess-ts's `check-all` must call
     `dedupeConfigFindings` itself.
6. **`unrecognised` is not the author's syntax error** _(measured: empty, directive-only,
   comment-only, misspelt and `zenuml` all throw `UnknownDiagramError`, enforcement and architect)_.
   - Empty, directive-only and comment-only blocks are told apart by the preamble walk.
   - A misspelt kind and a kind not in core share one remedy naming both causes: check the spelling,
     or the kind needs a newer `mermaid` or a plugin.
   - There is no list of kinds, so OQ4 is untouched.
7. **The Markdown line** _(measured: frontmatter makes an error on body line 5 read "line 3",
   architect)_.
   - The parser returns the line counted from the block body, recovered past frontmatter, directives
     and blank lines by the same preamble walk.
   - So plan 0214's move comes first, or plan B takes it over; there is no third copy.
   - eess-md adds the block's own line.
8. **The worker is self-contained** _(ruled: ADR-015 teaches `.js` → `.ts` to the host resolver
   only; host globals measured clean in a plain host, spike)_.
   - It imports only Node built-ins, `mermaid` and `jsdom`; no relative imports.
   - Its first test runs it under vitest, asserting the host's globals before and after, and once
     through the eess-ts CLI loader. If that test fails, the feature does not ship.
9. **Empty, in order** _(ruled: ADR-010; `.expectEmpty()` is the sanctioned opt-out)_.
   - No Markdown file loaded outranks everything, `.expectEmpty()` included.
   - Any finding passes through.
   - No block of the language in loaded files is the zero-examined configuration finding, unless
     `.expectEmpty()` is declared.
10. **The language tag** is matched exactly as `mermaid` _(ruled; superseded 2026-10-15 — see the note at the end)_. A near-miss tag is disclosed as
    unread beside the count (ADR-016 rule 7). _(Note, 2026-10-15: bug 0423's fix made eess-crossvalidate's
    md-mermaid read the tag case-insensitively, so a fence tagged `Mermaid` is read there while eess-md's
    `parseCodeBlocks` reports it as unread. Neither is a false green, but the family has two rules for one
    tag. Settled at plan 0413's freeze, 2026-10-15: case-insensitive, family-wide; eess-md's side is
    [bug 0426](../bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md).)_
11. **Tier 1, static** _(measured, enforcement)_. The claim is "parses with mermaid X.Y.Z".
    `parse()` accepts three things that fail at render: a `gantt` task dated `nonsense`, a `journey`
    step with a non-numeric score, and an unclosed `mindmap` root.
12. **Two checks may judge one `classDiagram` block, on purpose** _(ruled)_. Each names its own
    parser. Bug 0409 is fixed before or with plan B. Otherwise md-mermaid tells an author to fix
    syntax that Mermaid accepts.
13. **A block that is broken on purpose** _(ruled: ADR-018)_, such as an example in a README, is
    kept out by glob or `.excluding()`. Never by a skip comment, which would be a second exclusion
    mechanism.

**The two plans, in order.** Both come after PR #204 merges.

- **Plan A, eess-md:** the code-block parse primitive. It owns the loop, the language selector, the
  port type, and conditions 1, 2 (the port, the identity check and the success line), 4 (the
  identity defence), 5 (for any parser: budget, a block with no verdict, a thrown parse, dedupe),
  9, 10 and 13. It is tested with stub and in-test parsers, and is useful without Mermaid. Additive,
  eess-md `minor`. Plan A also writes condition 1's invariant where an author of an async surface
  will find it: one sentence beside ADR-015's loader row.
- **Plan B, eess-mermaid:** the worker-isolated parser behind optional peers. It owns conditions 2
  (the version read), 3, 4 (the canaries), 5 (the worker's own causes: missing peer, exit, version
  range), 6, 7, 8, 11 and 12, plus the conformance test in crossvalidate and the dogfood row.
  - It comes after bug 0409 and plan 0214, or takes 0214 over.
  - Additive, eess-mermaid `minor`; crossvalidate moves with 0409.
  - Its README shows the full install line and the cost: the `npm i mermaid@11 jsdom` tree is about
    180 MB on disk (`du`, spike install), of which `mermaid` is 84 MB and `jsdom` 9 MB.

**Non-vacuity rows owed**, one per break class:

| row                                                                                     | plan |
| --------------------------------------------------------------------------------------- | ---- |
| zero blocks without `.expectEmpty()`; no Markdown loaded                                | A    |
| a parser with no identity                                                               | A    |
| a parser that hangs (budget); a parser that throws; a batch that drops a block          | A    |
| a near-miss language tag disclosed _(superseded 2026-10-15: bug 0426)_                  | A    |
| a syntax error at the exact Markdown line, plus frontmatter, directive, blank-lead rows | B    |
| the false red: a labelled flowchart passes in the worker                                | B    |
| a missing peer; a worker that exits early; a version out of range                       | B    |
| an always-valid stub fails on the canary                                                | B    |
| empty, directive-only, misspelt and `zenuml`, each with its own remedy                  | B    |

**Dogfood row** (plan B):

- Scope: this repository's `work/`, `adr/` and `docs/`. mdast counts 4 top-level `mermaid` blocks
  and 0 nested there (the count in PR #204's record; re-run by method review, 439 files).
- The break: a dangling `Route -->` in `docs/manifesto.md`'s `graph` block reds it.
- Fixture blocks that are broken on purpose stay out by glob (condition 13).

**Naming.**

- The API says "code block", as `MdCodeBlock` does.
- The result type is not called `ParseResult`, which the kernel already exports.
- The eess-mermaid export is distinct from `parseClassDiagram` (eess's own grammar), and its README
  says which parser is which.

**Corrections, kept:**

- **`.expectEmpty()`.** The 2026-10-12 review said the empty-corpus criterion "reads as a user opt-out
  the kernel deliberately does not offer". That was wrong: `.expectEmpty()` is that sanctioned opt-out.
  Condition 9 replaces both the criterion and that correction.
- **"Needs no list of kinds".** That review's claim holds only because condition 6 gives a misspelt
  kind and a not-in-core kind one remedy. Telling them apart would need a list.
- **Spike 0411.**
  - Its harness carried a message-matching classifier that its prose did not disclose.
  - It presented 39 repeated blocks as a corpus count.
  - Its Decision described a forgeable per-block parser.

  All three are corrected in the spike.

- **This record's first draft** said every condition was measured, carried "17 more kinds", and gave
  one timing as the cost. It also dropped:
  - the dedupe key;
  - the exclusion rule;
  - the Langium line;
  - the crash's block in flight;
  - sync parsers;
  - no built-in JSON/YAML parsers.

  It also left the rows unassigned to a plan. The method review found these, and this section is the
  corrected text.

### Disposition, Ask C (2026-10-14)

| ask                                | disposition  | owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C** — every Mermaid fence parses | **Accepted** | [plan 0412](../plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md) (A, eess-md: the loop, the port and the evidence), then [plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md) (B, eess-mermaid: Mermaid's own parser in a worker), against conditions 1–13 above. Plan 0412 is Done (built 2026-10-14); plan 0413 is Done (built 2026-10-16); the dogfood gate is plan 0427. Was `Held` until the plans were drafted after PR #204 merged |

### Amendment to conditions 2, 4, 5 and 10 — 2026-10-14, from the plans' review

Method and enforcement reviewed plans 0412 and 0413 against the conditions above. Each found the
same two defects, and both were in the conditions themselves, not only in the plans. The plans carry
the corrected text. This amendment records what changed, so the conditions above are read with it.

- **Condition 2, the port, was too narrow to carry condition 5.**
  - `{ name, version, parse(texts) }` passed no budget, no way to cancel and no progress back, and had
    no way to return a cause's remedy. So when eess-md stopped waiting, the worker kept the process
    alive, and the block in flight could not reach the finding.
  - The port is now `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`.
  - A parser may reject with a structured failure (`remedy`, `blockIndex`), which eess-md reads by
    shape.
  - A synchronous parser's overrun is detected after it returns. One that never returns is unbounded,
    and the docs say so.
- **Condition 4 claimed canaries a stub would never run.**
  - Canaries inside plan B's worker never see a stub the caller passes in, so "an always-valid stub
    fails on the canary" could not fire. The residual "forges both identity and canaries" described
    canaries that the caller did not supply.
  - The parser now **declares** its canaries, and **eess-md runs them** (plan A). A stub must then
    forge both, which makes the residual true.
  - Plan B's canary row becomes "a `mermaid` that stops throwing fails on the canaries". That was the
    break class the worker-side canaries really guarded.
  - The non-vacuity table above is corrected by this: the canary row moves to plan A, and plan B
    gains the rewritten row.
- **Condition 5, "once".** A constant `ruleId` alone does not collapse findings. The dedupe key is
  `file`, `ruleId` and `element`, and a per-block emission gives one finding per block. Plan A pins
  all three fields and emits once per rule from the fact object.
- **Condition 9's "any finding passes through"** now holds by construction. A parser with no identity
  or no canaries throws `ArchConfigError` from `parseCodeBlocks`, before anything is selected.
- **Condition 10.** What counts as a "near-miss" was not defined above. Plan A defines it as equal
  only when case-folded, and makes that its own decision. The zero-examined finding names a near-miss
  that caused it, so the author is sent to the spelling and not to `.expectEmpty()`.
- **Plan A's ADR-015 sentence moved to the docs.** It would have added a binding clause with no
  mechanism to an Accepted ADR that is about module resolution.
- **Correction, the install size.** "About 180 MB … (`du`, spike install)" is this review's own
  measurement. Spike 0411 records no disk figure. Plan B re-measures it.
- **Also added:**
  - a registry, so a hand-built fact object is refused;
  - validation of each verdict's line, message and remedy;
  - two plan A rows: an `invalid` verdict reds, and a malformed verdict reds as the instrument;
  - a production-tier row for plan B's dogfood gate.

### Note, 2026-10-15: the tag rule, and plan B's dogfood row

Plan 0413's freeze (PR #217) changed two things ruled above, on its own authority; either can be
overruled.

- **Condition 10's tag rule is now case-insensitive, family-wide.** eess-crossvalidate already read the
  tag that way (bugs 0423, 0424); [bug 0426](../bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md)
  brings `parseCodeBlocks` to the same rule and removes the near-miss disclosure. It was first
  recorded here and in that bug as a matching convention; after the architect review of the first freeze (PR #217) it is
  [ADR-019](../../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md).
- **Plan B's dogfood row ("Dogfood is not optional" above) moved, unchanged, to
  [plan 0427](../plans/0427-this-repository-checks-its-mermaid-blocks-parse.md)**, so the parser and the
  gate are each one reviewable PR. It is deferred, not dropped: plan 0413's ledger carries it as a
  `deferred→plan 0427` box, and 0427 depends on 0413.
