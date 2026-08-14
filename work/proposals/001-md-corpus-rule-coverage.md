# Proposal 001 — eess-md: Express a Corpus's Own Conventions

**State:** Draft — reviewed 2026-08-08 (architect · product · enforcement); the
design is rewritten against `terms()`, five decisions remain open. **Evidence
extended 2026-08-13** with the first in-repo instance of `agree()` (rule 13's
shape), so one capability here is fixturable without the reference corpus.
**Priority:** High
**Affects:** `terms()`/`vocabulary()`, `docs()`, `taskItems()`, `links()`,
`haveNameMatching`, `honestyAtClose()`, `adrEnforcement()`,
`correspondence()` (kernel), md rule files (no CLI)

## Problem

A consuming project cannot write rules for its own corpus conventions in the md
dialect. Attempting it produces a rules file that expresses a minority of what
the corpus already documents about itself in prose — so most conventions stay
unenforced, and unenforced conventions are exactly the ones that drift.

This is the dialect's own thesis failing on the dialect's own artifact type. The
ts dialect can express nearly any static claim about code. The md dialect can
express four claims about a corpus: a section exists, a table has columns, a link
resolves, a `path:line` pointer resolves. A working corpus makes many more claims
than that about itself.

## Evidence

Measured 2026-08-08 against **the reference corpus** — a live client corpus of
98 markdown files (91 items across four lanes) that has used eess-md in CI since
2026-07. It is not in this repo and is deliberately not named; every capability
below is specified against fixtures, so nothing here depends on access to it.

A rules file (`work.rules.ts`) was written to enforce the conventions that
corpus **already publishes about itself** in `work/README.md`, `BUGS.md` and
`REFINEMENT.md`. Of thirteen intended rules, **three were expressible**:

| #   | Rule the corpus documents about itself                            | Expressible?                           |
| --- | ----------------------------------------------------------------- | -------------------------------------- |
| 1   | bug records carry `Symptom` / root cause / `Fix` / `Verifikation` | ✅ `haveSection`                       |
| 2   | board rows' `Status` and `Oprindelse` cells stay in their enums   | ✅ `haveTableRowsSatisfying`           |
| 3   | a stakeholder-clarifications table has its five declared columns  | ✅ `haveTable`                         |
| 4   | every item carries `**State:**` from the neutral enum             | ⚠️ value yes, drift no                 |
| 5   | item filenames match `NNN-kebab.md`                               | ❌ predicate-only                      |
| 6   | referenced evidence files exist                                   | ❌ no builder for this reference shape |
| 7   | a non-terminal item is not silently stale                         | ❌ no temporal condition               |
| 8   | a redaction marker names its reason                               | ❌ no content condition                |
| 9   | every board row has a file, every file has a row                  | ⚠️ possible, undiscoverable            |
| 10  | every convention declares Tier / Mechanism / Status               | ❌ ADR-shaped only                     |
| 11  | a story is `promoted` only with all four gate boxes checked       | ❌ no conditional                      |
| 12  | a support case of `Type: Bug` links to a `BUG-NNN`                | ❌ no conditional                      |
| 13  | a plan's `State:` agrees with its ROADMAP row                     | ❌ existence only                      |

The three that shipped found **62 real violations** on first run, so the gate
works; the coverage is the problem, not the engine.

**What the ten blocked rules cost, measured in the same corpus:**

- **(4)** `**State:**` has silently split into two spellings — 32 files use
  `State:`, 49 use `Status:`, zero overlap. `STATE_TOKEN_LINE_RE` in
  `rules/ledger.ts` is a literal `State`, so `placementViolation` returns `null`
  for 49 of 91 items: **over half the corpus gets no state↔folder check.** No
  violation exists today, so the invariant is held by discipline alone. The
  enum check itself is expressible — see the correction below — but nothing can
  report _which spelling_ drifted, which is the half that matters here.
- **(6)** Four evidence paths in one bug record point at
  files that have never existed. They survive every gate because they are
  written as inline code — `` `support/mails/….eml` `` — which is neither a
  markdown link (so `links()` cannot see it) nor a `path.ext:line` pointer
  (`POINTER_RE` requires a `CODE_EXT` extension **and** a `:line` suffix). A
  whole reference shape has no rule.
- **(7)** A drafted customer mail in `support/` has read
  `State: Draft — ready to send` since 2026-05-22. Two customer assumptions
  depend on that mail having been sent. Nothing notices.
- **(9)** `BUGS.md` states its own counts are "**counted**, not projected" and
  the corpus filed a bug against itself for not enforcing them.
- **(10)** `work/README.md` publishes five conventions; **one** names a
  mechanism. Seven documented conventions in that corpus had drifted unnoticed
  by the time of measurement.
- **(11)** The promotion gate is the `refinement/` lane's entire contract with
  `plans/`. Measured: `f1` 2/4, `f2` 1/4, `f4` 0/4, `f5` 2/4, `f7` 2/4 — all
  `refining`, all consistent, all held by hand. The valuable direction is the
  inverse: nothing notices a story sitting at **4/4 that was never promoted**.
- **(12)** `SUPPORT.md` publishes: _a support case of `Type: Bug` links to a
  `BUG-NNN`._ One live violation — a delivered case is `Type: Bug` and links to
  no defect record.
