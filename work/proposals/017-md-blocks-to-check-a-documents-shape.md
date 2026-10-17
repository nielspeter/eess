# Proposal 017 — md: the building blocks to check any Markdown document's shape

**State:** Draft — filed 2026-10-16 at the maintainer's request; revised the same day with a third
adopter's evidence; rewritten the same day (see "Correction" below); reviewed the same day
(architect · product · enforcement), **Ruling: Split and sequence** — see "Review — 2026-10-16";
then its asks were rewritten the same day at the maintainer's instruction (see "Correction —
2026-10-16, after the review") and reviewed again (architect · product · enforcement · method),
**Ruling: Split and sequence**; "Review — 2026-10-16 (second)" is the operative section. Blocks 6,
7, 12, 13 and 17, accepted by the maintainer, are owned by plans 0454 to 0457 and 0459; the examples
gate, decision 3's condition on them, by plan 0458 (2026-10-17/18). Blocks 1, 2 and 5, also accepted,
wait on their preconditions.
**Priority:** Medium — the manifesto's Schema Layer is marked partial and its generic part is not
built, so every adopter that wants a document checked for its shape writes the check by hand, and
this repository does without one. No shipped rule claims to check a document's shape, so nothing
over-claims today; the gap is that eess-md lacks the blocks to state one.
**Origin:** inbound · three adopter monorepos, verified here. The maintainer asked whether adopters'
hand-written record tools duplicated eess; reading them showed they fill a gap in eess instead. The
adopters are named here only as adopter 1, 2 and 3.
**Affects:** `@nielspeter/eess-md` (building blocks: labelled values, conditions on documents,
references at named positions, value-and-folder agreement, a corpus from text, selectable elements),
`@nielspeter/eess-crossvalidate` (citations at a caller-named position), the working-method kit
(`kit/`; examples go in `examples/`, second Review decision 3), and this repository's own corpus gates.

## Correction — 2026-10-16

The first two drafts were titled "a record is checked against its type's schema" and scoped the
problem to the working method's records (plans, bugs, proposals). The maintainer corrected the
scope: eess-md serves any Markdown corpus (work records, ADRs, wikis, specifications, docs) and
must supply the tools that bind it together. Read against the manifesto, the narrow draft was one
preset of the unbuilt Schema Layer written as if it were the layer. This rewrite keeps every
measurement the earlier drafts made, and moves the working-method kit to one preset (Ask H). The
earlier text is in this file's history.

## Correction — 2026-10-16, after the review

The maintainer corrected the rewrite again, after its review: **"eess-md should not dictate how a
plan should look like, or bug or wiki"**, and **"eess-md need to have all the tools and
buildingblocks to support the posibility to build plans, bugs, wikis, x, y, z"**. The rewrite had
still put a fixed model of a document at its centre (Ask A, `documentType({ fields, sections,
relations, states })`: every document has fields, states and a folder per state), led with this
repository's bug record as the example, and planned presets inside eess-md. That is eess-md defining
documents, only more generously. The asks below are rewritten as building blocks that take the
caller's own vocabulary and describe no kind of document, and the measure of the proposal is that
they are complete: any kind of document can be checked from them without a hand-written condition.
Examples and starting kits live outside eess-md. The reviewed asks (A to H) are kept below the first
Review, as "Asks as first reviewed", and the Review maps them to the blocks.

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
closed record hides an open box. It has few blocks for a document's **shape**: the values it
carries under its labels, the sections it needs (sometimes depending on a value), the title it
opens with, what the references at a given place name, and whether a value agrees with the folder
the document sits in. A caller who wants their plans, bugs, wiki pages, runbooks or anything else
checked for shape writes those conditions by hand. A bug record without its Severity, a wiki page
whose See also section names no page, and a record whose status says closed while it sits in the
open folder are all green unless the caller wrote the check.

What eess-md must not do is answer this by defining those documents. A Markdown corpus is made of
whatever kinds its owners invent, written in whatever form they chose (`**State:**`, `## Status:`,
frontmatter). The one place eess-md does fix a shape today, `honestyAtClose` reading `State:` only,
is also where it measurably checks nothing on corpora that chose differently (gap 4 below).

> **Correction (second review, 2026-10-16): not the one place.** `adrEnforcement` fixes this
> repository's Enforcement-table convention, the ledger also fixes board file names
> (`packages/md/src/rules/ledger.ts:97`), and `corpus()` fixes its frozen folders
> (`packages/md/src/corpus.ts:53`). See the second Review, decisions 1 and 2.

The test of the building blocks is completeness: a caller can state the shape of any kind of
document with them, in their own words, without a hand-written condition. Adopter 3's roughly 9,500
lines of rules (its own later count is about 4,400; see "Consumer feedback"), almost all of whose judgements are hand-written conditions inside eess builders,
measure how far the blocks are from that today.

## Measured

Each finding below that names eess-md was re-checked against `main`; what is only an adopter's
measurement says so.

**Adopter 1 built a declarative schema** (on eess-md 0.3.0):
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
  `resideInFile()`, `haveNameMatching()` (`packages/md/src/builders/docs.ts:30`). A type's selector is these, declared once. _(Written for the dropped type declaration; a caller's selections are these.)_
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
- **Not in eess:** a document-type declaration; a field element (_since the rewrite, block 1 extends `terms()` instead_); a field-value predicate on documents; a title condition; a requirement conditional on a field; a reference by identifier; a
  configurable or separable ledger.

## Asks

The principle every ask is held to: **eess-md does not say what any document looks like.** No API
here has a default field name, section name, title, folder, state or identifier pattern that
describes a kind of document. Each block takes the caller's own labels, values, folders and names,
and works on any Markdown. A plan, a bug, a proposal or a wiki page is something a caller builds out
of the blocks; eess-md ships none of them.

> **Correction (second review, 2026-10-16): not true today.** eess-md ships two presets with a fixed
> shape under `rules/*`; the second Review's decision 1 scopes the principle to the package root and
> has the presets rebuilt from public blocks.

