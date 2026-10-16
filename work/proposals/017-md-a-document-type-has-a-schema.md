# Proposal 017 — md: a document type has a schema, and the corpus is bound together

**State:** Draft — filed 2026-10-16 at the maintainer's request; revised the same day with a third
adopter's evidence; rewritten the same day (see "Correction" below); reviewed the same day
(architect · product · enforcement), **Ruling: Split and sequence** — see "Review — 2026-10-16", the
operative section; no ask is accepted yet.
**Priority:** Medium — the manifesto's Schema Layer is marked partial and its generic part is not
built, so every adopter that wants a document checked for its shape writes the check by hand, and
this repository does without one. No shipped rule claims to check a document's shape, so nothing
over-claims today; the gap is that no type of document has a schema anyone enforces.
**Origin:** inbound · three adopter monorepos, verified here. The maintainer asked whether adopters'
hand-written record tools duplicated eess; reading them showed they fill a gap in eess instead. The
adopters are named here only as adopter 1, 2 and 3.
**Affects:** `@nielspeter/eess-md` (a document-type declaration, a field element, conditions on
documents, references by identifier, the ledger), the working-method kit (`kit/`), and this
repository's own corpus gates.

## Correction — 2026-10-16

The first two drafts were titled "a record is checked against its type's schema" and scoped the
problem to the working method's records (plans, bugs, proposals). The maintainer corrected the
scope: eess-md serves any Markdown corpus (work records, ADRs, wikis, specifications, docs) and
must supply the tools that bind it together. Read against the manifesto, the narrow draft was one
preset of the unbuilt Schema Layer written as if it were the layer. This rewrite keeps every
measurement the earlier drafts made, and moves the working-method kit to one preset (Ask H). The
earlier text is in this file's history.

## Problem

The manifesto's Schema Layer ([docs/manifesto.md](../../docs/manifesto.md), "Schema Layer —
partial") says: "Every specification type has schemas", defining "required sections, semantic
structure, allowed relationships, valid transitions, ownership boundaries, architectural
constraints", and records that "The generic per-spec-type schema system described below is not
built." What exists is one schema per artifact, each hand-written: the ADR Enforcement table
(`adrEnforcement`), the Mermaid grammars, the Gherkin line grammar, and the corpus link and pointer
rules.

eess-md checks the parts of a document that point somewhere: links, code pointers, ADR tables, a
declared relation answered from the other end (plan 0406), and with `honestyAtClose` whether a
closed record hides an open box. It has no notion of a document's **type**. A Markdown corpus is
made of types (a plan, a bug, an ADR, a wiki page, a runbook, a workflow specification, a README),
and each type has a shape: the fields it carries and the values each may take, the sections it
needs, sometimes depending on a field, the title it opens with, the documents it may refer to, the
states it moves through and where each state lives. None of that is checked. A bug record without
its Severity, a wiki page whose `[[See also]]` names no page, a reference to "bug 0123" when 0123
is a plan, and a workflow specification with no terminal state are all green.

The manifesto's own example of a schema is a workflow type ("must define states, must define
transitions, terminal states required, tests required"). Nothing in eess can state it.

## Measured

Each finding below that names eess-md was re-checked against `main`; what is only an adopter's
measurement says so.

**Adopter 1 built a declarative schema** (done 2026-08-30, five review rounds, on eess-md 0.3.0):
about 450 lines of schema plus about 1,400 of checkers around it. Each document type's schema names
the folder it classifies and the files it exempts; a pattern for the H1, or for the filename;
required fields, each an allowed-value set or a pattern, with a value extractor; required sections
as groups of synonymous names written as patterns; sections required only when a field has certain
values; and one section that must hold a live `file:line` pointer. Its first run on its own corpus
found 136 violations where about 10 were expected, fixed one record at a time.

**Adopter 2 ported a thinner copy**: a regex field reader, hand-built `ArchViolation`s and its own
non-vacuity count.