- **(13)** Every plan's `State:` agrees with its ROADMAP row today, but through
  a **mapping**, not equality: `Draft`↔`Udkast`, `Done`↔`✅`, `Won't-do`↔`🚫`.
  `correspondence()` offers `beComplete()` and `preserveRelations()` — existence
  and structure — so a plan closed in its file while its board row still reads
  `Udkast` is invisible to every gate.

Rules 11–13 are one shape: **a condition that applies only when another value
holds.** Three of four lanes need it, and the bug lane hid it because
`honestyAtClose` already hard-codes the single conditional bugs require
(terminal token → done-folder). Generalising that special case is the largest
capability in this proposal.

Section vocabulary shows the same drift the field builder would catch:
`Root cause` ×21 vs `Rod-årsag` ×8, `Fix` ×38 vs `Rettelse` ×11, plus
`Konsekvens` ×16 — a section 16 records need that the published template does
not define.

### This repo, measured 2026-08-13 — rule 13's shape, dogfooded

Everything above is measured in the reference corpus, which is not in this repo
and cannot be named. That is this section's structural weakness: a reader here
can check none of it. The instance below is the first one for
[`correspondence().agree()`](#correspondenceagree--value-not-just-existence)
that lives in **this** corpus, so it can be verified, fixtured, and gated
without access to anything external.

**The corruption.** Two live plans fence off this proposal by name as out of
scope — [`0089`](../plans/0089-family-standalone-sufficiency.md) and
[`0101`](../plans/0101-sibling-gates-go-fail-closed.md) both read "_md adopting
`terms()`/`vocabulary()` (proposal 001) … new surface is a proposal_". Both are
**correct today**, because 001 is unbuilt. The day 001 is ruled `Ship as-is` and
becomes a plan, both clauses are false, and nothing notices:

- They were written as **bare prose** (`(proposal 001)`), so `links()` never saw
  them — the same invisibility class as evidence item (6)'s inline-code file
  refs, one reference shape over. _Corrected 2026-08-13: both sites are now
  markdown links, so `check:corpus` resolves them._
- **Resolution is not agreement.** A link proves 001 exists; it says nothing
  about whether the claim _"this is out of scope because 001 is unbuilt"_ is
  still true. That is exactly rule 13's gap — `beComplete()` and
  `preserveRelations()` prove existence and structure, never value.
- `check:ledger` does not read the proposals lane at all
  ([bug 0121](../bugs/fixed/0121-ledger-reads-two-of-four-lanes.md)), so no lane
  mechanism reaches it from the other end either.

**Why it is rule 13's shape and not a new one.** A plan's out-of-scope clause is
a claim about another document's state, expressed in different vocabulary from
the state itself — precisely the board↔item mapping rule 13 describes.
[`PROPOSALS.md`](./PROPOSALS.md) now publishes the vocabulary that makes it
projectable: `State` (`Draft | Reviewed`) and a terminal `Ruling`
(`Ship as-is | … | Reject`). So both sides have a comparable value and need a
`normalize` to meet: `Ship as-is`/`Ship with changes` normalise to _accepted_,
everything else to _not yet_.

**Break class.** A plan cites a proposal as out of scope while that proposal's
`Ruling` reads `Ship as-is` or `Ship with changes` → **red**, naming the plan's
line and the proposal's ruling line. Corruption that must produce it: flip 001's
Ruling to `Ship as-is` and leave 0089 and 0101 untouched. The inverse direction
is deliberately **not** a violation — a plan may cite a declined proposal for
context, as [003](./003-future-dialect-candidates.md) and
[004](./004-corpus-content-explain.md) both do.

**What the violation must say.** Both sides, both lines — per this section's own
two-sided rule. `plan 0089:176 excludes "proposal 001" as future surface, but
001's Ruling is "Ship as-is"` sends the author to reconcile the clause. A
one-sided `"proposal 001" has no matching ruling` would send them to add a
ruling that already exists.

**Non-vacuity sketch.** A fixture pair under `scripts/nonvacuity/`: a proposal
whose `Ruling` row reads `Ship as-is`, and a plan whose out-of-scope list cites
it. The gate must exit 1 naming `corpus/out-of-scope-cites-accepted-proposal`;
flipping the ruling to `Reject` must return it to green, so both directions are
proven.

**Honest weight.** n=2, both in `Draft` plans, and nothing is mis-stated today —
this is **not** a demand signal by the bar this proposal sets for itself, and it
does not on its own justify `agree()`. Its value is different and specific: it is
the one instance of this capability that this repo can hold a red fixture for.
Evidence items (4)–(13) can only ever be asserted here.

## Proposed API

```ts
import { corpus, docs, fileRefs, terms, vocabulary } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/**'], frozen: ['**/completed/**'] })

// 4a — presence is document-scoped (a missing field yields no element to fail on)
docs(c)
  .that()
  .resideInFolder('work/**')
  .should()
  .haveField('State')
  .because('a corpus with two spellings for one field has half a gate')
  .check()

// 4b — value is element-scoped, so the violation carries the field's own line
terms(c, { label: /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?/, region: 'header' })
  .that()
  .resideInFile('work/**')
  .should()
  .resolveAgainst(vocabulary(c, { terms: ['Draft', 'Ready', 'Open', 'Done', "Won't-do"] }))
  .check()

// 5 — naming as an assertion, not only a filter
docs(c)
  .that()
  .resideInFolder('work/bugs/**')
  .should()
  .haveNameMatching(/^\d{3}-[a-z0-9æøå-]+\.md$/)
  .check()

// 6 — the third reference shape: inline-code repo-relative paths
fileRefs(c)
  .that()
  .areInternal()
  .should()
  .resolve()
  .because('a path to a file that never existed is worse than no pointer')
  .check()

// 7 — freshness (see Open Questions: narrowing this to non-terminal items
// requires predicating one field on another in the same document)
terms(c, { label: /^\s*(?:[-*]\s+)?(?:\*\*)?Updated:?(?:\*\*)?/, region: 'header' })
  .that()
  .resideInFile('work/**')
  .should()
  .beFresherThan('90d') // grammar unsettled — see Open Questions
  .warn()

// 8 — content conditions
docs(c)
  .that()
  .haveContentMatching(/_\[…er fjernet/)
  .should()
  .haveContentMatching(/_\[…er fjernet: [^\]]+\]_/)
  .because(
    'an agent that cannot tell "nothing was said" from "something was removed" fills the gap with a guess',
  )
  .check()

// 11 — conditional: a promoted story has passed every gate box
docs(c)
  .that()
  .resideInFolder('work/refinement/**')
  .and()
  .haveField('Status', 'promoted')
  .should()
  .haveAllTaskItemsChecked({ section: /^Promotion-gate/ })
  .because('the four-box gate is the only thing keeping Figma churn out of plans/')
  .check()

// …and the inverse, which is the one that actually catches drift
docs(c)
  .that()
  .resideInFolder('work/refinement/**')
  .and()
  .haveAllTaskItemsChecked({ section: /^Promotion-gate/ })
  .should()
  .haveField('Status', 'promoted')
  .warn()

// 12 — conditional across a link
docs(c)
  .that()
  .resideInFolder('work/support/**')
  .and()
  .haveField('Type', 'Bug')
  .should()
  .haveLinkMatching(/\.\.\/bugs\/.*\.md/)
  .because('a customer case of type Bug with no defect record is an investigation nobody opened')
  .check()

// 13 — board and file must agree in value, not merely both exist
correspondence({
  left: rows(c, { section: /Roadmap/, columns: { plan: /^Plan$/, status: /^Status$/ } }).select({
    label: 'ROADMAP row',
    identify: (r) => ({ name: r.get('plan'), file: r.doc.relPath, line: r.line }),
  }),
  right: terms(c, { label: /^\s*(?:\*\*)?State:?(?:\*\*)?/, region: 'header' })
    .that()
    .resideInFile('work/plans/**')
    .select({
      label: 'plan State',
      identify: (t) => ({ name: t.doc.relPath, file: t.doc.relPath, line: t.line }),
    }),
  keyBy: { left: (r) => planId(r.get('plan')), right: (t) => planId(t.doc.relPath) },
})
  .should()
  .beComplete({ direction: 'both' })
  .andShould()
  .agree({
    left: (r) => r.get('status'),
    right: (t) => t.value,
    // the board summarises in local prose, the item carries the neutral token;
    // `normalize` brings both to one form before comparing (see Open Questions)
    normalize: { left: boardToken, right: (v) => v },
  })
  .check()
```

## Design: Elements the Dialect Does Not Model

**Recommended approach:** md models six element types — document, link,
pointer, table row, task item, and **vocabulary term**. Two of the blocked rules
are blocked because an element type is genuinely missing (the **inline-code file
reference**); the rest are blocked because existing element types are
**under-equipped** — they carry the right elements but expose predicates where a
condition is needed, or drop the one field a violation must name. Extend them
in place, following the existing `model/ → predicates/ → conditions/ → builders/`
layering; add a new element type only where none fits.

**Why this layering wins:**

- `RuleBuilder` already supplies `.that()`, `.should()`, `.satisfy()`,
  `.because()`, `.excluding()`, `.check()`, `.warn()`, `.select()` — a new
  element type inherits the whole surface for the cost of a `getElements()` and
  a handful of predicates and conditions.
- `.select()` means each new element type is immediately usable as one side of
  a kernel `correspondence()` with no extra work.
- `rules/ledger.ts` already computes the header region (`headerRegion()`), and
  `vocabulary.ts` already blanks fenced code line-preserving. A finished term
  element reuses both, and `honestyAtClose` can then be reimplemented on top of
  the builder rather than carrying its own hard-coded regex for one field name.

**Alternative rejected:** adding more conditions to `DocsRuleBuilder`
(`haveStateOneOf`, `haveFreshField`, …). This keeps the document as the only
element, so violations report at document granularity — the field's own line is
lost, and the rules are not composable with `correspondence()`. It also repeats
the mistake `ledger.ts` already shows: one hard-coded regex per field name.

### The header field — finish `terms()`, don't add `fields()`

> **Correction to this proposal's second draft.** This section proposed a new
> `fields()` element type. The labelled-value line is **already** a first-class
> element: `terms()` / `MdTerm` (`packages/md/src/builders/vocabulary.ts:180`,
> exported from the package index). `MdTerm { value, raw, doc, line }` is the
> proposed `MdField` minus `name`/`rawName`. Worse for the draft: its headline
> finding — the unbolded, `·`-separated third syntax — **already works**. The
> default extractor at `vocabulary.ts:103-107` strips `*`/`_`/backticks and then
> does `.replace(/\s+[·—–|].*$/, '')`, so `- Status: refining · Readiness: 🟡`
> yields `refining` today, unchanged. The draft cited "vocabulary terms" in
> passing and still described the element as unmodelled. Recorded rather than
> silently rewritten: **the survey is the step, and citing a thing is not
> surveying it.**

`terms(c, { label })` already yields the element, blanks fenced code
line-preservingly (`vocabulary.ts:96-100`), scopes with `resideInFile(glob)`,
and checks an enum via `resolveAgainst(vocabulary(c, { terms: [...] }))` — which
is `beOneOf` under another name. Evidence rule 4's enum half is expressible
today:

```ts
const states = vocabulary(c, { terms: ['Draft', 'Ready', 'Open', 'Done', "Won't-do"] })
terms(c, { label: /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?/ })
  .that()
  .resideInFile('work/**')
  .should()
  .resolveAgainst(states)
  .check()
```

Four things are genuinely missing, and each is an extension to an existing
element rather than a new one:

1. **The matched label is not carried.** `MdTerm` has `value`/`raw` but not the
   label the selector matched, so "found `Status:` where `State:` was required"
   cannot be reported. This is the proposal's strongest measured finding (49
   files) and it is one field on one interface — see the new open question
   below, because _matching_ a drifted spelling needs an API decision, not just
   a field.