**1. Read a labelled value, in the forms the caller names.** Extend `terms()` rather than add an
element beside it (proposal 001's review decided this, and this proposal follows it): the caller
names the label and its aliases, and the forms to read (a bold label, a plain label, a heading used
as a label such as `## Status: open`, a frontmatter key). Values are read outside fenced code; each
carries its document, the label as written, the form it was found in, its raw and normalised value,
and its own line, and is usable as a `correspondence()` side through `.select()`. The value is
checked against a set or a pattern the caller gives. The heading form is one the caller opts into,
never a widening of the label grammar the ledger and `links().areLabelled()` already share.

**2. Ask whether a document has a value, and condition anything on it.** A dual-use `haveField`
on `docs()` (as a predicate in `.that()` and a condition in `.should()`, like `haveSection`), with
the caller's label, forms and optional value set or pattern. Presence lives here, on the document,
because a document without the value yields no element for block 1 to report. With it, "documents
in this folder whose `Status` is `fixed` have a section named `Verification`" is one rule written
entirely in the caller's words.

**3. Structure, in the caller's terms.** `haveSection` gains an optional depth; `haveTitle(pattern)`
tests the H1; a document can be required to hold a live code pointer under a section the caller
names (a presence condition on `docs()` plus the liveness check that exists, since a pointer rule
alone is green on a section that has none).

**4. A reference at a position the caller names resolves.** The caller names where a reference is
meant (a label such as `Implements`, a section such as `See also`), how an identifier is written
there, and which documents it may name (a selection the caller builds, such as "documents in
`work/proposals/` whose filename starts with the number"). Built as an element joined to that
selection through the kernel's `correspondence()`, so "names nothing", "names something outside the
allowed selection" and "names two documents" are its findings. Nothing in free prose is read.

**5. A value agrees with where the document lives.** The caller names the label, the values, and
the folder each value belongs in, including a folder kept for one value only; a document whose
value and folder disagree is a finding, in both directions. This is the placement half of
`honestyAtClose` made a block of its own. `honestyAtClose` today hard-codes `State:` and its own
done folders, which is exactly what this proposal says eess-md must not do; its fixed label is
recorded as a bug first (see the Review), and whether `honestyAtClose` stays in eess-md at all, or
becomes an example assembled from these blocks, is an open question below.

**6. A document no selection of the caller's claims.** "Every document under this folder is matched
by one of these selections" and "no document is matched by two" are each one rule over the caller's
own selections, needing an eess-md `notExist`, which md lacks (mermaid and six ts builders each carry
their own).

**7. A corpus built from text, for tests**: an in-memory corpus whose links and pointers resolve as
they do on disk, so a caller's tests of their own rules need neither hand-written document literals
nor a temporary directory.

**8. A board agrees with its documents** is already composable (`rows()` with `correspondence()`;
this repository's proposal board is checked that way in `scripts/check-corpus.mjs`). The ask is a
documented recipe, not new API.

**11. A rule inside each matching section.** "Every section matching `Phase \d+` has a subsection
named `Files changed`" is a requirement per section, not per document; block 3 checks a document's
sections and cannot state it. Sections are an element of their own here, carrying their document,
depth, heading line and subsections, so the existing structure conditions apply to each.

**12. Any element rule, limited to documents the caller chooses.** `taskItems()`, `links()`,
`pointers()` and the values of block 1 select within the whole corpus, or a folder; none can be
limited to documents matching a document predicate. "Documents whose `Status` is `done` hold no open
box" is `honestyAtClose`'s judgement, and it is buildable only through that preset, with its fixed
label. A predicate that lifts any `Predicate<MdDocument>` (block 2's `haveField` among them) onto the
elements of a document makes it one rule in the caller's words.

**13. A value is unique across a selection.** A record's number, a page's slug, an id: "no two
documents in this selection carry the same value under this label" is a finding with both documents
named. The kernel's `correspondence()` reports a key matching twice when two sides are joined; a
single-sided uniqueness check over one selection is not stated anywhere.

> **Correction (second review, 2026-10-16): false.** eess-gherkin ships one,
> `haveUniqueTitles` (`packages/gherkin/src/builder.ts:21`), which reports a duplicate with the line
> of the first. See the second Review: the block becomes a kernel condition with gherkin's built
> on it.

### Binding the corpus together: links and cross-validation

A document's shape is half the ask; the other half is that what it says agrees with what it names:
other documents, code, tests, diagrams. The same principle holds: the caller names the position,
eess-md fixes none.

What exists, and where a fixed position limits it:

- **Links**: `links()` resolves, checks liveness, and checks a labelled relation is answered from the
  other end (`beLinkedBack()`, plan 0406). Generic already. Wikilinks are not read: proposal 015 owns
  that, and a wiki written with them is not checkable from these blocks until it ships. It is a
  dependency of the completeness test for a wiki, not an ask here.
- **Code pointers**: `pointers()` checks a `path:line` lands. Generic already.
- **Tables to anything**: `rows()` as a side of the kernel's `correspondence()`, with `agree()` on a
  column (this repository's `spec.rules.ts` binds two tables to the workspace and to `adr/`).
  Generic already.
- **Markdown to code, tests and diagrams** (`@nielspeter/eess-crossvalidate`): `adrCitationsResolve`
  (`packages/crossvalidate/src/md-ts.ts:130`) resolves test titles cited in an ADR's Enforcement
  table only; `scenarioCitationsResolve` (`packages/crossvalidate/src/md-gherkin.ts:104`) resolves
  scenario citations; `embeddedDiagramsMatchCode` (`packages/crossvalidate/src/md-mermaid.ts:72`)
  binds diagrams embedded in Markdown to code; `tableErAgree`
  (`packages/crossvalidate/src/md-mermaid-er.ts:91`) binds a table to an ER diagram. Each joins at a
  position the preset fixes; a caller whose runbook cites a test, or whose wiki page names a module,
  has no join.

  > **Correction (second review, 2026-10-16): overstated.** `adrCitationsResolve` already takes
  > `dir`, `section` and `mechanismColumn` (`packages/crossvalidate/src/md-ts.ts:12`), so it resolves
  > titles cited in any table column under any heading in any folder; `scenarioCitationsResolve`
  > scans the whole corpus by default and takes a caller's `extract`
  > (`packages/crossvalidate/src/md-gherkin.ts:21`). What is
  > missing is a citation outside a table (a labelled line, a list), the test and scenario sides as
  > exported selections, and a name without "ADR" in it.

**9. Every block's elements bind to any dialect.** The values of block 1 and the references of block
4 expose `.select()`, so each is a side of `correspondence()` against any dialect's selection: a
value under a caller's label names a TypeScript module, class or file that exists (against
`eess-ts`), a value agrees with the same document's row on a board (against `rows()`), a value in
one document agrees with a value in another (against block 1 again). The ask is that the elements
are selectable and that each join is a documented recipe; the join itself is the kernel's and is not
rebuilt.

**10. A citation at a position the caller names resolves.** The crossvalidate presets' test-title
and scenario resolution, given a caller-named position (a label, a section, a table column) instead
of only an ADR's Enforcement table, so a runbook's `Verified by:` line or a wiki's Tests section
cites a test that exists. The fixed-position presets stay as they are, as callers of the general
form.

> **Superseded (second review, decision 3):** the examples live in `examples/`, gated; `kit/` may
> carry the working method's own.

**Outside eess-md: examples and starting kits.** The working-method kit (`kit/`) may ship example
rule files that assemble the blocks into a plan, a bug and a proposal, and a further example for a
wiki or a documentation site, for an adopter to copy, change or ignore. They are examples, not
exports of `@nielspeter/eess-md`. This repository writes its own rules for its own records from the
blocks, in report mode first, fixing findings or the rule one by one, never widening a rule to go
green.

## Acceptance criteria

- [ ] **Completeness.** Example rule files for at least four kinds of document, two of them outside
      work records (a plan, a bug, a wiki page, a documentation-site page with frontmatter), state
      their shape from public eess-md blocks only, with no `defineCondition` or `definePredicate` of
      their own. A judgement that cannot be written that way is a missing block, recorded, not
      worked around. Testing the asks this way before review found blocks 11 to 13 missing (_a desk exercise over three kinds, not a measurement: see the second Review_). At
      least one example also binds documents outward: a value naming code is
      joined to `eess-ts`, and a cited test resolves at a position the example names.
- [ ] No block has a default label, field, section, title, folder, state or identifier pattern that
      describes a kind of document; a test calls each block with a caller vocabulary unlike this
      repository's (a documentation site's frontmatter `title` and `description`, a wiki's
      `See also`) and it works unchanged.
- [ ] Each block has a non-vacuity row, as a fixture and, where this repository's gates use the
      block, against the gate itself: a missing value, a value outside the set, a value failing the
      pattern, a value in the heading form, a missing conditional section, a wrong title, a section
      without a live pointer, a reference naming nothing, a reference outside its allowed selection,
      a value in the wrong folder, a document no selection claims, and a document two claim.
- [ ] Every way a rule can examine nothing is a finding, not a pass: a selection matching no
      document, a selection that reaches only part of a folder, a label present in no document, a
      condition whose value selects no document, a reference position no document uses, and a stale
      exclusion. Where empty is correct (a fresh install), the caller declares `.expectEmpty()` with
      an expiry.
- [ ] A finding names its cause, each with its own message: absent; spelled near the label;
      written without its colon (bug 0408); mid-paragraph (bug 0415); inside a fence; present twice;
      aliases that disagree. Each mechanical remedy has a test that applies it and sees the finding
      clear.
- [ ] Nothing inside code is read, proven by fixtures for the fence shapes this repository has
      already met (bugs 0288, 0289, 0293, 0416, 0435), with inline code spans decided.
- [ ] The normaliser has one owner, with every value shape that broke an adopter's extractor
      (emoji-only, delimiter-first, parenthesised, `P1`, a bare integer) as tests.
- [ ] Every new eess-md constructor called bare is a configuration finding, proven by a probe
      derived from eess-md's exports (bug 0403), not a hand-written list.

## Open questions

- **Where does a value's span end?** The whole document outside code, or a region the caller names?
  Adopter 3 reads structured forms anywhere and inline forms only in its first 20 lines; the ledger
  reads the preamble and first section. A caller's region, with no default shape, is the candidate.
- **Section names as a list as well as a regex?** A list gives a better message ("missing one of:
  Symptom, Problem").
- **Do `honestyAtClose` and `adrEnforcement` belong in eess-md?** Both bake in a document's shape
  (`State:` and five done folders; this repository's enforcement-table convention). Under this
  proposal's principle they are examples assembled from blocks. Moving them is a breaking change
  for adopters, and is its own decision, not this proposal's.
- **Split and sequence.** The blocks are independent; the review's order still holds (the `State:`
  bug, then 7, 3, 5, then 1 and 2, then 4 and 6, with 8 as documentation at any time). _(Superseded: the second Review's disposition table orders them, with block 5 after block 1.)_

## Out of scope

Each of these is its own record, written after this proposal's review, and none is a precondition
of it:

- **Transitions over history**: a document moved from Draft to Done without passing Ready. Block 5 checks
  a value and its folder at one commit; a transition is a fact about two commits.
- **A drift check** (a document's cited files changed after its "checked" date). Adopters 1 and 3
  both built one; adopter 3 now reports drift as a nudge and blocks only on its reader's faults (a
  shallow clone, a missing date).
- **A branch gate**: a pull request closes a record or says why not, ticks no box on a record it
  leaves open, and a closed record's `Deferred:` count equals its `deferred→` boxes. Adopter 3 built
  it as honesty-at-close applied to a diff, and had to select a stand-in document as its subject,
  which makes its `examined` always 1: eess has no subject for a check over a set of facts.
- **Ledger checks adopter 3 added**: a deferral names a record that exists and is live; a checklist
  box still open cites a live record; record ids are unique across types (the kit's `next-number
--check` covers numbers, not ids). Block 4 may cover the first two; they are recorded separately
  until it does.
- **Defects adopter 3 reports in eess-md, to be reproduced here before they are recorded**:
  `taskItems()` misses nested boxes and `[~]`; `adrEnforcement` does not check its Status vocabulary,
  that a `gated` row cites a mechanism, or that the table has a row; `verifyCitations` reads a dotted
  name such as `it.skip` as a path; `fileIndex` includes untracked files.
- **`corpus()`'s cost.** Adopter 2 measured about 1.4 s for 363 files, almost all of it the syntax-tree
  parse, and `ignore` does not skip the walk its documentation says it does; adopter 3 measured
  5.7 s to build its corpus against 273 ms for its rules.
- **The kit shipping runnable gate scripts** for what exists today (`check:ledger`, `check:corpus`).
- **A declaration helper** (one call describing a kind of document, compiled to the blocks). Not asked:
  if the examples show the same assembly repeated, it may be proposed later, as sugar a caller can
  ignore, never as a model every document must fit.
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

### Asks as first reviewed

The submission's asks as this Review read them, kept here because the asks above were rewritten
after it (PROPOSALS.md: the submission is preserved, not edited away).

> Each ask is generic over Markdown. The examples use three types on purpose: a bug record, a wiki
> page, and the manifesto's workflow specification.
>
> **A. A document type is declared as data, once.** `documentType({ name, select, exempt, title,
fields, sections, relations, states })`: `select` is the folders or name pattern that classify a
> document as this type, `exempt` the files in those folders that are not of it (an index, a board),
> and the remaining keys are B to E. A rule set built from the declarations reports a document that
> two types claim, and, where a folder is declared fully typed, a document no type claims. Every
> other rule in this proposal reads the type from the declaration rather than repeating its folders,
> so no two lists can disagree (gap 5).
>
> ```ts
> const bug = documentType({
>   name: 'bug',
>   select: { folder: 'work/bugs/**', exempt: ['BUGS.md'] },
>   title: /^Bug \d{4} — /,
>   fields: [
>     { name: 'State', required: true, accepts: ['Draft', 'Ready', 'Done', "Won't-do"] },
>     { name: 'Severity', required: true, accepts: ['Low', 'Medium', 'High'] },
>   ],
>   sections: [{ name: /^(Symptom|Problem)$/, depth: 2 }, { name: 'Root cause' }],
> })
> const wikiPage = documentType({
>   name: 'wiki page',
>   select: { folder: 'wiki/**' },
>   sections: [{ name: 'See also', when: 'present', relations: 'wiki page' }],
> })
> ```
>
> **B. A document's fields are elements, read in every form a document uses.** `fields(corpus)`
> selects every field of every document: the label grammar's forms, widened to a heading used as a
> field (`## Label: value`) and to YAML frontmatter keys, read outside fenced code, over the whole
> document. Each element carries its document, its type, label, raw text, normalised value and line,
> and reports its own line. A field spec is data: `{ name, aliases, required, accepts, says }`, where
> `accepts` is a value set or a pattern and `says` is the remedy a finding carries. The normaliser is
> one tested owner, shared with the ledger, chosen per field (a word, a token, an integer, a date).
> The reader is exported as a plain function as well, so a tool that only renders a board reads
> fields the same way as the rule that checks them.
>
> **C. Structure is checked per type, and can depend on a field.** `haveSection` gains an optional
> depth, and `haveTitle` tests the H1; a predicate `docs().that().haveFieldValue(label,
valuesOrPattern)` makes "a fixed bug has a Verification section" one rule; `pointers()` gains
> `areInSection()`, so "this section holds a live code pointer" composes. A type declares these in
> `sections` and `title`, and they are built from the same conditions a hand-written rule uses.
>
> **D. A reference is resolved against the type it names, and a type declares the relationships it
> allows.** A reference is any way one document names another: a link (read today), a reference by
> identifier written as text ("bug 0439", "ADR-020", "proposal 013"), or a wikilink (proposal 015
> owns reading it; this ask consumes what 015 reads). A type declares how its documents are named
> (`bug NNNN`, `ADR-NNN`, a wiki page's title); a reference that names an identifier no document of
> that type holds, or one another type holds, is a finding. `relations` declares what a type may
> refer to under a label or in a section, and what must answer it: "a plan's `Implements` names a
> proposal", "a wiki page's See also names wiki pages", "an ADR's `Extends` is linked back", the last
> being plan 0406's check moved onto the declaration rather than a second mechanism beside it. A
> namespace a corpus cites but does not hold (another project's numbers) is declared as foreign and
> not resolved.
>
> **E. A type's lifecycle is declared, and placement follows it.** `states` names the state field
> (any label, a list of aliases, or the heading form), its vocabulary, which states are terminal, and
> which folder each state lives in, including a folder that is kept but bound to one state.
> `honestyAtClose` reads that declaration instead of its fixed `State:` label and default folders, and
> its state, box and placement checks can each run alone (gap 4). A workflow specification's own
> states and transitions are the same declaration applied to its content rather than its header: a
> type can require that the states its document lists include a terminal one and that every
> transition names a declared state. Whether that second use is one mechanism or two is the
> architect's question.
>
> **F. A view is bound to the documents it lists.** A board or an index is a table whose rows stand
> for documents of a type. A type can declare its views, and the binding is built from `rows()` and
> `correspondence()`, which exist: every live document of the type has a row, every row names a
> document, and a row's state cell agrees with the document's state field. This ask may be met by a
> preset and documentation rather than new mechanism; the review decides.
>
> **G. A public way to build a document from text**, for tests, so a fixture is neither a
> hand-written literal that silently lacks fields nor a temporary directory that makes a suite slow
> (gap 6).
>
> **H. Presets declare types, and this repository uses them first.** The working-method kit ships its
> types (plan, bug, proposal, spike) as declarations built from A to F. The ADR type's declaration
> cites `adrEnforcement` for its table instead of reimplementing it. This repository declares its own
> types, binds `work/plans` and `work/bugs` to the format CLAUDE.md prescribes, resolves its own
> references by identifier, reads `Ruling` and `Implements` through B instead of
> `scripts/lib/proposal-ruling.mjs`'s own reader, or records why it cannot, and binds its boards. The
> first run is in report mode, and its findings are fixed or the declaration corrected one by one,
> never widened to go green.

### Revision after the review — 2026-10-16

The asks were rewritten after this review at the maintainer's instruction (see "Correction —
2026-10-16, after the review"). The dispositions above refer to the asks as first reviewed (kept above, from `d3f1b08d`, when this file was `work/proposals/017-md-a-document-type-has-a-schema.md`).
They map to the blocks as follows. The revised text was then reviewed: see the second Review, whose
disposition table supersedes the one above.

| reviewed ask                          | now                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A — a document type declared as data  | dropped as an ask; a declaration helper is out of scope, at most later sugar                                                                    |
| B — fields                            | blocks 1 and 2, reshaped as the review asked: `terms()` extended, presence on `docs()`                                                          |
| C — structure                         | block 3                                                                                                                                         |
| D1 — references at declared positions | block 4, positions named by the caller                                                                                                          |
| D2 — references in free prose         | still rejected; nothing in free prose is read                                                                                                   |
| E, header half — the ledger's label   | the bug first, then block 5; `honestyAtClose`'s place in eess-md is an open question                                                            |
| E, workflow content                   | still rejected here                                                                                                                             |
| F — views                             | block 8, a recipe                                                                                                                               |
| G — a corpus from text                | block 7                                                                                                                                         |
| H — presets                           | examples in `kit/`, not eess-md exports; completeness is the acceptance criterion                                                               |
| (new)                                 | block 6, a document no selection claims, with an eess-md `notExist`                                                                             |
| (new, at the maintainer's request)    | blocks 9 and 10: elements of every block bind to any dialect through `correspondence()`, and a citation resolves at a position the caller names |
| (new, from the completeness test)     | blocks 11 to 13: a rule per matching section, element rules limited to documents a predicate chooses, a value unique across a selection         |

## Review — 2026-10-16 (second)

**Ruling: Split and sequence**

The revised asks (blocks 1 to 13) were reviewed by four lenses: architect and product returned
"Split and sequence", enforcement "Ship with changes", and the method lens reviewed this record. The
coordinator decided the ruling and the decisions below; each is recorded so it can be overruled.
There is no third design round: what the reviews found are constraints on each block, not a
redesign, so they are recorded here as the conditions a block's plan must meet, and the asks above
are left as reviewed. This ruling supersedes the first Review's disposition table.

**What held.** Both critical findings of the first review are resolved, not reworded: blocks 1 and
2 extend `terms()` and put presence on `docs()`, as proposal 001's review ruled, and the document
type declaration is gone, so ADR-006's config question does not arise. Free prose is not read. The vacuity, per-cause message and remedy criteria absorb the first round's enforcement findings. This round's enforcement review raised two criticals, both taken: a value in a form the caller did not name was reported as absent (the first condition below), and the completeness test had no mechanism (decision 3). Every count the
method lens re-measured reproduced exactly, and every `path:line` pointer lands.

**What the record got wrong, corrected above in place:** the claims that `honestyAtClose` is the one place eess-md fixes a shape and that eess-md ships no document's shape; two survey lines written for the dropped type declaration; block 13's "not stated anywhere" (gherkin
ships `haveUniqueTitles`); block 10's survey line (the crossvalidate presets already take a
position); the pointer to the first-reviewed asks, which named a path that did not exist at that
commit, and the asks themselves, which had been edited away and are now kept above. Also: the
completeness test that found blocks 11 to 13 was a desk exercise over three kinds of document (a
plan, a bug, a wiki page), not the four the criterion names, and produced no artefact; it is not a
measurement. The first Review said the lenses "agree on the substance"; on references they did not
(architect: a spike first; product: its own proposal after proposal 015; enforcement: declared
positions as a gate, free prose as a diagnostic). The record adopted enforcement's position, which
the revised block 4 follows. The first Review also dropped one architect finding, restored here:
any preset built on these blocks takes one `{ report }` option and merges through
`mergeCollectResults` (ADR-008, ADR-014).

### Decisions

1. **The principle is scoped by ADR-006's tiers.** The root of `@nielspeter/eess-md` fixes no
   document shape. The existing presets under `rules/*` (`honestyAtClose`, `adrEnforcement`) stay,
   so no adopter breaks, and owe a rebuild from public root blocks only: today
   `packages/md/src/rules/ledger.ts:12` imports `collectTaskItems`, `labelPattern` and `proseText`
   from `model/` and writes its own conditions, which is what adopters do by hand. New plan, bug or
   wiki shapes ship as examples, never as eess-md exports. Whether the two presets later leave
   eess-md is the maintainer's decision (a break). The principle is binding, so it is written as an
   ADR extending ADR-006, with an arch rule that `rules/*` imports only the md root, before block 5
   relates to `honestyAtClose` and before any default changes.
2. **`corpus()`'s `DEFAULT_FROZEN`** (`packages/md/src/corpus.ts:53`, `completed/` and `archived/`)
   is a document-shape default on the root primitive, and changes what `pointers()` examines (bug
   0253). It is recorded as its own record; removing it reds corpora that relied on it, so it ships
   as a flagged break with a migration line.
3. **Examples live in `examples/`**, run by `check:examples` inside `validate`, not in `kit/`, which
   is the working method's. An arch rule over them forbids constructing any predicate or condition
   (`defineCondition`, `definePredicate`, or a literal with `test` or `evaluate`) and importing
   `@nielspeter/eess/internal`; each example has a clean fixture and a violating fixture per
   judgement it states, and is registered in `check:nonvacuity`. This makes the completeness test a
   gate rather than a claim. Its closing proof is `honestyAtClose` rebuilt from public blocks with
   its fixtures unchanged. `packages/md/README.md` links a worked documentation-site example, since
   npm ships neither folder.
4. **Block shapes, settled:**
   - **4** is composition, not an element: a block-1 value or a block-11 section, joined through
     `correspondence()` (whose `leftAmbiguous` is "names two documents"). A second labelled-value
     reader is what 001's ruling forbids.
   - **9** is documentation: every builder already inherits `.select()`
     (`packages/core/src/rule-builder.ts:195`).
   - **10** exports the test and scenario sides as selections, adds a citation on a labelled line,
     and gives the general form a name without "ADR"; `adrCitationsResolve` becomes a caller of it.
     No third vocabulary for positions.
   - **12** is one md predicate, `inDocuments(p)`, over any element carrying `doc`, used through the
     inherited `satisfy()`; it memoises per document and reports both counts (documents matched,
     elements examined).
   - **13** is a kernel condition (`beUniqueBy`), with gherkin's `haveUniqueTitles` rebuilt on it:
     two dialects ask.
   - **6** needs `notExist` in the kernel: mermaid and six ts builders each carry a copy, and md
     would be the next. It is registered through the internal cardinality marker so it stays
     unforgeable.
   - **11** has one owner with block 3: sections become elements, derived from the same heading walk
     links and tables use, and `haveSection` and `haveTitle` are built on them.
5. **Blocks the walk is still missing**, added as asks: **14** what a section holds (non-empty, a
   code block, a table, a list item, a link); **15** sections in a given order; **16** a value
   agrees with the document's own path (a number in the filename and in the H1). A link's `#anchor`
   resolving is a dependency, bug 0136, as wikilinks are proposal 015. Freshness ("reviewed within
   N days") reads the clock, is Tier 3, and is out of scope.
6. **Tiers.** Every block is Tier 1. Block 10 is Tier 1 because it proves a cited title exists, not
   that the test proves the claim.
7. **Proposal 001.** This proposal takes over 001's header-field ask and its conditional rules
   (generalising what `honestyAtClose` hard-codes); 001 keeps `fileRefs()`, its temporal conditions
   and `clauseEnforcement()`. Noted in 001.

### Conditions every block's plan must meet

From enforcement, beyond the acceptance criteria above:

- A value present in a form or under an alias the caller did not name is its own cause ("found
  `## Status:` at line N; add the heading form, or rewrite it"), never "absent": under no defaults it
  is the commonest cause.
- Block 4: a malformed value is its own cause, separate from one that names nothing; an
  out-of-selection finding shows what the identifier does name; "names two documents" has a row.
- Block 5: a document in a bound folder with no readable value is its own finding.
- Block 12: a predicate selecting no document is a finding naming the predicate; zero elements over
  matched documents is a finding unless declared; a row shows the scoped rule green where the
  unscoped one is red.
- Block 13: values compare through block 1's normaliser (`066` and `0066`), which is also the architect's "exact keys, normalisation is the caller's", since `beUniqueBy` keys on the value block 1 has already normalised; every member of a group
  is named; the denominator is stated (values, not documents).
- Block 11: a heading in a fence or an HTML block, a setext heading, a depth skip, and a heading in a
  list or blockquote (which `buildDocument` does not read as a section) each have a fixture.
- Preconditions: bug 0403, for eess-md and eess-crossvalidate both, before blocks 1, 5 and 10; bug
  0116 (a citation resolving to a skipped test), bug 0262 (only one package's tests are resolved) and bug 0382 (a cited title is not bound to the file cited beside it) before block 10; bugs 0400, 0402 and 0245 are named
  in block 9's recipes as known limits of the join.
- This repository adopts blocks 4 (its `Implements` reader), 5 (its lanes) and 13 (record numbers),
  so those rows drive its own gates, not only fixtures.
- `.expectEmpty()`'s expiry is the kernel's: it lapses once something is examined.

Smaller findings carried to the plans rather than settled here: a plan with no phase section
examining zero sections (a finding, or declared empty); a census of accepted values no document
uses (report-only); a selection of one under block 13; a closed set of section names and ordering
across values (expressible, to be shown in an example, or out of scope); the dependants named for
the frozen-default break (bug 0185); and a frontmatter key's own line.

### Disposition, per block

| ask                                                                      | disposition            | condition                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The `State:`-only silent pass**                                        | **Held**               | Not this proposal's: a bug, reproduced and recorded first. Its fix reds corpora that pass today, so it ships as a flagged break                                                                                                                                                                                                                              |
| **7** — a corpus from text                                               | **Accepted**           | [Plan 0455](../plans/0455-a-corpus-built-from-text.md), filed 2026-10-17                                                                                                                                                                                                                                                                                     |
| **6, 12, 13** — kernel `notExist`, md `inDocuments`, kernel `beUniqueBy` | **Held**               | Ready as shaped in decision 4. Unholds when a plan is filed; moves the kernel (a minor, re-exported per dialect, gated by `check:family`)                                                                                                                                                                                                                    |
| **11, 3, 14, 15** — sections as elements, depth, title, content, order   | **Held**               | Ready as shaped. Unholds when a plan is filed                                                                                                                                                                                                                                                                                                                |
| **1, 2** — labelled values, `haveField`                                  | **Held**               | Unholds when three open questions are decided: the noun (md already says `label` and `term`; block 2 adds `field`), where a value's span ends, and whether a block reads frozen documents. Bug 0403 first                                                                                                                                                    |
| **5** — a value agrees with its folder                                   | **Held**               | After 1 and the ADR in decision 1; `honestyAtClose`'s placement half is then rebuilt on it, so there is one placement check                                                                                                                                                                                                                                  |
| **4, 10, 16** — references, citations, path agreement                    | **Held**               | After 1 and 11; 10 after bug 0116                                                                                                                                                                                                                                                                                                                            |
| **8, 9** — recipes                                                       | **Held**               | Documentation, any time after the blocks they show exist                                                                                                                                                                                                                                                                                                     |
| **The examples and the completeness gate** (decision 3)                  | **Accepted, reshaped** | [Plan 0458](../plans/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md), filed 2026-10-17, built first. Accepted as decision 3's condition on the accepted blocks, not on the maintainer's list (2026-10-18). Reshaped: its closing proof (`honestyAtClose` rebuilt from public blocks) is split off to the rebuild after blocks 1, 2 and 5 |
| **References in free prose**                                             | **Rejected**           | Unchanged from the first Review                                                                                                                                                                                                                                                                                                                              |
| **A document's own states and transitions**                              | **Rejected** here      | Unchanged; proposal 006 and plan 0078 if a consumer arrives                                                                                                                                                                                                                                                                                                  |

### Records owed, outside this proposal

- The `State:`-only silent pass, reproduced.
- `corpus()`'s frozen default (decision 2).
- `matchName` keeps a caller's `g` or `y` flag between documents, in two copies:
  `packages/md/src/model/query.ts:4` and `packages/crossvalidate/src/md-ts.ts:32`. To be reproduced.
- The ADR in decision 1.

## Consumer feedback — 2026-10-16

After the second Review, at the maintainer's request, the three adopters were asked whether the
blocks would be useful: which of their hand-written checks each block would replace, which they
would not adopt, what no block covers, what would be awkward, and which box marks they use. Each
answered from its own code, read-only. They are adopters 1, 2 and 3 as above. Their figures are
their own measurements. The defects they reported were reproduced here and recorded as bugs 0444 to
0447 (PR #230). This section was reviewed the same day (architect · enforcement · method) and their
findings are folded in.

|               | adopter 1                                                                   | adopter 2                                                  | adopter 3                                                                                                           |
| ------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| verdict       | depends, leaning yes                                                        | yes                                                        | yes, as a tidy-up, not a priority                                                                                   |
| code removed  | about 350 of about 1,050 lines (mechanism; its configuration stays)         | about 400 of about 640 lines                               | about 300 rule lines and 100 test lines of about 4,400, plus a real line on every finding (all report line 1 today) |
| blocks wanted | 1, 2, 3, 5, 6, 12, 13, 14, 16, and 11 composed with 12                      | 1, 2, 5, 6, 7, 13                                          | 1, 2, 3, 6, 7, 12, 13, and 14 for one existing rule                                                                 |
| most wanted   | 11 and 12 composed: a box rule limited by a value, inside matching sections | 1, 2, 5, 13 and 7                                          | none named                                                                                                          |
| not adopted   | 4, 8; 7 in tests only                                                       | 3, 4, 8, 11, 14, 16                                        | 4, 5 as specified, 8, 16; 11 and 14 would mostly be new checks                                                      |
| condition     | block 1 takes its own value normaliser; section names take regex groups     | a value's end is the caller's to set; `[X]` counts as done | block 1 reads the bulleted form                                                                                     |

Adopter 3's base of about 4,400 lines is its own count for this answer; the about 9,500 in
"Measured" above was counted earlier over its tooling as a whole, and the two are not reconciled
here. Adopter 2's upgrade to any of this is blocked on bug 0439 (most of the family, eess-md included, does not load under Bun)
until a fixed version ships.

**On defaults.** Adopter 1: "since you ship no defaults, I see nothing we would have to fight".
Adopter 2: none, "as long as `State:` stays ours to rename". Adopter 3 did not address defaults.

**What stays theirs.** Adopter 1 named a rule forbidding derived content on its boards (covered by
composition, below) and a deliberate exemption by identifier. Adopter 2 keeps a check of a record's
"pull request open" claim against the pull request's real merge state (from git and the hosting
service's API) and close dates read from git history. Adopter 3 keeps its drift checks (about 600
lines over git history) and its branch gate. 017 leaves all of these out of scope.

**What it says about block 1.** The forms in real use: adopter 3 counts, live and frozen,
`## Status:` 601 and 536; `**Status:**` 124 and 311; `- **Status:**` or `- **State:**` 28 and 59;
`**Status**:` 0 and 40; `**Status: value**` 0 and 14; frontmatter 0. Adopter 2 indents up to three
spaces. Values: multi-word ("In progress"), followed by prose after `(`, `—`, `–`, `·` or `|`; a
leading or trailing emoji; emphasis inside the value; a typographic apostrophe; a value matched
regardless of case; a value spanning four lines; and a field with several values, each checked
against a vocabulary that allows a prefix. A structured header field must be chosen over the same
label in prose (adopter 3 once read a prose `State:` at line 220 over the header at line 3). Labels
contain spaces. Section names are matched by word stem, so a list of exact names is not enough on
its own.

**What it says about block 5.** Adopter 1 says block 5 "alone removes a whole file", built only
because `honestyAtClose` reads `State:` (bug 0444); adopter 2 has a defect of its own waiting on it.
Adopter 3 runs the check one way on purpose: its frozen records spell "done" about twenty ways, and
requiring a done value flagged ten correctly closed records.

**What it says about checkboxes.** Adopter 3 carries 1,699 `[?]` items (all in frozen records),
10 `[~]` (one in a live record) and 7 `[→]` (none live), and reads them by scanning text. Adopter 1
carries one `[~]`, in an open record, and wants it counted as open or reported, never ignored.
Adopter 2 uses only `[ ]`, `[x]` and `[X]`. eess-md sees only GFM's marks (bug 0445), and this
repository has four `[~]` items in closed records that `check:ledger` does not see. Adopter 1 also
plans a rule that knows which section a box sits in: in a closed record, an open box under an
acceptance-criteria section may carry only `validation-owed`.

**Covered already, or by composition:** an exemption by identifier (the kernel's `.excluding()`,
whose stale entries are findings under ADR-018); an allowlist of known duplicates that warns when an
entry no longer collides (the same); a document that must not contain a table, a count line or a
dated line (block 14 with `not()`, or the kernel `notExist` over `rows()`); uniqueness over a
composite key (block 13's key function). Adopter 3 also has a script that may not import eess at run
time; no block serves it, and it keeps its own reader.

**Reported defects:** `honestyAtClose` reads only `State:` (bug 0444); non-GFM box marks are invisible
(bug 0445); a link to an untracked file resolves (bug 0446); `adrEnforcement` reads `it.skip` as a
path (bug 0447); `adrEnforcement` validates no Status value (bug 0128). A `gated` row with an empty Mechanism cell, or one citing nothing, gets no finding: reproduced here on main's build, and inside bug 0128's scope, since the claim `gated` is the Status value it never reads.
Not reproduced: `taskItems()` missing nested boxes (adopter 3 itself reports this no longer true).
Not recorded: an empty Enforcement table passing, which adopter 3 inferred and did not measure.

### Decisions this settles

The coordinator's, from the feedback, the reviews and the mission; each can be overruled.

1. **The noun is "field": one element, two constructors.** `fields(corpus, FieldOptions)` is new;
   `terms(corpus, TermsOptions)` keeps exactly what it reads today. Both yield one widened element
   type (`MdTerm`, with label, form and normalised value), on one builder. This overrules proposal
   001's heading ("don't add `fields()`") in name only: its design, one element type built on
   `terms()`, stands. Summaries and rule ids use one name.
2. **A value's extent is the caller's, and no reading is hidden.**
   - `fields()` yields every occurrence in every form the caller named, each with its form and its
     own line. The new forms (the heading form, emphasis around label and value, three spaces of
     indent) are opt-in fragments of `packages/md/src/model/label.ts` the caller names, never a
     widening of the shared grammar `honestyAtClose` and `links().areLabelled()` read. The bulleted
     form is already in that grammar.
   - Precedence is one per-document resolver, used by `haveField` and block 5, never a filter in
     the reader. It chooses a structured form over prose. A losing occurrence that disagrees is its
     own finding at its own line; two structured values for one label (agreeing or not) are a
     finding at both lines; and a document in conflict is withheld from dependent rules and
     counted as withheld.
   - The value's end is the caller's normaliser, with a delimiter set and "longest match from the
     allowed values" as exported helpers, neither a default. A multi-line value stops at a line that
     is itself a label in any form, a heading, a blank line or the end of its list item. A
     multi-valued field is split after the extent is cut, one element per value.
3. **Each rule chooses its own documents, frozen or not.** No new block skips frozen documents by
   itself; a caller selects on frozenness with an `isFrozen()` document predicate that ships with
   block 12. A rule's summary counts the frozen documents its selection excluded. `corpus()`'s
   frozen default and `pointers()`'s frozen handling are unchanged until the second Review's
   decision 2 ships.
4. **Block 5 takes a direction**, as the kernel's existing `Direction` type, and **its values are a
   closed set in every direction**: every value read in a bound folder belongs to a declared class
   bound to its folders, or it is a finding ("`Shipped` at line 3 is none of the declared values").
   An unreadable value in a bound folder is a finding of the folder-to-value direction. (The architect would make an unknown value irrelevant in folder-to-value; the closed set in every direction is enforcement's position, adopted because a one-way check over an open set is what hid the unknown spellings.) The summary
   prints the direction chosen. One-way stays available; it is not the remedy for unknown
   spellings, which a closed set reports.
5. **Box marks are the caller's, and an undeclared mark is always a finding** (block 17, bug 0445's
   fix). A mark is defined on the parsed tree: a list item whose first inline is text, not a link,
   starting with `[`, one grapheme, `]` and a space, so `[Foo](x.md)`, `[ref]`, `[WIP]` and `[1]`
   are not marks. The caller declares each extra mark as blocking a close or not. Elements carry
   the mark and its declared state beside `checked`. The finding comes from the `taskItems()`
   builder and `honestyAtClose`, which gains a `marks` option, through the kernel's deduplication of
   configuration findings, so no existing rule stays blind. It reds corpora that carry undeclared
   marks today, this repository's four included: a flagged break naming its dependants.
6. **Boxes by section** (block 18): `inSections(predicate)`, the sibling of block 12's
   `inDocuments`, sharing its owner and memo, lifts a section predicate onto any element by its
   document and line, with no change to any element type. "Under" means any enclosing section.
   It needs block 11's section elements. A section predicate that selects no section is a finding
   naming it, and a box finding names the section it was attributed to.
7. **Blocks no adopter wants (4, 8, 16, and 9, 10, 15, which none mentioned) stay in the proposal**
   for corpora beyond these three, and are not sequenced for them.

**17.** (an ask added here, after the second Review) _Box marks are the caller's._ As decision 5. Acceptance rows: a done
document holding an undeclared `[~]` reds; `- [WIP] x`, `- [1] x`, `- [link](u)` and a defined
`- [ref]` stay green; declaring a mark clears its finding; this repository's four `[~]` lines pass
once its `check:ledger` declares the mark.

**18.** (an ask added here, after the second Review) _Boxes by section._ As decision 6. Acceptance rows: a box under a
`###` beneath the chosen `##` is attributed to it; a box before the first heading and a heading in a
list each have a fixture; a section predicate selecting nothing is a finding.

### The maintainer's acceptance — 2026-10-16

The coordinator proposed accepting "1, 2, 6, 7, 12, 13, block 5 with a direction option, and the
checkbox states", and the maintainer replied "1+2+3", assenting to it with the other two steps.
"The checkbox states" is block 17 here, the coordinator's mapping. Accepted: **1, 2, 5 (with a
direction), 6, 7, 12, 13 and 17**. Not accepted: 3, 14 and 16, which adopters 1 and 3 want, and 18,
adopter 1's most wanted, which also needs 11. Each row moves to `Accepted` in the pull request that
files the plan owning it; until then the second Review's dispositions stand.

**Disposition rows for the accepted set.** These supersede the second Review's "6, 12, 13" row, which
the plan order now splits, and add the new blocks:

| ask                                         | disposition  | condition                                                                                                                                                                                             |
| ------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **6, 13** — kernel `notExist`, `beUniqueBy` | **Accepted** | Block 6: [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md); block 13: [plan 0459](../plans/0459-kernel-beuniqueby-and-gherkins-unique-titles.md); both filed 2026-10-17/18, split at review |
| **12** — `inDocuments`, `isFrozen()`        | **Accepted** | [Plan 0457](../plans/0457-a-rule-limited-to-the-documents-the-caller-chooses.md), filed 2026-10-17                                                                                                    |
| **17** — box marks                          | **Accepted** | [Plan 0454](../plans/0454-box-marks-are-the-callers.md), filed 2026-10-17, bug 0445's fix                                                                                                             |
| **18** — boxes by section                   | **Held**     | Not accepted; after block 11 is planned                                                                                                                                                               |

**Carried to the plans' conditions** (from this section's review, not settled here): a decided
reading for near-GFM spacings such as `[ x ]`; a row showing that block 5's unchosen direction is
not reported; "prose" defined by the caller's named forms and region; `honestyAtClose`'s rebuild
selecting frozen documents explicitly so its fixtures stay unchanged; block 18's three counts
(documents, sections, boxes) and a depth-skip fixture; the normaliser's test shapes, including
emphasis inside a value and a typographic apostrophe.

**Plannable now**, as closable plans, in order: block 7; the kernel `notExist` and `beUniqueBy`
(blocks 6 and 13, with gherkin's `haveUniqueTitles` rebuilt on `beUniqueBy`); block 12 with
`isFrozen()`; block 17 as bug 0445's fix. **Not yet:** blocks 1 and 2 (after bug 0403, as two plans:
the reader, then `haveField` with its resolver); block 5 (after the ADR in the second Review's
decision 1; bug 0444's label option ships before it as a fix).