**Adopter 3 writes every check as an eess rule** (an ADR of its own requires it; eess 0.6.0,
eess-md 0.8.0): about 9,500 lines in all, with `docs()`, `links()` and `taskItems()` builders, but
almost every judgement inside them a hand-written condition. It probes its own rules with a port of
this repository's sabotage harness (31 probes).

**The gaps they measured, each re-checked here:**

1. **No per-document field reader.** `terms()` and `vocabulary()`
   (`packages/md/src/builders/vocabulary.ts:87`) read a label across the whole corpus and test set
   membership only; there is no pattern condition and no live/frozen scope. Adopter 1 called it a
   scoping trap and wrote a regex per field; adopter 3 tried `terms()` first and measured 240
   findings on its bugs alone, 205 of them in frozen folders, before writing its own. Their value
   extraction then broke in the same places: adopter 1's extractor emptied an emoji-only value, a
   value opening with a delimiter and a parenthesised one; adopter 3 needed three normalisers,
   because one rule (the first word) turns `P1` into `P` and reads `6` as empty.
2. **The field forms are wider than eess-md's label grammar.** eess-md has one grammar,
   `packages/md/src/model/label.ts:45` (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`).
   Adopter 3's dominant form is a heading used as a field, `## Status: open`: by its measurement,
   1,066 of its 1,249 bug records write `## Status:`, and the grammar reads 162 of them. One record
   mixes forms (`## Status:` beside `**Found:**`). It also needs aliases (`Status` or `State`) and
   fields that are required in one type and checked only when present in another. 44 of its records
   carry their first Status line past line 20, so a reader limited to the header's first lines
   misses them.
3. **`haveSection` has no depth and cannot test the title.** `haveSection(name)`
   (`packages/md/src/conditions/structure.ts:7`) matches a heading at any level, though `MdSection`
   carries `depth` (`packages/md/src/model/document.ts:10`). All three adopters test the H1 by hand.
   Adopter 1's first draft also wrote its section patterns with `##` in them, which `MdSection.name`
   never contains; run as drafted it would have reported every record.
4. **The ledger is all or nothing.** `honestyAtClose` reads `State:` only
   (`packages/md/src/rules/ledger.ts:151`); its options (`ledger.ts:48`) offer no other label, no way
   to run its state, box and placement halves apart, and no live-only scope. Adopters 1 and 3 use
   `Status:` in most folders, so the state half never ran on them, and both rebuilt the two-way
   state↔folder check `honestyAtClose` already has. Adopter 3 also has a folder that is neither live
   nor closed (`parked/`: kept, but bound to one state) and found that requiring a positive done
   marker flagged 10 correctly closed records, so it judges only the unambiguous contradiction.
5. **A type's facts live in several lists that disagree.** Adopter 3 keeps four lists of closed
   folders (between two and five folders each) and two of exempt index files; adopter 1 kept two.
   In eess, `honestyAtClose`'s default done folders (`ledger.ts:96`) and `corpus()`'s default frozen
   globs are two lists nothing keeps in agreement.
6. **No public way to build a document from text.** `buildDocument()` is not exported, so adopter 1
   builds `MdDocument` literals by hand, which works only while the code under test never reads
   `.root` or `.tables`. Adopter 3 writes fixtures to a temporary directory and calls
   `corpus({ cwd })` instead, and pays for it in time: its corpus rules take 6 min 39 s in CI.

**This repository has the same gap, in shape and in references.**

- _Shape._ CLAUDE.md prescribes a plan format ("Status/Priority/Effort header, Problem section, …
  Test inventory, Out of Scope section"), and no gate checks it. Measured 2026-10-16 over
  `work/plans/**` and `work/bugs/**`, with these exact names: of 304 bug records, 45 carry no
  `**Severity:**` line, 54 no `**Origin:**` line and 72 no section named "Root cause"; of 58 plans,
  31 carry no section named "Test inventory". Some use another name for the same thing, which is
  itself what a schema would surface.
- _Fields read by hand._ `scripts/lib/proposal-ruling.mjs` matches `**Ruling:**` and
  `**Implements:**` with its own label prefix (`scripts/lib/proposal-ruling.mjs:169`), beside
  eess-md's label grammar.
- _References by identifier._ The corpus refers to its own documents by type and number far more
  often than by link. Measured 2026-10-16 over the 478 tracked Markdown files under `work/`, `adr/`,
  `docs/` and the root: 2,190 references of the form "bug NNNN", "plan NNNN", "spike NNNN" or
  "proposal NNN", and 1,509 of the form "ADR-NNN". 117 of the first kind name a number no record in
  `work/` holds (53 distinct numbers), and 29 name a number that another type holds ("bug 0066"
  where 0066 is a plan). Not hand-classified: many of the 117 are the numbers of the project this
  engine was ported from, which a reference check would have to declare as a foreign namespace
  rather than report, and some are placeholders in an example ("proposal 9001"). Every "ADR-NNN"
  reference in that scope names an ADR that exists. None of these is checked today; a
  `[text](path)` link to the same record would be.

  > **Correction (review, 2026-10-16).** "Names an ADR that exists" measured existence, not
  > aboutness: 14 sites write "ts-archunit ADR-NNN", and each resolves to a local ADR of the same
  > number that is a different decision (bug 0303's class). The instrument behind 2,190 / 117 / 29
  > is not recorded here: it was a case-sensitive, singular `\b(bug|plan|spike|proposal) (\d{3,4})\b`
  > over tracked `.md` files under `work/`, `adr/`, `docs/` and the root, keyed on numbered files in
  > `work/`. The enforcement reviewer, counting case-insensitively with plurals, got 2,861 / 91 / 67;
  > ranges ("bugs 0011–0024") and a spike that is a directory change the counts again. The numbers
  > show the order of magnitude, not a rate.

## Existing code survey

- **One type-specific schema exists, hand-written**: `adrEnforcement`
  (`packages/md/src/rules/adr.ts`) checks one section and one table of one document type. It is the
  precedent for what a type schema checks, and the proof that each one is written by hand today.
- **One label grammar exists** in `packages/md/src/model/label.ts` (plan 0405), shared by the
  ledger's `State:` reader and `links().areLabelled()`. A field reader extends it rather than sits
  beside it; it does not read a heading as a field today.
- **Fence-aware prose exists.** `proseText(…, 'closed-fences', …)`, used by `terms()`, keeps a label
  inside a fenced example from being read (bug 0287), and the ledger's state reader skips code
  (`ledger/state-in-code`). Adopter 3's own reader does not skip fences, and is right on its corpus
  only because its one fenced `## Status:` sits in an excluded board file.
- **Sections exist with depth**, and `haveSection` already takes a `RegExp`, so a synonym group is
  a regex alternation today. Adopter 3 uses `haveSection` as shipped.
- **Selecting documents by folder or name exists**: `docs().that().resideInFolder()`,
  `resideInFile()`, `haveNameMatching()` (`packages/md/src/builders/docs.ts:30`). A type's selector
  is these, declared once.
- **Declared relations exist, by link only**: `links().areLabelled(label)` selects the links a
  labelled block declares (plan 0405), `areInSection()` the links under a heading, and
  `beLinkedBack()` checks the target answers (plan 0406,
  `packages/md/src/builders/links.ts:128`). `check:corpus` uses them for `**Extends:**` between
  ADRs. A reference written as text ("bug 0439", "ADR-020") is not a link and is read by nothing.
  Wikilinks are proposal 015's subject and are not read either.
- **Placement exists**, in both directions, for `State:` only, inside `honestyAtClose`.
- **Value normalisation exists twice**, in the ledger (`WRAP`, `packages/md/src/rules/ledger.ts:154`)
  and in `terms()` (`packages/md/src/builders/vocabulary.ts:97`). Neither is the other, and neither
  is per field.
- **Views exist as tables, and binding a table to its sources exists**: `rows()` reads a table's
  rows as elements, and the kernel's `correspondence()` joins two sides. `spec.rules.ts` binds the
  README's package table and the ADR index this way (`spec.rules.ts:64`, `spec.rules.ts:138`). No
  board in `work/` is bound to its records like this; this repository's bug board header counts are
  known to be stale.

  > **Correction (review, 2026-10-16): false.** `scripts/check-corpus.mjs:489` onward binds
  > `work/proposals/PROPOSALS.md`'s Board to every proposal file (row presence and Ruling drift,
  > with an evidence guard at three levels), and `scripts/check-corpus.mjs:913` onward binds
  > `work/README.md`'s Lanes table to the lane directories. What is unbound is the bug board's
  > Status cell (bugs 0197 and 0244). The survey also missed proposal 001, which covers much of this
  > ground; see the Review.

- **Pointers by section do not exist.** Links by section do.
- **Not in eess:** a document-type declaration; a field element; a field-value predicate on
  documents; a title condition; a requirement conditional on a field; a reference by identifier; a
  configurable or separable ledger.

## Asks

Each ask is generic over Markdown. The examples use three types on purpose: a bug record, a wiki
page, and the manifesto's workflow specification.

**A. A document type is declared as data, once.** `documentType({ name, select, exempt, title,
fields, sections, relations, states })`: `select` is the folders or name pattern that classify a
document as this type, `exempt` the files in those folders that are not of it (an index, a board),
and the remaining keys are B to E. A rule set built from the declarations reports a document that
two types claim, and, where a folder is declared fully typed, a document no type claims. Every
other rule in this proposal reads the type from the declaration rather than repeating its folders,
so no two lists can disagree (gap 5).

```ts
const bug = documentType({
  name: 'bug',
  select: { folder: 'work/bugs/**', exempt: ['BUGS.md'] },
  title: /^Bug \d{4} — /,
  fields: [
    { name: 'State', required: true, accepts: ['Draft', 'Ready', 'Done', "Won't-do"] },
    { name: 'Severity', required: true, accepts: ['Low', 'Medium', 'High'] },
  ],
  sections: [{ name: /^(Symptom|Problem)$/, depth: 2 }, { name: 'Root cause' }],
})
const wikiPage = documentType({
  name: 'wiki page',
  select: { folder: 'wiki/**' },
  sections: [{ name: 'See also', when: 'present', relations: 'wiki page' }],
})
```

**B. A document's fields are elements, read in every form a document uses.** `fields(corpus)`
selects every field of every document: the label grammar's forms, widened to a heading used as a
field (`## Label: value`) and to YAML frontmatter keys, read outside fenced code, over the whole
document. Each element carries its document, its type, label, raw text, normalised value and line,
and reports its own line. A field spec is data: `{ name, aliases, required, accepts, says }`, where
`accepts` is a value set or a pattern and `says` is the remedy a finding carries. The normaliser is
one tested owner, shared with the ledger, chosen per field (a word, a token, an integer, a date).
The reader is exported as a plain function as well, so a tool that only renders a board reads
fields the same way as the rule that checks them.

**C. Structure is checked per type, and can depend on a field.** `haveSection` gains an optional
depth, and `haveTitle` tests the H1; a predicate `docs().that().haveFieldValue(label,
valuesOrPattern)` makes "a fixed bug has a Verification section" one rule; `pointers()` gains
`areInSection()`, so "this section holds a live code pointer" composes. A type declares these in
`sections` and `title`, and they are built from the same conditions a hand-written rule uses.

**D. A reference is resolved against the type it names, and a type declares the relationships it
allows.** A reference is any way one document names another: a link (read today), a reference by
identifier written as text ("bug 0439", "ADR-020", "proposal 013"), or a wikilink (proposal 015
owns reading it; this ask consumes what 015 reads). A type declares how its documents are named
(`bug NNNN`, `ADR-NNN`, a wiki page's title); a reference that names an identifier no document of
that type holds, or one another type holds, is a finding. `relations` declares what a type may
refer to under a label or in a section, and what must answer it: "a plan's `Implements` names a
proposal", "a wiki page's See also names wiki pages", "an ADR's `Extends` is linked back", the last
being plan 0406's check moved onto the declaration rather than a second mechanism beside it. A
namespace a corpus cites but does not hold (another project's numbers) is declared as foreign and
not resolved.

**E. A type's lifecycle is declared, and placement follows it.** `states` names the state field
(any label, a list of aliases, or the heading form), its vocabulary, which states are terminal, and
which folder each state lives in, including a folder that is kept but bound to one state.
`honestyAtClose` reads that declaration instead of its fixed `State:` label and default folders, and
its state, box and placement checks can each run alone (gap 4). A workflow specification's own
states and transitions are the same declaration applied to its content rather than its header: a
type can require that the states its document lists include a terminal one and that every
transition names a declared state. Whether that second use is one mechanism or two is the
architect's question.

**F. A view is bound to the documents it lists.** A board or an index is a table whose rows stand
for documents of a type. A type can declare its views, and the binding is built from `rows()` and
`correspondence()`, which exist: every live document of the type has a row, every row names a
document, and a row's state cell agrees with the document's state field. This ask may be met by a
preset and documentation rather than new mechanism; the review decides.

**G. A public way to build a document from text**, for tests, so a fixture is neither a
hand-written literal that silently lacks fields nor a temporary directory that makes a suite slow
(gap 6).

**H. Presets declare types, and this repository uses them first.** The working-method kit ships its
types (plan, bug, proposal, spike) as declarations built from A to F. The ADR type's declaration
cites `adrEnforcement` for its table instead of reimplementing it. This repository declares its own
types, binds `work/plans` and `work/bugs` to the format CLAUDE.md prescribes, resolves its own
references by identifier, reads `Ruling` and `Implements` through B instead of
`scripts/lib/proposal-ruling.mjs`'s own reader, or records why it cannot, and binds its boards. The
first run is in report mode, and its findings are fixed or the declaration corrected one by one,
never widened to go green.

## Acceptance criteria

- [ ] Each new condition has a non-vacuity row: a missing field, a value outside the set, a value
      failing the pattern, a field in the heading form, a missing conditional section, a wrong H1, a
      section without a live pointer, a reference to an absent identifier, a reference to an
      identifier of the wrong type, a document two types claim, a state in the wrong folder and a
      board row with no document each red a fixture, and a type that selects no document fails.
- [ ] A field or a reference inside a fenced example is never read, in any form, proven by a
      fixture.
- [ ] The normaliser has one owner, with every value shape that broke an adopter's extractor
      (emoji-only, delimiter-first, parenthesised, `P1`, a bare integer) as tests.
- [ ] `honestyAtClose` with a `Status` label reports a misplaced record in both directions, and each
      of its halves runs alone.
- [ ] One declaration feeds `corpus()`'s frozen globs, `honestyAtClose` and the schema, and a
      fixture with a closed folder in one list but not another cannot be built.
- [ ] A type outside the working method (a wiki page, a workflow specification) is declared and
      checked by a fixture, so the mechanism is not shaped by the method's records.
- [ ] This repository's types pass their declarations, and the run that got them there is recorded
      with every finding's disposition.

## Open questions

- **Bold labels, heading fields, YAML frontmatter, or all three?** The method uses bold labels;
  adopter 3 uses headings; frontmatter is common in wikis and static sites, and eess-md already
  parses it (and stopped reading it as a section, bug 0087). Reading all forms through one grammar is
  B's proposal; whether a preset then prescribes one form is the question.
- **Where does a field's span end?** B reads the whole document. Adopter 3 reads its structured forms
  anywhere and its inline forms only in the first 20 lines; the ledger reads the preamble and first
  section. Which reading a schema uses decides what "missing" means.
- **How is a reference by identifier recognised?** D needs a pattern per type ("bug NNNN"). Prose
  uses numbers that are not references (a placeholder such as "proposal 9001" in an example), so
  some form of marking a non-reference, or of reading only declared positions, is needed. Which, and
  whether an unmarked mismatch is a finding or a report, decides D's false-positive rate.
- **Synonym groups as data or as regex?** A regex alternation works today; a list of names gives a
  better message ("missing one of: Symptom, Problem, Repro").
- **Kernel or dialect?** A document type is a Markdown notion, so eess-md. The manifesto says
  "every specification type has schemas", and the Mermaid and Gherkin dialects each have their own
  grammar already; whether "a type declared as data" is a kernel concept those dialects would share
  is the architect's question. Ownership boundaries and architectural constraints, the manifesto's
  last two schema items, are not addressed here.
- **Split and sequence?** A to H are eight asks. One order the author sees: B and C (fields and
  structure, usable alone), then A and E (the declaration and the lifecycle), then D (references),
  then F and H (views and presets), with G whenever the tests need it. The review decides.

## Out of scope

Each of these is its own record, written after this proposal's review, and none is a precondition
of it:

- **Transitions over history**: a document moved from Draft to Done without passing Ready. E checks
  a state and its folder at one commit; a transition is a fact about two commits.
- **A drift check** (a document's cited files changed after its "checked" date). Adopters 1 and 3
  both built one; adopter 3 now reports drift as a nudge and blocks only on its reader's faults (a
  shallow clone, a missing date).
- **A branch gate**: a pull request closes a record or says why not, ticks no box on a record it
  leaves open, and a closed record's `Deferred:` count equals its `deferred→` boxes. Adopter 3 built
  it as honesty-at-close applied to a diff, and had to select a stand-in document as its subject,
  which makes its `examined` always 1: eess has no subject for a check over a set of facts.
- **Ledger checks adopter 3 added**: a deferral names a record that exists and is live; a checklist
  box still open cites a live record; record ids are unique across types (the kit's `next-number
--check` covers numbers, not ids). D may cover the first two; they are recorded separately
  until it does.
- **Defects adopter 3 reports in eess-md, to be reproduced here before they are recorded**:
  `taskItems()` misses nested boxes and `[~]`; `adrEnforcement` does not check its Status vocabulary,
  that a `gated` row cites a mechanism, or that the table has a row; `verifyCitations` reads a dotted
  name such as `it.skip` as a path; `fileIndex` includes untracked files.
- **`corpus()`'s cost.** Adopter 2 measured about 1.4 s for 363 files, almost all of it the syntax-tree
  parse, and `ignore` does not skip the walk its documentation says it does; adopter 3 measured
  5.7 s to build its corpus against 273 ms for its rules.
- **The kit shipping runnable gate scripts** for what exists today (`check:ledger`, `check:corpus`).
- **Adopter 1's future ideas** (an impact oracle over a diff, a corpus query tool, a check tying
  each PR to a record, an MCP server). Product input, not asks here.

## Review — 2026-10-16

**Ruling: Split and sequence**

Reviewed by three lenses (architect · product · enforcement) after a code survey; the reviews are
summarised here, and the coordinator decided the ruling. The lenses returned "Rewrite needed (narrow),
then split", "Split and sequence" and "Ship with changes". They agree on the substance: the gap is
real and measured, the proposal is eight shippable things, and three of them cannot be planned until
the record itself changes. "Split and sequence" is the ruling because the record is mostly right
and several slices are ready now; what is not ready is held below with its condition, not sent back
whole.

### What the review found in the record

- **The proposal duplicates proposal 001 without citing it.** Proposal 001 (eess-md: express a
  corpus's own conventions; Ruling: Rewrite needed; Draft) measured the same problem on an earlier
  adopter corpus: the `State`/`Status` split, filename patterns, requirements conditioned on a field,
  board-to-file agreement, and `honestyAtClose` taking its label as an option. Its review decided
  the point Ask B reopens: "finish `terms()`, don't add `fields()`", because `terms()`/`MdTerm`
  already models the labelled-value line, and that a field element cannot carry presence, since a
  document without the field yields no element and `required` is vacuously green. Its open questions
  (aliases, frontmatter precedence, the field's region, the semver of `honestyAtClose`'s defaults) are
  017's. Both the author's survey and the coordinator's missed it: they surveyed code, not the
  proposal lane.
- **Ask A fits ADR-006 only under a constraint the proposal does not state.** A declaration passed
  to a preset function is a rule file if it is sugar over the public builders, and a second rule
  language if its keys carry meaning found nowhere else. The drafted example does the second three
  times: `when: 'present'` is a string conditional where the DSL has `Predicate<MdDocument>`;
  `relations: 'wiki page'` names a type by a string where a value would be type-checked; and `says`
  duplicates the builder's `because` and suggestion. Proposal 012's review drew the same line.
- **Ask D over free prose cannot be made honest.** This repository's identifiers collide with those
  of the project its engine was ported from, using the same words, so a per-type pattern plus a
  foreign namespace cannot tell them apart: "(bug 0039)" in ADR-012 is the ported project's;
  "plan 0103" in bug 0229 names what is a bug here; the 14 "ts-archunit ADR-NNN" sites resolve to
  the wrong ADR. A per-line "not a reference" marker is an escape an agent can stamp to go green
  (ADR-009 rule 3), and a warning is the release nobody reads (ADR-009 rule 1). This proposal's own
  text would fail it.
- **The vacuity guard covers one level of six.** "A type that selects no document fails" leaves green
  a type whose glob silently skips a subfolder (`work/bugs/*.md` drops `fixed/`, where 23 of the 45
  bugs without Severity sit), an optional field present nowhere (a misspelled declaration), a
  conditional requirement selecting no document, a relation label no document carries, a reference
  pattern matching nothing, and a stale exemption or foreign namespace (ADR-018's rule applied to
  documents). eess-md is also outside the vacuity matrix (bug 0403), so a new eess-md constructor
  called bare is proven empty-safe only by hand-written fixtures.
- **One `says` per field is one sentence for several causes** (ADR-009 rule 2): absent, misspelled,
  written without its colon (bug 0408), mid-paragraph (bug 0415), inside a fence, duplicated, or
  aliased with a disagreeing value. Each needs its own message, and a remedy test that applies it.
- **Widening the shared label grammar to read a heading changes two shipped readers** (the ledger's
  state and `links().areLabelled()`) for every adopter; the heading form must be one a field opts
  into, read through `MdSection`.
- **Defaults cannot be unified silently.** `corpus()` freezes `completed` and `archived`;
  `honestyAtClose` treats five folders as done. Making one list feed both freezes `fixed/`,
  `wont-do/` and `delivered/`, whose pointers then stop being examined (bug 0253): a break toward
  green. A declaration must be a new optional input; both existing options and defaults stay.
- **The evidence is all work records.** Every adopter, and this repository, is a corpus of plans and
  bugs. The generic claim is asserted by fixtures, not shown. Frontmatter, the main field form on
  documentation sites and wikis, is parsed (`packages/md/src/model/prose.ts:24`) but not exposed on
  `MdDocument`.
- **Ask E's workflow-content half has no consumer** and is a different mechanism (a state graph, whose
  notation is a state diagram, which is proposal 006's ground).
- **G is the wrong grain as asked.** Exporting `buildDocument` exposes mdast in the public API and
  yields a document where rules take a `Corpus`; what tests need is a corpus built from text, so
  links and pointers resolve as they do on disk. The claim that it fixes adopter 3's 6 min 39 s is
  unmeasured and is withdrawn.

Placement: every ask is eess-md's. Nothing moves into the kernel until a second dialect asks;
`documentType()` registers nothing globally, and `corpus()` does not learn about types (ADR-013's
posture). Only `@nielspeter/eess-md` versions, a minor per slice, provided defaults stay.

### Disposition, per ask

| ask                                                                                                  | disposition       | owner or condition                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E, header half** — `honestyAtClose` reads the lane's own state label                               | **Held**          | First a bug: with a corpus that writes `Status:`, no record has a readable state and the placement half never runs, while the preset reports nothing. Unholds when that bug is reproduced here and recorded; its fix (a label option and aliases, a finding when no record has a readable state) is the first slice. Defaults unchanged                                                                                                            |
| **E, separable halves and a bound folder**                                                           | **Held**          | Unholds on the maintainer's go to plan it, after the bug above. Additive options only                                                                                                                                                                                                                                                                                                                                                              |
| **G** — a corpus built from text, for tests                                                          | **Held**          | Reshaped from "export `buildDocument`" to an in-memory corpus whose links and pointers resolve as on disk. Unholds on the maintainer's go to plan it                                                                                                                                                                                                                                                                                               |
| **C** — `haveSection` depth, `haveTitle`, a section's pointers                                       | **Held**          | Unholds on the maintainer's go to plan it. "A section holds a live pointer" is a presence condition on `docs()` plus the existing liveness check, not `pointers().areInSection()` alone, which is vacuous on a section with no pointer                                                                                                                                                                                                             |
| **B** — fields                                                                                       | **Held**          | Unholds when this proposal reconciles with proposal 001 (extend `terms()`, presence as a dual-use `haveField` on `docs()`, or say with evidence why 001's review was wrong), and when open questions 1 and 2 (forms, span) are decided. Bugs 0408 and 0415 are inherited, and bug 0403 is a precondition                                                                                                                                           |
| **A** — a document type                                                                              | **Held**          | Unholds when B, C and E have shipped and the ADR-006 constraint is written into the ask: every key compiles to a public builder rule, no check exists only in the declaration, every conditional is a predicate, every cross-type reference is a value, and a type takes plain conditions as an escape. The partition check is the default for every folder a type reaches into, and is built on an eess-md `notExist`. Bug 0403 is a precondition |
| **D1** — references at declared positions (`Implements`, `Extends`, `deferred→`, a declared section) | **Held**          | Rides with A, since it uses A's identity; a join through the kernel's `correspondence()`, not a resolver in the declaration. Replaces `scripts/lib/proposal-ruling.mjs`'s reader and keeps plan 0406's check as the mechanism                                                                                                                                                                                                                      |
| **D2** — references in free prose, as a gate                                                         | **Rejected**      | Cannot be falsifiable here (above). A free-prose census may return as an explicitly run diagnostic; that is a separate record, with its instrument written down                                                                                                                                                                                                                                                                                    |
| **E, workflow content** — a document's own states and transitions                                    | **Rejected** here | No consumer, and a different mechanism; it belongs with proposal 006 (state diagrams) and plan 0078 if a consumer arrives                                                                                                                                                                                                                                                                                                                          |
| **F** — a view bound to its documents                                                                | **Held**          | Docs and a preset, not new mechanism: lift `scripts/check-corpus.mjs:489` onward into a recipe. Unholds with H; bugs 0197 and 0244 own this repository's bug board                                                                                                                                                                                                                                                                                 |
| **H** — presets, and this repository first                                                           | **Held**          | Each slice is adopted here, in report mode, as it ships. Unholds per slice. Before the first one, decide whether a schema checks frozen documents, because otherwise the frozen list becomes the lever that silences it                                                                                                                                                                                                                            |

### Owed before planning B or A

- Reconcile with proposal 001, in this record (above).
- State a tier per ask: everything here is Tier 1 except the rejected D2, which would be Tier 4.
- Add to the acceptance criteria: the six vacuity levels, each with a non-vacuity row driving this
  repository's own gate as well as a fixture; a per-cause message for every field cause; a test per
  mechanical remedy that applies it and asserts the finding clears; the empty-lane path of a fresh
  kit install, which declares `.expectEmpty()` with an expiry rather than marking discovery owned
  (bug 0285's class); and the fence edge cases this repository has already met (bugs 0288, 0289,
  0293, 0416, 0435), with inline code spans decided.
- Lead with an example from outside work records (a documentation site whose pages carry
  frontmatter), and pick one noun for the labelled value: md already says `label` and `term`.

### Records owed, outside this proposal

- The `State:`-only silent pass, reproduced (first slice above).
- `matchName` in `packages/md/src/model/query.ts` calls `.test()` on a caller's `RegExp` without
  removing a `g` or `y` flag, so `lastIndex` carries between documents. To be reproduced and
  recorded.
- A kernel `notExist`: md has none, and mermaid and six ts builders each carry their own copy.