2. **Region scoping — and frontmatter is already being read.** `terms()` scans
   the whole document **as text lines**, not as an AST walk, so it already picks
   up YAML frontmatter today — silently, and indistinguishably from a body
   field. Verified 2026-08-09 against a fixture carrying both: a `State:` in
   frontmatter and a `**State:**` in the header yield **two** terms, and nothing
   says which came from where. A `region: 'header' | 'frontmatter' | 'document'`
   option makes the source explicit; `'header'` confines to the region before
   the first `##`, which `headerRegion()` in `rules/ledger.ts:70` already
   computes. This costs no new dependency and no new extractor — and it is what
   turns the precedence question below from theoretical into enforceable, since
   a rule cannot express "frontmatter wins" without naming the two sources.
3. **Blockquote exclusion.** `stripFencedCode` blanks _fences only_. A
   blockquoted `> **State:** Done` is skipped today only because the `^` anchor
   fails on `>` — incidental, not designed, and an mdast-based extractor would
   silently lose it. Reuse the explicit `inBlockquote` walk in
   `model/task-items.ts:37-46`, which is tested against a fixture.
4. **`beFresherThan(duration)`** — see below.

> **Caveat on frontmatter, and a prerequisite.** Reading it is free; the _AST_ is
> wrong about it. The corpus parses with GFM extensions only
> (`packages/md/src/corpus.ts:95-98`) and no frontmatter extension, so the
> closing `---` turns the last frontmatter line into a **setext heading**. The
> fixture above is reported by `docs()` as having a depth-2 section named
> `"State: Ready\ntitle: A doc"` — a phantom section at line 2. `haveSection`
> and every `sectionPath` are distorted on any frontmatter-bearing document
> today. Filed as
> [bug 0087](../bugs/0087-frontmatter-parsed-as-setext-heading.md); the
> `region: 'frontmatter'` option should land on top of a parser that models
> frontmatter, not beside one that mis-parses it.

**Presence is document-scoped and cannot live here.** `.should().bePresent()` on
a term/field builder is vacuously green by construction: a document carrying only
`Status:` yields _zero_ elements, and a rule over an empty element set has
nothing to fail. Absence belongs on the container, which is why `haveSection`
and `haveTable` are `Condition<MdDocument>`. Use the `haveField` condition on
`docs()` proposed below; keep value-level conditions (`beOneOf`, `matchValue`,
`beFresherThan`) on the element, where the violation carries the line.

This still subsumes the hard-coded `STATE_TOKEN_LINE_RE` / `DONE_STATE_RE` pair,
and `honestyAtClose` should still take the state field's **name and enum as
options** rather than hard-coding `State`. `scripts/check-ledger.mjs:33` in this
repo currently duplicates `DONE_STATE_RE` verbatim just to compute a
denominator; a finished term element deletes that duplication.

### `fileRefs()` — the third reference shape

Extracted from mdast `inlineCode` nodes (so fenced blocks are excluded for
free), matching content that looks like a repo-relative path: contains `/`, has
an extension, no whitespace. Deliberately **not** a loosened `POINTER_RE` — that
would false-positive on prose in backticks.

Because the shape is heuristic, `fileRefs()` must take an opt-in scope
(`fileRefs(c, { within: 'work/**' })`) and support `.excluding()`. Absent an
explicit scope it should match nothing rather than guess.

### Temporal conditions

`beFresherThan('90d', { field })` parses a date from a named field and compares
against a **caller-supplied clock** (`corpus({ now })`, defaulting to
`Date.now()`), so rule runs stay reproducible in tests and snapshots.

Applies to items; the harder and more valuable case is **rule** staleness — a
rule that has never fired is either a perfectly-held invariant or a dead rule
guarding deleted code, and both are green forever. That needs CLI support and
is deferred to its own proposal.

### `clauseEnforcement()` — unbind the tier table from the ADR shape

`adrEnforcement` binds `## Håndhævelse` tables to rule ids, but only for ADRs.
`work/README.md` is also a spec document and its conventions carry no
declarations at all. Generalise: any document may declare clauses with
Tier / Mechanism / Status, and the gate fails on a **missing declaration**,
which is the framework's core move currently available to one artifact type.

### Already present, undiscoverable: `correspondence()`

Rule 9 (board ↔ files) needs no new capability. `correspondence()` in the kernel
provides `beComplete({ direction: 'both' })` with per-side `keyBy`, and
`rows()`'s docstring names this as its primary purpose. It was found only by
reading kernel source; no md doc or example shows an md↔md binding. This is a
**documentation and example gap**, not a missing feature — see below.

### Conditional rules — generalising what `honestyAtClose` hard-codes

Rules 11–13 all read _"when this value holds, that must also hold"_. The dialect
has exactly one such rule today and it is baked in: `placementViolation` pairs a
terminal `State:` token with a done-folder. Every other lane needs its own pair.

No new syntax is required — the builder already separates phases. What is
missing is that **`.that()` cannot see fields, task items, or links**, so the
antecedent of a conditional has nowhere to come from:

```ts
docs(c)
  .that()
  .haveField('Status', 'promoted') // ← antecedent (new predicates)
  .should()
  .haveAllTaskItemsChecked({ section }) // ← consequent (new conditions)
```

Adding `haveField` / `haveAllTaskItemsChecked` / `haveLinkMatching` as
**dual-use** methods on `docs()` yields conditionals for free in both
directions, which matters: the inverse form (`4/4 boxes ⇒ Status: promoted`) is
the one that catches real drift, since a story is far likelier to be finished
and left in place than promoted prematurely.

This is deliberately _document_-scoped rather than a general cross-element join.
A join engine already exists for the cross-document case — `correspondence()` —
and duplicating it inside one document would be the parallel hierarchy this
proposal's own **Alternative rejected** section warns against.

> **Correction to this proposal's second draft.** Having named that failure mode
> here, the draft then committed it twice: `fields()` beside the existing
> `terms()`, and an inline `via` map beside the existing `vocabulary()`. Both
> are corrected above. Recorded rather than silently fixed, because the pattern
> is the interesting part — **naming a failure mode is not the same as being
> immune to it**, and the two instances are separated from this warning by four
> and ten paragraphs respectively. The defence is the survey, not the author's
> vigilance.

The dual-use methods also resolve the open question left by the freshness
example: _"a non-terminal item must not go stale"_ is a conditional
(`.that().haveField('State', notTerminal).should().beFresherThan('90d')`), not
a missing capability of the field element.

### `correspondence().agree()` — value, not just existence

`beComplete()` proves both sides have counterparts; nothing proves the
counterparts **say the same thing**. Rule 13 needs the latter, and needs it
through a mapping, because a board summarising in local prose and an item
carrying a neutral token are _correctly_ different strings for the same state.

```
.andShould().agree({ left, right, normalize })
```

`left`/`right` project each side to a comparable value; `normalize` brings both
projections to one form before comparing. Omitting it means strict equality.
Violations must name **both** sides with both lines — a one-sided message sends
the reader to fix whichever end they happened to open.

**Functions, not a table.** An earlier draft proposed `via: Record<string,
RegExp>`, mapping each canonical value to a matcher for the other side's
dialect. Rejected: every other `correspondence()` parameter is a function
(`keyBy`, `matchBy`, `RelationSpec.left`/`right`, `suggest`), a record would be
the kernel's first declarative normalisation table, and md already names this
concept at the dialect layer (`Vocabulary.normalize`). A normaliser is also
strictly more general — it handles case, whitespace and emoji-stripping, not
only enumerated synonyms — and it dissolves the "unmapped value" violation class
the table needed. If the record form is wanted for ergonomics, it ships in md as
sugar that _builds_ the projection, not in the kernel.

**Prerequisite — a kernel bug in the primitive this sits beside.**
`preserveRelations({ direction: 'right-to-left' })` silently checks nothing:
`relations()` in `packages/core/src/correspondence.ts:212` guards the left→right
loop and there is no right→left block, so the function returns `[]`. Compare
`completeness()` in the same file, which has both guards — so `beComplete` is
correct and `preserveRelations` is half-implemented. A green gate that inspects
nothing, in the kernel, in the primitive `agree()` will copy its `direction`
shape from. Filed as [bug 0084](../bugs/0084-preserve-relations-right-to-left.md)
and **blocking this capability**; the two-sided-message fix belongs with it,
since `relations()` today emits only the left side's file and line.

This is the md↔md instance of what `eess-crossvalidate` does between dialects,
and the same primitive that binds ADR clauses to rule ids: a board is a spec,
and the item is its implementation.

### Predicate/condition symmetry

`haveNameMatching` is predicate-only in md; ts exposes a `Condition` form in
three places. The dual-use phase dispatch already used by `docs().haveSection()`
should be applied to `haveNameMatching`, and adopted as the default for any
method that reads sensibly in both phases.

## Performance Considerations

`terms()` and `fileRefs()` walk material each document already parses —
`terms({ region: 'header' })` reads only the header region, `fileRefs()` visits `inlineCode` nodes
from the existing mdast root. No new file I/O; expected cost is a small constant
per document, negligible beside the markdown parse already performed. Extraction
should be memoised per document alongside the existing pointer extraction.

## Error Handling

- A field whose value cannot be parsed as a date under `beFresherThan` is a
  violation naming the field and the unparsed value — never a silent skip.
- `fileRefs()` without a `within` scope matches nothing and emits a warning
  naming the option, rather than scanning the whole corpus heuristically.
- `beOneOf` violations must quote the **actual** value and its `rawName`, so a
  spelling drift (`Status` where `State` was required) reports as a spelling
  drift rather than as an absent field.
- Violations must carry the element's own line. `haveTableRowsSatisfying`
  currently reports at the table header with a row **index** ("row 27") though
  `MdRow` carries `line`; new element types must not repeat this.

## Alternatives Considered

- **Per-corpus bespoke scripts.** What the consuming project does today —
  `tools/ledger-check.ts` and `tools/eess-check.ts` are ~200 lines of wrapper.
  It works, and it is exactly the "~170 lines every repo reinvents" that the
  eess family exists to replace.
- **A preset per convention** (`corpusHygiene()`), skipping the builders.
  Faster to ship, but presets bake in one corpus's vocabulary. The reference corpus
  is Danish, four-lane, and uses `Rod-årsag` and `Rettelse`; a preset built for
  it would not fit the next corpus. Builders first, presets on top.
- **Frontmatter instead of header fields.** Would make the header extractor
  unnecessary — YAML parses for free. Rejected as a **requirement**: the corpus
  deliberately uses neutral-token-plus-local-prose (`**State:** Done — shipped
in PR #47`), and a dialect that only reads frontmatter cannot gate the corpora
  that exist today. Not rejected as a **source** — and it turns out not to be a
  choice at all: the text-line extractor already reads frontmatter (see the
  Design section). The live question is not whether to support it but how to
  tell the two sources apart, which is why it is now a `region` value and a
  ruling rather than a feature.

## Documentation

### `docs/` — an md-dialect corpus guide

There is no worked example of eess-md governing a real corpus. Add one built
from the ten rules above, showing which element type answers which convention.

### `docs/` — `correspondence()` for md↔md

Show the board↔files binding end to end. `rows().select()` and `docs().select()`
both exist; nothing demonstrates joining them, which is why rule 9 read as
missing rather than as available.

### `README.md` — dialect capability table

The md row should list its element types (document, field, link, pointer,
fileRef, table row, term) so a reader can tell what is expressible before
writing a rules file.

### `CHANGELOG.md`

Under `### Added`:

- `terms()` gains the matched label on `MdTerm`, a
  `region: 'header' | 'frontmatter' | 'document'` option, a designed blockquote
  guard, and `matchValue` / `beFresherThan`. (No new element type — see the
  Design correction. `region` does not _add_ frontmatter reading, which already
  happens; it makes the source nameable, and therefore rulable.)
- `haveField(name, value?)` — dual-use on `docs()`; the presence half, which
  cannot live on an element builder.
- `fileRefs()` — inline-code repo-relative path references, scoped and resolvable.
- `haveNameMatching` as a condition (dual-use) on `docs()`.
- `haveContentMatching` on `docs()`.
- `haveField` / `haveAllTaskItemsChecked` / `haveLinkMatching` — dual-use on
  `docs()`, giving conditional rules in both directions.
- `correspondence().agree({ left, right, normalize })` — counterparts must say
  the same thing, with optional per-side normalisation.
- `clauseEnforcement()` — tier tables outside the ADR shape.

Under `### Changed`:

- `honestyAtClose` takes the state field's name and enum as options instead of
  hard-coding `State`. **Additive** — the defaults stay `State` and the current
  five-token enum, so existing callers are unaffected (see Open Questions).
- `CorpusOptions` gains an optional `now: () => number` clock, defaulting to
  `Date.now`, so temporal rules are reproducible in tests and snapshots.

## Acceptance Criteria

This proposal ships eight new ways to fail a build (count them in the CHANGELOG
section, not in the Scope sequencing — that list is capabilities, not failure
modes). A gate whose red has never
been watched is not evidence, so every capability below carries its **break
class** — the specific corruption that must produce a violation, and what the
violation must _say_. Colour alone is not the proof; attribution is.

> **Correction to this proposal's first draft.** It had no acceptance criteria
> and **no non-vacuity criteria at all** — it specified six new gates without
> specifying how to prove any of them could go red. That is the same defect the
> proposal is about, committed in the proposal itself: a specification asserting
> what _should_ hold with nothing that fails when it doesn't. It is also the
> defect this project exists to prevent, and it survived a full draft unnoticed,
> which is the honest measure of how quietly it happens. Recorded rather than
> silently fixed, so the omission is not repeated by the next proposal — and as
> evidence that "write the break class" belongs in the proposal template, not in
> the author's memory.

- [ ] **`haveField` — absence.** A document in scope with no matching field goes
      **red**, naming the document and the expected field name. Asserted on
      `docs()`, not on the element builder: a rule over zero elements has
      nothing to fail, so a field-scoped `bePresent()` is green on exactly the
      corpus it was written to catch.
- [ ] **Field value — spelling drift.** A document carrying `**Status:** open`
      where `**State:**` is required goes **red** _naming the found spelling_.
      Reporting it as an absent field is a failure of this criterion: the
      corpus that motivated this proposal has 49 such files, and "field missing"
      would send an author to add a second field rather than rename the first.
- [ ] **Field value — off-enum.** `**State:** Implemented` goes **red**
      quoting the actual value and listing the permitted set.
- [ ] **Frontmatter — the source is nameable.** A document whose `State` lives
      **only** in YAML frontmatter is found under `region: 'frontmatter'` and
      **not** under `region: 'header'`; a body field is the inverse. Proven by
      fixture in both directions — this is the whole point of the option, and a
      `region` that silently matches everything is indistinguishable from no
      option at all.
- [ ] **Frontmatter — precedence fires as ruled.** A document carrying `State`
      in **both** frontmatter and header behaves per the Open Questions ruling:
      under (c) it goes **red** naming both lines; under (a)/(b) the losing
      source is not reported and the winning value is the one asserted against.
      Untestable until that ruling exists — which is the point of ruling first.
- [ ] **Frontmatter — no phantom section.** A frontmatter-bearing document
      reports the sections it actually has. Today it does not: the closing `---`
      yields a depth-2 heading containing the frontmatter block
      ([bug 0087](../bugs/0087-frontmatter-parsed-as-setext-heading.md)). This
      criterion fails until that bug is fixed, and is the reason it is a
      prerequisite rather than a footnote.
- [ ] **Field value — no false positive from examples.** A `**State:** Done`
      inside a fenced code block or a blockquote is **green**, proven by
      fixture. The blockquote half needs the explicit `inBlockquote` walk —
      today it passes only because `^` fails on `>`, which an mdast extractor
      would lose. Fences and blockquotes must be excluded _by design_, and the
      fixture must distinguish the two.
- [ ] **Subsumption is behaviour-preserving.** `honestyAtClose`
      reimplemented on the builder produces byte-identical violations to the
      current hard-coded regex across the existing fixture corpus, _before_ the
      options are introduced. A refactor that changes findings is not a refactor.
- [ ] **`fileRefs()` — dead reference.** An inline-code repo-relative path whose
      target does not exist goes **red**. Proven against the real case:
      `` `support/mails/….eml` `` in a corpus where that file has never existed.
- [ ] **`fileRefs()` — no scope, no scan.** Called without `within`, it matches
      nothing and warns naming the option. A heuristic extractor that silently
      scans everything is the failure mode this criterion exists to prevent.
- [ ] **`fileRefs()` — no false positive on prose.** Backticked prose that is not
      a path (`` `pnpm install` ``, `` `role: 'admin'` ``, `` `0e47f0a3` ``) is
      **green**, proven by fixture. This is the rule most likely to be noisy;
      if it cannot be made quiet it should ship `.warn()`-only.
- [ ] **`haveNameMatching` as condition.** A misnamed file goes **red**; the same
      method after `.that()` still _filters_ and asserts nothing — the dual-use
      dispatch is proven in both phases, not assumed.
- [ ] **`haveContentMatching`.** A document containing an unqualified redaction
      marker goes **red** while a qualified one is **green**.
- [ ] **`beFresherThan`.** A document whose date field exceeds the window goes
      **red** under an injected clock; the same document goes **green** with the
      clock moved back. An unparseable date value goes **red** naming the field
      and the raw value — never a silent skip.
- [ ] **`clauseEnforcement()`.** A clause with no Tier goes **red**; a Tier-5
      clause with `mechanism: governance` goes **green**. Failing on low
      hardness rather than on missing declaration is a failed criterion.
- [x] ~~**`fields()` — the third syntax.**~~ **Already passes.** The default
      extractor at `vocabulary.ts:103-107` strips `*`/`_`/backticks and splits
      on `·`, so `- Status: refining · Readiness: 🟡` yields `refining` today.
      Kept as a regression fixture, not as new work.
- [ ] **Conditional — antecedent false.** A document whose `Status` is _not_
      `promoted` is **green** regardless of its gate boxes. A conditional that
      fires when its antecedent is false is not a conditional.
- [ ] **Conditional — antecedent true, consequent false.** `Status: promoted`
      with 3/4 boxes goes **red**, naming the unchecked box's line.
- [ ] **Conditional — the inverse direction.** 4/4 boxes with `Status: refining`
      goes **red**. This is the direction that catches real drift and the one
      most likely to be dropped as "the same rule reversed"; it needs its own
      fixture.
- [ ] **Conditional — no silent vacuity.** A conditional whose antecedent
      matches **zero** documents must be reported at run time, not pass green.
      A rule that gates nothing is the failure class `check:nonvacuity` exists
      for, and conditionals make it far easier to write one by accident — a
      typo'd field name is indistinguishable from a satisfied invariant.
- [ ] **`agree()` — divergent values.** A plan whose file says `Done` while its
      ROADMAP row says `Udkast` goes **red**, naming **both** sides with **both**
      line numbers.
- [ ] **`agree()` — mapped values are not a violation.** `Draft` against
      `Udkast` under the declared `normalize` is **green**. Strict equality
      here would fire on every row in the reference corpus, which is the failure
      mode that makes teams delete the rule rather than fix the data.
- [ ] **`agree()` — unnormalised value.** A board cell that `normalize` leaves
      in the other side's dialect goes **red** naming the raw value, so an
      author extends the normaliser instead of editing correct data. (With a
      `via` record this needed a third violation class; with a normaliser the
      author writes the fallback — one reason the table was rejected.)
- [ ] **Line attribution.** Every violation above reports the **element's own
      line** — the field's line, the reference's line, the row's line. Proven by
      asserting on line numbers in tests, not by reading output. The existing
      `haveTableRowsSatisfying` reports at the table header with a row index —
      filed as [bug 0085](../bugs/0085-table-row-violations-report-table-line.md),
      fixable independently of everything here; new element types must not
      inherit it.
- [ ] **Non-vacuity in CI.** Each capability is represented in the repo's
      `check:nonvacuity` pass, so an emptied implementation cannot stay green.

## Open Questions

**Five** decisions belong to the library author and are deliberately not settled
here. Each changes the public surface. (This section said "three" through two
drafts; the count was not updated when questions were added. Four of the five
bear on the md core — only the duration grammar rides with a separable
capability.)

Two of them are **not** md decisions at all and should land as ADRs before any
plan: vacuity-on-empty-element-sets lives on the base `RuleBuilder` and binds all
six packages, and preset-default retention is a semver policy.

- [ ] **Duration format for `beFresherThan`.** `'90d'` is used throughout the
      examples, but the accepted grammar is unspecified — whether `'3mo'`,
      `'1y'`, plain day-counts, or ISO 8601 durations are permitted. Suggested
      floor: `\d+[dwmy]`, rejecting anything else loudly at rule-construction
      time rather than at run time.
- [ ] **How does a rule _match_ a drifted spelling?** New, and the sharpest gap
      the review found: the criterion above requires `**Status:** open` where
      `**State:**` is required to report _as drift_, but a `label` of
      `/^State$/` simply rejects `Status`, and the matched label only exists on
      a term the selector matched. Carrying the label is necessary and not
      sufficient. Options: an explicit `aliases` / `deprecatedNames` set, a
      near-miss notion, or "extract every header field, then compare against the
      expected set". Without one of these an implementer produces "field
      missing" — the outcome the criterion calls a failure. **This is the
      proposal's best-measured finding (49 files); it should not enter a plan
      undecided.**
- [ ] **Frontmatter precedence.** _Not contingent on a feature — this is live
      today._ The extractor already reads both `**Name:** value` header fields
      and YAML frontmatter, so a document carrying both already yields two terms
      with no way to tell them apart. Undefined: what wins. Options are (a)
      frontmatter wins, (b) header wins, (c) carrying both is itself a
      violation. (c) is the most eess-like answer — two sources of truth for one
      field is the defect, not a merge problem — but it forecloses gradual
      migration from one form to the other. Whichever wins, the ruling is only
      _expressible_ once `region` distinguishes the sources.
- [ ] **Does `honestyAtClose` keep its defaults?** Drafted above as additive
      (defaults `State` + the five-token enum), which makes this a **minor**
      release. Requiring explicit options would make it **major** but would
      force every consumer to state the field name — surfacing exactly the
      drift that motivated this proposal. The trade is honesty-now against
      adoption friction.
- [x] ~~**Can a field predicate read another field in the same document?**~~
      **Resolved** by the conditional capability: _"a non-terminal item must not
      go stale"_ is a conditional whose antecedent is
      `haveField('State', notTerminal)` and whose consequent is
      `beFresherThan('90d')`. It was never a field-element gap.
- [ ] **Does a conditional whose antecedent matches nothing fail or warn?** An
      acceptance criterion above requires it be _reported_; whether that is a
      violation, a warning, or a line in the scope report is unsettled.
      Conditionals make accidental vacuity cheap — a typo'd field name looks
      exactly like a satisfied invariant — so the strict answer is defensible,
      but it would make every conditional rule fail on an empty corpus.

## Scope

The dialect is a construction kit where ts is batteries-included: md ships two
presets to ts's seven, and is the only dialect without a CLI — so an md rules
file is a script with side effects, which cannot be snapshotted or `explain`ed,
and has no generic `assertsSomething`.

> **Correction to this proposal's second draft.** It also claimed md "cannot be
> … vacuity-checked". False: md is vacuity-checked three times today.
> `scripts/check-nonvacuity.mjs` runs committed `.mjs` fixtures
> (`scripts/nonvacuity/bad-links.mjs`, `bad-adr.mjs`, `bad-pointers.mjs`) that
> import the library directly and must exit 1 — **no CLI is involved**. The
> claim was load-bearing in the section that sequences follow-on work, and it
> made the acceptance criteria below look harder to meet than they are.
>
> **Update, 2026-08-14 (bug 0127's fix, PR #57).** `bad-links.mjs` and
> `bad-pointers.mjs` no longer exist — both were converted to plant a probe
> and drive `scripts/check-corpus.mjs` itself, so "no CLI is involved" is now
> false for those two specifically (`bad-adr.mjs` is unchanged and the claim
> still holds for it). Left as history rather than rewritten; see 0127.

That gap is real but separable. **This proposal covers only expressiveness** —
the element-level capabilities a corpus needs to state its own conventions.
CLI parity (rule arrays, `explain`, snapshot, `assertsSomething`) and rule
staleness are follow-on proposals, both blocked on nothing here.

Sequencing by measured value in the reference corpus:

1. **Finish the term element** — carry the matched label, `region: 'header'`,
   designed blockquote guard, `matchValue`. Closes a half-blind gate today (49
   of 91 items unchecked), and every conditional needs it as an antecedent.
   Blocked on the spelling-drift decision above.
2. **Document predicates and conditions** — `haveField`,
   `haveAllTaskItemsChecked`, `haveLinkMatching`, `haveContentMatching` dual-use
   on `docs()`; condition forms for `areChecked` and `haveNameMatching`. Two
   files, mechanical. Retires the hard-coded pair inside `honestyAtClose`.
3. **`fileRefs()`** — four live dead references; independent of 1–2. Needs the
   naming decision against `pointers()` first (line-anchored or not is one
   element type with an optional line, not two).
4. **`correspondence().agree()`** — the only kernel ask, independent of all md
   work, and shippable first. Blocked on fixing the `preserveRelations`
   right-to-left bug it sits beside.
5. **`clauseEnforcement()`** — likely one option on `adrEnforcement` rather than
   a new preset; get that finding before it gets a plan.

Steps 1–2 are the proposal's core; 3–5 are separable and could ship
independently if the release needs to be smaller. Step 4 is separable in the
other direction — it touches a different package and blocks on nothing here.
