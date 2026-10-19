# Plan 0496: sections as elements, so a rule runs inside each matching section

## Status

- **State:** Done — built on maintainer order 2026-10-19, in the pull request that also builds bug
  0502's fix, plan 0505, bug 0507's fix and plan 0503 (see "Build notes"). Written 2026-10-19 from
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md) block 11, as shaped by its
  second Review's decision 4 ("11 has one owner with block 3: sections become elements, derived from
  the same heading walk links and tables use, and `haveSection` and `haveTitle` are built on them")
  and its condition for block 11; revised the same day after PR #247's four reviews (architect,
  enforcement, method, product; see "Review response").
- **Accepted:** block 11 was not on the maintainer's 2026-10-16 list. On 2026-10-19, asked whether
  block 18 is in this release, the maintainer chose **"Include block 18"**. Block 18 needs block 11's
  section elements, so block 11 is accepted as block 18's prerequisite, through that decision. Block
  18 itself is [plan 0503](./0503-in-sections-boxes-by-section.md).
- **Implements:** proposal 017
- **Priority:** Medium — it extends reach. On its own it serves no adopter's most-wanted rule:
  adopter 1's is boxes inside matching sections, which is block 18 (plan 0503), and adopter 3's 51
  records with a `- **State:**` under `## Status` need a named-section region, which is
  [plan 0505](./0505-a-field-read-inside-a-named-section.md). Both are built on this plan's section
  extents, and both are in this release batch.
- **Effort:** Medium. One element type and its per-document index, one builder with three
  predicates and two conditions, the section-name declaration scan moved out of `links()` and
  shared, `haveSection` rebuilt on the index with a `depth` option, `g`/`y` stripped from the
  section matcher, one example, one dogfood rule rebuilt, docs. One pull request.
- **Created:** 2026-10-19
- **Builds after:** [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md) (PR #245,
  merged as `7ef7a1d`; this plan was rebased onto it). It needs from it: `inDocuments` and its
  per-document memo, the `noun` and `scopeDiagnosis` hooks on `CorpusRuleBuilder`, and the section
  predicate on md's root. Also after the naming pull request that lands ADR-023 (forthcoming PR):
  this plan uses the names that ADR gives (`predicateHaveSection`, `predicateHaveField`), and
  renames nothing itself. Also after
  [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md) (built:
  the examples gate). It does not depend on plans 0455 or 0459. It builds without bug 0502's fix,
  but **does not ship in a release without it**: until 0502 lands, `areInSection` reads two walks in
  one package, and ADR-023 clause 3 (restating ADR-017) lets a word's kind differ, never its meaning.

## Problem

"Every section named `Phase N` has a subsection named `Files changed`" is a requirement **per
section**. eess-md can state requirements per document (`docs().haveSection()`), per link, per box,
per row, but a section is not an element: `MdDocument.sections` is a flat list of `{ name, depth,
line }` with no extent, no document and no enclosing headings. So no rule can select sections, and
no condition can be checked inside each one. Adopters rebuild the heading chain by line themselves
(adopter 3 rebuilds the heading chain from `doc.sections` by line, because every enclosing heading
counts, not only the nearest: proposal 017, "Adopter 3's section input — 2026-10-18", lesson 1).

This repository does the same by hand. `check:corpus`'s "a proposal states its acceptance criteria"
reads `d.sections` directly (`statesAcceptanceCriteria`, `scripts/check-corpus.mjs:916-917`, on main
after PR #245), because `haveSection` matches on name alone and proposal 005
once satisfied a name-only rule with a `###` heading inside an appendix.

**Found while planning: the two heading walks disagree.** Decision 4 says sections derive "from the
same heading walk links and tables use". There are two walks, and they read different headings:

- `buildDocument` reads only the root's children (`packages/md/src/model/document.ts:139`), so
  `doc.sections` and every table's `sectionPath` ignore a heading inside a list item or a
  blockquote;
- `collectLinks` recurses (`packages/md/src/model/links.ts:158-160`, `:198`), so such a heading
  enters a link's `sectionPath`, pops the real headings at its depth off the stack, and stays there
  after its container closes.

So `links().areInSection()` both drops links that sit under a real section and selects links outside
the section it names. That is
[bug 0502](../../bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md), High, with both
reproductions. This corpus holds no such heading (measured below), so no verdict here is wrong
today. Sections follow `buildDocument`'s walk, the one `doc.sections`, tables, `haveSection` and
`vocabulary({ fromHeadings })` already share, and that settles what a section is for every reader
except links: a heading inside a container does not start a section. Bug 0502's fix brings links
into line; it is a precondition of plan 0503, not of this plan.

## Measured

Every heading in this repository's corpus, read through eess-md's own `corpus()` (2026-10-19, main
`9675402`, 2.6 s):

```sh
npm run build -w @nielspeter/eess -w @nielspeter/eess-md
node --input-type=module -e "
import { corpus } from '@nielspeter/eess-md'
const c = corpus({ roots: ['work/**/*.md', 'docs/**/*.md', 'adr/**/*.md'] })
const n = { docs: 0, top: 0, setext: 0, skip: 0, inContainer: 0, htmlH: 0, fenceHash: 0 }
for (const d of c.documents()) {
  n.docs++; const lines = d.text.split('\n'); let prev = 0
  for (const s of d.sections) { n.top++; if (!/^ {0,3}#/.test(lines[s.line - 1])) n.setext++; if (prev && s.depth > prev + 1) n.skip++; prev = s.depth }
  for (const k of d.root.children) { if (k.type === 'html' && /<h[1-6][\s>]/i.test(k.value)) n.htmlH++; if (k.type === 'code') n.fenceHash += k.value.split('\n').filter((l) => /^#{1,6} /.test(l)).length }
  const walk = (x, deep) => { if (x.type === 'heading' && deep) n.inContainer++; for (const y of x.children ?? []) walk(y, deep || x.type !== 'root') }
  walk(d.root, false)
}
console.log(n)"
```

| what                                                       | count                                |
| ---------------------------------------------------------- | ------------------------------------ |
| documents                                                  | 523                                  |
| headings at the top level (sections)                       | 5,181                                |
| of them setext (`Title` over `===`/`---`)                  | 0                                    |
| depth skips (a heading more than one level below the last) | 1 (`work/bugs/BUGS.md`, `#` → `###`) |
| headings inside a list item or a blockquote                | 0                                    |
| HTML blocks holding an `<h1>`–`<h6>`                       | 0                                    |
| lines shaped like a heading inside a fenced code block     | 153                                  |

The fence count reads only top-level fences, so it is a lower bound; PR #247's method review counted
fences nested in lists too and also got 153. PR #247's enforcement and method reviews re-ran the
command and reproduced every figure. Every case decision 4's condition names has a fixture below;
this corpus exercises only the depth skip and the fences.

**The block's own example does not hold here.** Over the 72 plans at `9675402` (`work/plans/**`,
the board excluded), 195 sections are named `Phase N`, and **none** has a `Files changed`
subsection. This repository writes a phase's files as a bold label inside the phase, or as one
`## Files changed` section for the whole plan (27 plans). Counted with the extent this plan defines
(to the line before the next heading at the same depth or shallower):

```sh
node --input-type=module -e "
import { corpus } from '@nielspeter/eess-md'
const c = corpus({ roots: ['work/plans/**/*.md'] })
let all = [0, 0], live = [0, 0]
for (const d of c.documents()) { if (/ROADMAP/.test(d.relPath)) continue
  const lines = d.text.split('\n'), hs = d.sections
  hs.forEach((h, i) => { if (!/^Phase \d+/.test(h.name)) return
    let end = lines.length; for (let j = i + 1; j < hs.length; j++) if (hs[j].depth <= h.depth) { end = hs[j].line - 1; break }
    const has = lines.slice(h.line, end).some((l) => /^\s*(- )?\*\*Files/.test(l))
    all[0]++; if (has) all[1]++; if (!d.frozen) { live[0]++; if (has) live[1]++ } }) }
console.log({ all, live })"
```

67 of the 195 phases hold a line that starts with `**Files…` (as a list item or not); 9 of the 34
live ones. Two more hold `**Files` in the middle of a line (69 if those count); PR #247's method
review counted 68 with its own pattern. Whichever pattern, it is a minority, so block 11's example is
not dogfooded: it would be a new convention. A phase's files are a field inside a section, which is
plan 0505's named-section region, not a subsection. The dogfood is the hand-written depth check above
instead.

## Design

### The element

```ts
/**
 * A section: a heading at the top level of a document, and the lines it governs. Named
 * `MdSectionElement`, not `MdSection`, because the released `MdSection` (an entry of
 * `MdDocument.sections`) already holds the plain name; md's other pairs give the element the plain
 * name and the model the suffix (`MdLinkRef`/`MdLink`, `MdTaskItemRef`/`MdTaskItem`).
 */
export interface MdSectionElement extends MdSection {
  readonly doc: MdDocument
  /** The headings that enclose it, outermost first, as `MdTable.sectionPath` and `MdLink.sectionPath` record them. */
  readonly sectionPath: readonly string[]
  /** The last line it governs: the line before the next heading at its depth or shallower, else the document's last line. */
  readonly endLine: number
}
```

- **`MdSection` and `MdDocument` do not change.** The element extends the existing type, so a
  hand-built `MdDocument` literal (an adopter's test fixture) still compiles.
- **What is a section** is exactly what `doc.sections` holds today, one walk:
  - an ATX or setext heading at the document's top level is a section; a setext heading's `line` is
    its text line, not its underline;
  - a heading inside a list item, a blockquote or a footnote definition is **not** a section: it
    cannot govern anything after its container closes, and tables and `haveSection` already read it
    so. Where the section-name scan below or a condition's message can see it, it is named; in
    predicate position outside a builder (`predicateHaveSection` passed to `satisfy()`,
    `inDocuments(…)`) it is dropped with no note, as today;
  - an `<h2>` in an HTML block and a `#` line inside a fence are not headings to mdast, and not
    sections. Neither is named in a finding: 153 heading-shaped lines sit in this corpus's fences, and
    every one is code.
- **Extent.** A section governs from its heading line to `endLine`, both included. A depth skip
  changes nothing: under `## A`, a `#### B` is inside `A` (its `sectionPath` is `[…, 'A']`, with no
  hole) and governs to the next heading at depth 4 or shallower. Content before the first heading is
  in no section. The last section ends at the document's last line, which for a file ending in a
  newline is the line before the empty string `split('\n')` leaves (`'a\n'.split('\n').length` is 2;
  the last line is 1).
- **No object links.** Parent and subsections are not fields. Containment is one helper,
  `contains(section, line)`: `section.line <= line <= section.endLine`. The heading's own line is
  inside its section, which is what `links()` already says of a link in a heading's text
  (`## See [x](y)` carries that heading in its `sectionPath`, `packages/md/src/model/links.ts:158-161`).
  A section's subsections are the other sections it contains. The element stays plain data and the
  document is not a cycle.
- **The index.** `sectionsOf(doc): readonly MdSectionElement[]`, in `packages/md/src/model/sections.ts`,
  internal, memoised in a `WeakMap` keyed on the document object (the same reasoning as 0457's
  `liftToDocument` memo: a corpus document is built once and never mutated, and two corpora with the
  same `relPath` stay apart). Cost: one pass over `doc.sections` with a stack, and one count of the
  text's lines. 5,181 sections here. Beside it, `containedHeadings(doc)`: the headings that sit in a
  container, each named with `headingName()` (`packages/md/src/model/document.ts:88-91`) so its name
  compares equal to a section's, walked only when a finding or the scan needs it. It is a third
  heading walk, diagnostic only.

### The builder

```ts
sections(c)
  .that()
  .areNamed(/^Phase \d+/) // the heading text: a string exactly, or a RegExp, as haveSection matches
  .and()
  .satisfy(inDocuments(resideInFolder('plans/**')))
  .should()
  .haveSubsection('Files changed')
  .check()
```

`SectionRuleBuilder extends CorpusRuleBuilder<MdSectionElement>`, `noun = 'sections'`, each element
located at its heading (`atLine`, `relPath:line`, the house shape). Its `getElements()` is
`corpus.documents().flatMap(sectionsOf)`.

| method                             | phase    | meaning                                                                                                      |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `areNamed(name)`                   | selector | the heading text matches, as `haveSection` matches (one `matchName`)                                         |
| `areAtDepth(depth)`                | selector | the heading level is `depth` (1–6)                                                                           |
| `areInSection(name)`               | selector | some enclosing heading matches, at any depth: `links().areInSection()`'s meaning                             |
| `haveSubsection(name, { depth? })` | both     | after `.that()`, sections that contain a matching section; after `.should()`, every selected section has one |
| `haveTable(options)`               | assert   | every selected section contains a table with the columns                                                     |
| `notExist()`                       | assert   | inherited: each section reported at its heading                                                              |

- **`areNamed`, not `haveNameMatching`.** The family's `haveNameMatching` takes a pattern (eess-ts
  compiles a string into one); a section name is a string matched exactly, or a `RegExp`, as
  `haveSection` has always matched. One word with two string meanings is what ADR-017 forbids.
- **`areInSection` is one factory.** `areInSectionPredicate` (`packages/md/src/predicates/declared-block.ts:47-52`)
  is widened to `<T extends { readonly sectionPath?: readonly string[] }>`, the shape `inSection`
  already takes (`packages/md/src/model/query.ts:17-23`); no second copy in `predicates/section.ts`.
  Until bug 0502 is fixed, `links().areInSection('X')` and `sections().that().areInSection('X')` read
  different walks for a heading inside a container; the docs and the changeset say so in one
  sentence.
- **`haveSubsection` is dual-use by phase**, as `docs().haveSection()` is, so
  `.that().haveSubsection(…)` reads as it does in English instead of being a misplaced condition.
- **The section `haveTable`, and how it differs.** `docs().haveTable({ section, columns })` passes
  when **any** table under a heading of that name has the columns. The section form asserts that
  **every** selected section contains one, which the document form cannot state. The condition
  reuses one columns-match helper with the document form (`packages/md/src/conditions/structure.ts:41-43`),
  not a copy. Its options are `{ columns }`: inside a section rule `section` has no meaning that is
  not already the selection, so passing it is an `ArchConfigError`.
- **Where they live.** The predicates in `packages/md/src/predicates/section.ts` (plus the widened
  `areInSectionPredicate`), the conditions as `Condition<MdSectionElement>` factories in
  `packages/md/src/conditions/section.ts`, the builder in `packages/md/src/builders/sections.ts`:
  model, predicates, conditions, builders.

Scoping by document is `satisfy(inDocuments(p))` (0457), as on every element builder; no folder
methods are added, so there is one way to say it. `.select()` is inherited, so a section is a
`correspondence()` side, which is what block 4 composes with (decision 4).

**The section predicates are not exported from the root here.** Plan 0503 (`inSections`) is the
first caller that needs them standalone, and names them there.

**Accepted slices of blocks 3 and 14** (proposal 017's row records both):

- **Block 3's `depth`** on `haveSection`: this repository hand-writes it today
  (`statesAcceptanceCriteria`), and the section element makes it one option, so the dogfood is a real
  consumer.
- **Block 14's "a table"**, the section `haveTable`: the ask reads "so the existing structure
  conditions apply to each", and the "every section, not any table" judgement above is one that no
  shipped condition states. No adopter has named it; it is accepted as the per-section form of a
  condition that already exists.

The rest of block 3 (`haveTitle`, a live code pointer under a named section), the rest of block 14
(non-empty, a code block, a list item, a link) and block 15 (order) stay held.

### One scan for a section name the rule cannot read

`links().areInSection(name)` already records a declaration and scans the whole corpus for a heading
that misses a string name only by case or spacing, whether or not anything was examined
(`packages/md/src/builders/links.ts:85-106`, `packages/md/src/builders/declaration-findings.ts:63-76`,
`isNearMiss` at `packages/md/src/model/label.ts:113-117`). This plan moves that section half out of
`LinkRuleBuilder` into one helper, `sectionDeclarationFindings`, used by both builders, and extends
it:

- **One registry, in `CorpusRuleBuilder`.** Recording and the merge into `collectViolations`
  (today `packages/md/src/builders/links.ts:139-150`) move into `CorpusRuleBuilder` once, with one
  registry of section declarations keyed by predicate identity, as 0457's `SCOPES` registry
  (`predicates/in-documents.ts`) keys scopes. A builder method records its name; a registered
  factory (plan 0503's root section predicates) records wherever it appears, inside `satisfy()`,
  `and()`, `or()` or `not()`, because the kernel's predicate walk reaches it. A name under `not()` is
  recorded on purpose: the scan is about whether the name exists, not about the rule's polarity.
- **Recorded by:** `links().areInSection()`; `sections()`' `areNamed`, `areInSection` and
  `haveSubsection` (both phases); `docs().haveSection(name, { depth })` when `depth` is given; plan
  0505's `region: { section }`. `docs().haveSection(name)` without options records nothing, so a
  released rule gets no new finding.
- **Reports, once per heading, in two reaches:**
  - **over the whole corpus**, a heading that misses a string name by case or spacing (today's scan,
    unchanged): a misspelling is by definition not selected, so plan 0405 looks everywhere
    (`work/plans/completed/0405-md-select-the-links-a-block-declares.md`);
  - **over the documents the rule can see**, meaning those its document scopes admit (0457's
    `inDocuments` scopes; every document when it has none):
    - a heading of the name (string or `RegExp`) inside a list item, blockquote or footnote: "the
      heading "X" at line N is inside a list item, which does not start a section, so this rule does
      not read it". Recorded by `links()` too only once bug 0502 is fixed: until then a container
      heading **does** scope links, and the note would be false there;
    - for a declaration with a `depth`, a document that has headings of the name only at other
      depths: "X" is at depth 3 (line 41), the rule reads depth 2.

    These two are exact matches, not misspellings: a docs page quoting `> ## Phase 1`, outside a
    rule scoped to `plans/**`, is no evidence the rule missed anything, so it gives no finding.

- **One finding per cause (ADR-009 rule 2).** A condition's finding carries its own note (the
  messages below). The scan skips a heading whose cause is already in a condition finding of the same
  rule, so `- ### Files changed` inside `Phase 1` gives one finding, the condition's, not two; the
  demoted proposal 006 gives one, `haveSection`'s.
- **Evidence.** As for links, the scan examines nothing the rule asserts over, so it never raises
  `examined` and does not merge through `mergeCollectResults`.
- **What it does not see.** A literal predicate built by hand records nothing; `areAtDepth` alone
  names no heading; a document outside the rule's document scopes gets only the case/spacing note.
  The JSDoc says so.

So `sections(c).that().areNamed('Files changed')` over a corpus where one plan writes
`### Files Changed` reds, as `links().areInSection('Files changed')` already does; and a
`> ## Deprecated` in a blockquote of a document the rule can see reds
`sections(c).that().areNamed('Deprecated').should().notExist()`, whose zero examined is otherwise a
pass (ADR-010 §3).

**Why a bold label is not a near miss of a subsection.** The commonest way this repository writes a
phase's files is `**Files changed:**`, a labelled value (blocks 1 and 2), not a heading. Reporting it
from `haveSubsection` would read prose for a heading's job; the rule that reads it is `fields()`
with plan 0505's section region.

### The matcher drops `g` and `y`

`matchName` (`packages/md/src/model/query.ts:4-6`) calls `.test()` on the caller's `RegExp`. With `g`
or `y`, `lastIndex` carries from one heading to the next: `areNamed(/^Phase \d+/g)` over four phase
sections selects `Phase 1` and `Phase 3`, with `examined` 2 and no finding (PR #247's enforcement
review, I1). Per-section `areNamed` is where this bites hardest, so this plan strips `g` and `y` once,
when the matcher is taken (a non-global copy, as `packages/md/src/builders/vocabulary.ts:122` does for
terms). That also fixes md's existing exposure through `hasSection` and `inSection`, which is
[bug 0506](../../bugs/fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md); the
crossvalidate copy stays with that bug, and this plan's ledger disposes the md half of bug 0506's
first box in the same pull request, so the bug is never left half-fixed without a record. The
verdict change (a `g`-flagged `haveSection` now selects every document, so a green rule can red) is
marked `**Breaking:**` in the changeset, with the migration line "drop `g`/`y` from section names;
a rule that skipped documents now reports them", and names eess-md's dependent
`@nielspeter/eess-crossvalidate` (bug 0185).

### Messages, one cause each (ADR-009 rule 2)

```
plans/a.md:12: section "Phase 1" has no subsection "Files changed"
plans/a.md:12: section "Phase 1" has no subsection "Files changed" at depth 3; "Files changed" at line 20 is at depth 4
plans/a.md:12: section "Phase 1" has no subsection "Files changed"; the heading "Files changed" at line 15 is inside a list item, which does not start a section
docs/x.md:30: section "Enforcement" has no table with the required columns (/Clause/, /Tier/)
work/proposals/006-x.md: missing section "Acceptance criteria" at depth 2; it is at depth 3 (line 41)
```

- The near-miss notes come from one helper over the section's extent (or the whole document, for
  `haveSection`): a heading of the name at another depth, and a heading of the name inside a
  container. The note is added; the finding exists without it.
- `haveSection(name)` with no options keeps its message unchanged when no near miss exists
  (`missing section "X"`): the examples and the non-vacuity rows assert it. When a same-named heading
  sits in a container, the note is appended, which is additive.
- An invalid depth (not an integer from 1 to 6) is an `ArchConfigError` at the call, on
  `areAtDepth`, `haveSubsection` and `haveSection` alike: a depth of 7 matches nothing, and a rule
  that cannot fail is the defect ADR-009 names.

### `haveSection` built on the index

- **`haveSection(name, options?)`** (the root condition, and `docs().haveSection()` in both phases)
  reads `sectionsOf(doc)`, with `HaveSectionOptions { readonly depth?: number }`. Without options its
  verdicts are unchanged (the same walk); the option is additive. The section predicate on md's root,
  `predicateHaveSection` under ADR-023 (forthcoming PR), takes the same option.
- **Names.** This plan renames nothing. The family's predicate/condition naming is ADR-023's
  (forthcoming PR): a plain name keeps the kind it was first published as, and a twin of the other
  kind takes `predicate`/`condition` as a prefix, eess-ts's precedent (`predicateNotImportFrom`,
  `conditionResideInFile`). That PR renames the unreleased `haveSectionPredicate` and the root
  `haveField` predicate to `predicateHaveSection` and `predicateHaveField`; every example in this plan
  uses those names.
- **`haveTitle` is not built here.** It is block 3, not accepted. When it is planned it reads
  `sectionsOf(doc)` (the depth-1 sections), so decision 4's "built on them" is one function, and which
  H1 counts when there are two is that plan's question.

### ADR-010, ADR-014 and ADR-021

- **Receipt.** `examined` is the number of sections the rule selected. A rule that selects no section
  gives the kernel's zero-examined finding, with 0457's `scopeDiagnosis` when an `inDocuments` scope
  emptied it; this plan adds no diagnosis override. A plan with no `Phase` section at all is not a
  per-document finding of a section rule: it is `docs().should().haveSection(/^Phase \d+/)`, a
  second rule, composed (017's "smaller findings carried to the plans"), and the docs show the pair.
- **ADR-021.** The section predicates are two-valued: a heading's text, depth and enclosing headings
  are always read. A section is undecided only through a lifted document predicate
  (`inDocuments(predicateHaveField(…))`), and then the kernel reports its cause and never drops it;
  one test pins that the lift works over sections. No `undecided` member is declared here.
- **Empty corpus.** `CorpusRuleBuilder.sourceEmpty()` already outranks every declaration; the
  vacuity matrix gains a `sections` probe that must land in `config-finding`.

### What plan 0503 (block 18) gets

- **the index**, `sectionsOf(doc)` with `endLine` and `sectionPath`, memoised per document object;
- **the lookup**, `contains(section, line)`, heading line included, from which every enclosing
  section of a line follows (017's adopter 3 section input, lesson 1: every enclosing heading counts);
- **the predicates** as `Predicate<MdSectionElement>` factories, which 0503 exports under its names;
- **the section-name scan**, which 0503's scopes record into;
- **its fixtures' answers**: a box before the first heading is in no section; a heading in a list is
  not a section; a depth skip nests.

### Docs: no hand-rolled lift

The README and `docs/markdown.md` section on `sections()` show section rules only. They do not show
`sections().select()` joined to another builder by hand (a literal predicate testing `s.doc` and
`s.line <= line <= s.endLine`): under a `notExist()` rule, a misspelt section name empties that
selection and the rule is green (ADR-010 §3), which is the fake green ADR-009 exists to stop. The
docs name `inSections` (plan 0503) as the form to use for "a rule over the boxes inside matching
sections", paired with its positive guard rule, the two reading the section name from one shared
`const`: there a section name is recorded for the near-miss scan, and a dead section scope is named on
a positive rule, while the guard covers the absence rule. The shared `const` is what makes the guard
work: a typo in it reaches both rules, so the guard reds.

## Phases

### Phase 1: the index and the element

`model/sections.ts`: `sectionsOf`, `contains`, `containedHeadings`, the near-miss helper.
`MdSectionElement` exported. `matchName` drops `g`/`y`. `hasSection`
(`packages/md/src/model/query.ts:9`) reads the index and takes the depth.

### Phase 2: the builder and the scan

`builders/sections.ts` with `sections()` and `SectionRuleBuilder`; `predicates/section.ts`;
`areInSectionPredicate` widened; `conditions/section.ts` with `haveSubsection` and the section
`haveTable` over the shared columns helper. `sectionDeclarationFindings` moved out of
`LinkRuleBuilder` and extended; both builders record into it. `haveSection` and the root section
predicate gain `HaveSectionOptions`; depth validated.

### Phase 3: example, dogfood, docs, release

- `examples/md/each-phase-lists-its-files.test.ts` and its fixtures (below).
- `scripts/check-corpus.mjs`: `statesAcceptanceCriteria` becomes
  `docs(c).that().satisfy(<live proposal>).should().haveSection('Acceptance criteria', { depth: 2 })`
  under the same rule id `corpus/proposal-states-no-acceptance-criteria`, keeping its `because` and
  `suggestion`, and the stale comment above it ("`haveSection` matches on name alone") is rewritten.
  The summary's `N criteria-checked` reads the receipt's `examined`. A string, not the hand check's
  `/^acceptance criteria$/i`: **a deliberate tightening and a convention change** for this
  repository's proposals (sentence case). Its binding reason is the scan: `isNearMiss('Acceptance
Criteria', 'Acceptance criteria')` is true (`packages/md/src/model/label.ts:113-117`), so the two
  live proposals that write it in title case, 001 and 002 (`## Acceptance Criteria`, measured as the
  only two in `work/`, `docs/` and `adr/`), would red the gate; they are changed to sentence case in
  the same PR. A message naming the section instead of a regex source is the secondary gain. After
  that edit, subjects and verdicts are unchanged on this repository (the build states both counts
  before and after); a title-case heading written later is reported as a near miss, with its fix.
- `scripts/check-nonvacuity.mjs`: one row demoting proposal 006's `## Acceptance criteria` to `###`.
- `scripts/vacuity-matrix.mjs`: the `sections` probe.
- Docs: `packages/md/README.md` ("A document's shape" gains the section rule and the composed
  `docs().haveSection()` pair), `docs/markdown.md` ("A document's shape, built from blocks"),
  `MdSection`'s JSDoc says what a section is; the 0502 sentence; no hand-rolled lift (above).
- `.changeset/md-sections.md`.

## Files changed

- `packages/md/src/model/sections.ts` (new)
- `packages/md/src/model/document.ts` (JSDoc only)
- `packages/md/src/model/query.ts`
- `packages/md/src/predicates/section.ts` (new)
- `packages/md/src/predicates/declared-block.ts` (`areInSectionPredicate` widened)
- `packages/md/src/predicates/document.ts`
- `packages/md/src/conditions/section.ts` (new)
- `packages/md/src/conditions/structure.ts` (the shared columns helper; `depth`)
- `packages/md/src/builders/sections.ts` (new)
- `packages/md/src/builders/section-declarations.ts` (new: the scan, moved from `declaration-findings.ts`)
- `packages/md/src/builders/declaration-findings.ts`, `packages/md/src/builders/links.ts`
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts`
- `packages/md/tests/sections.test.ts` (new)
- `packages/md/tests/sections-corpus.test.ts` (new: the differently-derived rows over this repository)
- `examples/md/each-phase-lists-its-files.test.ts` and `examples/md/fixtures/each-phase-lists-its-files/` (new)
- `examples/public-surface.test.ts`
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`, `scripts/vacuity-matrix.mjs`
- `work/proposals/001-md-corpus-rule-coverage.md`, `work/proposals/002-comment-embedded-links.md` (one
  heading's case each)
- `packages/md/README.md`, `docs/markdown.md`
- `.changeset/md-sections.md` (new)

## Test inventory

Every test drives the public entry point (`sections(corpus(…))`, `docs(…)`, `links(…)`) and the
terminal (`.violations()`/`.check()`), over a fixture directory, never a hand-built document.

**Decision 4's condition, one fixture each** (`sections.test.ts`):

- a `## Heading` line inside a fenced code block is not a section;
- an `<h2>` in an HTML block is not a section;
- a setext heading is a section, its `line` the text line and its depth 1 or 2;
- a depth skip (`## A`, then `#### B`): `B` is in `A`, `sectionPath` `[…, 'A']`, `A` has subsection
  `B`, and `haveSubsection('B', { depth: 3 })` reds with the depth note;
- a heading in a list item, one in a blockquote and one in a footnote definition: not sections, not
  in `doc.sections`, named by the section-name scan and by the "missing" note in `haveSubsection`
  and `haveSection`.

**The extent:** text before the first heading is in no section; the last section runs to the last
line of a file that ends in a newline; a link in a heading's text is inside that heading's section
(`contains` at the heading line); two sections of one name are two elements; front matter does not
shift a line.

**A break class per new way to fail**, each red on its corruption and green on the fixed fixture:

| way to fail                                                    | corruption that must red                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| a section lacks a subsection                                   | delete one phase's `### Files changed`                                                     |
| a subsection belongs to the next section (extent overrun)      | `Files changed` only under `Phase 2`: `Phase 1` reds                                       |
| a subsection at the wrong depth                                | `#### Files changed` under `depth: 3`                                                      |
| a subsection that is only a heading in a container             | `- ### Files changed`                                                                      |
| a selected name misspelt in one document                       | `areNamed('Files changed')` with one `### Files Changed` among correct ones: the scan reds |
| a section that must not exist, hidden in a container           | `areNamed('Deprecated').should().notExist()` with `> ## Deprecated`: the scan reds         |
| a container heading outside the rule's document scope          | the same rule scoped to `plans/**`, `> ## Deprecated` only in `docs/x.md`: **no** finding  |
| one cause reported twice                                       | `- ### Files changed` in `Phase 1`: exactly 1 finding (the count asserted, not only text)  |
| a section lacks a table                                        | the table moved to the next section                                                        |
| `section` passed to the section `haveTable`                    | `ArchConfigError`                                                                          |
| a document lacks a section at a depth (`haveSection`, `depth`) | `## Acceptance criteria` demoted to `###` (also the dogfood row)                           |
| a `g`-flagged name skips sections                              | `areNamed(/^Phase \d+/g)` over four phases examines four                                   |
| a rule selects no section                                      | `areNamed` misspelt everywhere: zero-examined, kernel finding, and the scan's near miss    |
| a scope selects no document                                    | `inDocuments(resideInFolder('nope/**'))`: 0457's diagnosis, noun sections                  |
| a depth that cannot match                                      | `areAtDepth(7)`, `haveSubsection('X', { depth: 0 })`: `ArchConfigError`                    |
| a document a lifted predicate cannot judge                     | `inDocuments(predicateHaveField(…))` over a Status given twice: reported, not dropped      |
| a section that must not exist                                  | `notExist()` reports each at `relPath:line` of its heading                                 |

**Unchanged behaviour:** `docs().haveSection(name)` without options keeps its verdicts and, with no
near miss, its message, on the existing tests and examples; the root section predicate likewise.
`links().areInSection()`'s case/spacing findings are unchanged after the scan moves (the existing
plan 0405 rows run as they are).

**ADR-009 rule 5, differently-derived values** (`sections-corpus.test.ts`), over this repository's
corpus:

- `sectionsOf(doc)`'s names, depths and lines equal `doc.sections`, and each `endLine` equals the
  line before the next top-level heading node of equal or lesser depth in `doc.root.children`, read
  from mdast positions rather than from `doc.sections`;
- for every section, `sectionPath` equals the names of the other sections that `contains` its line,
  outermost first, so the two stored forms of enclosure cannot drift.

**The example** (`examples/md/each-phase-lists-its-files.test.ts`), plans under `plans/`:

- `clean/`: two plans, every `Phase N` section with a `### Files changed`; one with a depth skip
  (`#### Files changed`); a `notes.md` outside `plans/` with a bare `## Phase 1` (not selected).
  Asserts zero violations and `examined` equal to the phase count.
- `violating-missing-subsection/`: `Phase 1` has none while `Phase 2` below it has one. Exact message,
  the file, not a configuration finding.
- `violating-heading-in-a-list/`: the only `Files changed` is `- ### Files changed`. Exact message
  with the list note, and exactly one finding.
- `violating-phase-heading-in-a-list/`: one plan writes its second phase as `- ## Phase 2`, so the
  per-section rule cannot see it. The scan's finding names it, exact message.

`check:nonvacuity`'s `examples/md-fixtures-are-load-bearing` row finds the example and swaps its
fixtures both ways; no row is written for it.

**Sabotage matrix**, run in a worktree at build, each red on its named test:

1. `endLine` stops at the next heading of any depth: the clean example and the depth-skip row red.
2. `endLine` is the document's end: the extent-overrun row reds.
3. `sectionsOf` walks every heading, containers included: the list, blockquote and footnote rows red.
4. `haveSection` ignores `depth`: the depth row and the dogfood non-vacuity row red.
5. `areInSection` matches only the nearest enclosing heading: a `###` under `##` under `#`, selected
   by the `#`, reds.
6. The section `haveTable` reads every table in the document: the table-in-the-next-section row reds.
7. The near-miss notes are dropped: the depth and container message rows red.
8. Depth validation removed: the `ArchConfigError` rows red.
9. The index memo keyed on `relPath`: two corpora with the same `relPath` and different headings give
   the first corpus's sections; that row reds.
10. `matchName` keeps `g`/`y`: the four-phases row examines two and reds.
11. `areAtDepth` ignores its argument: a depth-2 selection over depth-2 and depth-3 sections examines
    both; that row reds.
12. `haveSubsection` ignores `depth`: the depth-skip row's `{ depth: 3 }` assertion reds.
13. `sections()` records no declarations: the misspelt-name and hidden-`Deprecated` rows red.
14. `contains` excludes the heading line: the link-in-a-heading row reds.
15. The container and depth notes scan the whole corpus: the out-of-scope row reds.
16. The scan does not skip a cause a condition already reported: the one-cause count row reds.

**Non-vacuity rows** (`scripts/check-nonvacuity.mjs`):

- new: proposal 006's `## Acceptance criteria` demoted to `### Acceptance criteria` makes
  `check:corpus` exit 1 in json and terminal modes, firing
  `corpus/proposal-states-no-acceptance-criteria` on `006`, as `gateCorpusProposalCriteria` does;
- kept: `gateCorpusProposalCriteria` (the section renamed away) must still fire after the rebuild.

## Release

`@nielspeter/eess-md` minor: `sections()`, `SectionRuleBuilder`, `MdSectionElement`,
`HaveSectionOptions`, the `depth` option. `@nielspeter/eess` none. `MdSection` and `MdDocument` are
unchanged. One verdict change, marked `**Breaking:**` in the changeset with its migration line: a
`g`- or `y`-flagged section name now matches every heading it should (bug 0506's md half), so a rule
that skipped documents can now report them; the changeset names `@nielspeter/eess-crossvalidate` as
eess-md's dependent (bug 0185). On 0.x the level stays minor. `links().areInSection()`'s findings are
unchanged: the scan moves, and its container note waits for bug 0502. No published export is renamed
or removed. This plan ships in the same release as bug 0502's fix, or after it, never before.

## Out of scope

- **Block 18, `inSections(p)`:** [plan 0503](./0503-in-sections-boxes-by-section.md), after this plan
  and bug 0502's fix.
- **The heading-walk disagreement** between `buildDocument` and `collectLinks`:
  [bug 0502](../../bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md), its own pull
  request in this release batch. It changes `links().areInSection()` verdicts and gets its own
  release note.
- **A named-section region for `fields()`/`haveField`** (017's consumer follow-up: 51 of adopter 3's
  records): [plan 0505](./0505-a-field-read-inside-a-named-section.md), in this release batch, built
  on this plan's extents.
- **The predicate/condition names**: ADR-023 and its rename (forthcoming PR).
- **crossvalidate's copy of `matchName`**: bug 0506.
- **The rest of block 3**: `haveTitle`, and "a live code pointer under a named section".
- **The rest of block 14** (non-empty, a code block, a list item, a link) and **block 15** (order).
- **Exporting the section predicates from the root**: plan 0503 names them.
- **Adopter 3's other lessons** (017, "Adopter 3's section input — 2026-10-18"): box text beyond its
  first paragraph is bug 0507; a disposition pattern is plan 0503's caller-given `haveTextMatching`;
  exemption keys by text shape 0503's attribution. None is sections'.
- **This repository adopting block 11's example**: measured above, it does not hold here and would
  be a new convention.

## Review response — 2026-10-19 (PR #247)

Four reviews (architect, enforcement, method, product). The coordinator's decisions, recorded so
they can be overruled:

- **Acceptance (method C1).** The earlier text credited the maintainer with asking for block 11. The
  record now quotes the actual decision: asked whether block 18 is in this release, the maintainer
  chose "Include block 18" (2026-10-19); block 11 is accepted as its prerequisite. Block 18 is plan
  0503 in this PR (product C1).
- **Naming leaves this plan (architect I2, I3; product I2, I3; method I3, I4, M4).** ADR-023 and the
  rename land in a separate PR after #245. **Correction:** an earlier revision of this plan said a
  renamed `haveSection`, passed to `.should().satisfy()` beside a second condition, "silently becomes
  a filter and the rule can pass", as a measured fail-open. That was wrong. The kernel records a
  predicate added after `.should()` as misplaced (`packages/core/src/predicate.ts:96-101`), and
  `assertsSomething()` is false whenever one is (`packages/core/src/rule-builder.ts:239-241`), so the
  rule is refused, whatever the condition count. Enforcement measured three such rules, all refused.
  The migration fails closed. The rename was not taken for the other reason the plan gave: it would
  break released conditions for a symmetry no adopter asked for.
- **Architect I1** (one section-name scan): taken, above. **M1** (one `areInSection` factory), **M2**
  (heading line inside its section), **M3** (message unchanged when no near miss), **M4** (conditions
  in `conditions/`, shared columns helper, `section` refused), **M5** (last line), **M6**
  (`headingName`, beside `sectionsOf`), **M7** (the enclosure invariant), **M8** (0502 in 017's
  conditions, its open question narrowed), **M9** (the element's JSDoc), **M10** (counts moved with
  the rename): taken.
- **Enforcement I1** (`g`/`y`): taken, with bug 0506. **I2** (the "never silently absent" claim):
  narrowed, with the scan, a `notExist` break-class row and an example fixture. **I3**: bug 0502's
  drop direction, severity High. **I4**: the correction above. **M1** (sabotage rows 11 and 12),
  **M3** (footnote fixture), **M4** (the dogfood's message and comment), **M6** (the renamed
  predicate in the break-class row), **M7** (the fence count a lower bound): taken. **M2** (the
  diagnosis covers `areNamed` only): the override is gone; the scan reads builder declarations, and
  says what it does not see. **M5** (a bold label as a near miss): recorded why not, above.
- **Method I1** (blocks 3 and 14): the two slices accepted explicitly, with reasons. **I2** (adopter
  3's region): plan 0505. **M1** (67/68): the command and both patterns recorded. **M2** (an old
  #245 head): read at `895c1db`; the changeset edit is gone with the rename. **M3** (an unrecorded
  second script): the sentence is dropped.
- **Product I1** (no hand-rolled lift in the docs): taken. **I4** (the section `haveTable`): its
  difference stated and `section` refused. **M1** (`haveSubsection` dual-use), **M2** (`areNamed`'s
  reason), **M3** (two meanings of `areInSection` until 0502), **M4**, **M5**, **M6**: taken.

### Verify round — 2026-10-19 (PR #247)

The coordinator's settlements, recorded so they can be overruled:

- **The scan's reach (architect N1, enforcement N2, product N2).** The container and depth notes are
  bounded to the documents the rule's document scopes admit; the case/spacing near miss stays
  corpus-wide, plan 0405's precedent. Row: an excluded document's container heading gives no
  finding. Recording and the merge move into `CorpusRuleBuilder` with one registry (architect N1's
  related minor).
- **One finding per cause (enforcement N1).** The condition's finding carries the note; the scan
  skips that cause. A row asserts the count.
- **A dead section scope (architect N2, enforcement N3).** Plan 0503's.
- **Taken minors:** architect M9 (`MdLinkRef`/`MdLink`), N4 (not released without bug 0502's
  fix), N5 (the tightening named as one); method N1 (adopter 3's input now in 017, the quotes
  point at it), N2 (a ledger box disposes 0506's md half), N5 (as architect N5); product N3 (the
  `g`/`y` verdict change marked Breaking, crossvalidate named), N7 (as architect N5). Product N4 and
  N5, method N3, N4, N6, N7, N8 and architect N3, N6, N7 are in plans 0503 and 0505, bugs 0502 and
  0506, and proposal 017.

## Build notes — 2026-10-19

Built on maintainer order 2026-10-19, at `c70b112`. The commits these records name are the ones
rebased onto main at `27e7542` (#251); every sabotage matrix ran before that rebase, on their
originals, with the same eess-md code of this branch and main's older base under it.
Decisions taken against the record, each so it can be overruled:

- **Names.** The build was written against ADR-023's names (`predicateHaveSection`,
  `predicateHaveField`) before #248 merged, by applying #248's hunks for the files it needed. Main
  now carries #248 through #251, so the rebase dropped that commit as already applied.
- **There is no kernel predicate walk.** The plan says a registered factory records "inside
  `satisfy()`, `and()`, `or()` or `not()`, because the kernel's predicate walk reaches it". The
  kernel's combinators return a new object that keeps no reference to its inputs
  (`packages/core/src/combinators.ts`), so the registry (keyed by object,
  `packages/md/src/model/section-declarations.ts`) sees a section predicate only when the rule holds
  it directly, or when `inSections` is handed it directly (plan 0503). Recorded as
  [bug 0512](../../bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md), not fixed:
  both fixes change a public surface. Conditions register the same way, so `haveSubsection` and
  `haveSection` with a `depth` record in the condition phase too.
- **What `docs()` can see.** The plan bounds the container and depth notes by the rule's `inDocuments`
  scopes. A `docs()` rule's elements are documents and it holds no such scope, so its visible
  documents are those its own predicates select, leaving out the predicates that read a section name.
  Without that, the dogfood rule would report every plan with a `### Acceptance criteria`.
- **One wording for the depth note**, `"X" at line N is at depth D`, in `haveSubsection`, `haveSection`
  and the scan; the plan's message block wrote it two ways.
- **The scan's near-miss reason** is the builder's: `links()` keeps "so the links under it are not
  checked" (unchanged), every other builder says "so this rule does not read it".
- **One cause, by identity.** A condition's finding records the heading lines its note names in a
  `WeakMap` keyed on the finding; the scan skips those lines. No message is parsed.
- **Refusals** are `ArchConfigError`s from one `checkDepth`, on `areAtDepth`, `haveSubsection`,
  `haveSection` and `predicateHaveSection`.
- **The section `haveTable`** reads `doc.tables`, which holds top-level tables only, as it always has.
- **The example's `violating-phase-heading-in-a-list`** gives two findings, not one: the listed
  `Phase 2` and the `Files changed` inside the same list item, each a heading the rule cannot read.
- **A title-case heading under `haveSection(name, { depth })`** gives two findings: the document's
  `missing section` and the heading's near miss, on different elements. Measured on proposals 001 and
  002 before their headings were put in sentence case; the near miss carries the fix.
- **Red first.** The tests for the new API were written after the code, so their red is the sabotage
  matrix below, not a run against the unfixed tree. `matchName`'s `g`/`y` fix (bug 0506's md half)
  likewise has row 10 as its red.

**Revised 2026-10-19 (PR #252's enforcement review, I3 and I1).** The verify round settled the
case/spacing near miss as corpus-wide, after plan 0405. Measured on the build, that reported a heading
in a document the rule's own scope excludes (`guide/http.md`'s `## STATUS` on a rule scoped to
`plans/**`) and told its author to rename it. The near miss now reads the documents the rule can see,
like the container and depth notes. No misspelling the rule could select is lost: every document a
scope keeps is visible, and `docs()` leaves its section-reading predicates out of what it can see. The
rows are under `the near miss reads only what the rule can see` in `packages/md/tests/sections.test.ts`.
In the same round a near miss became a condition's note (`haveSection` with a depth, `haveSubsection`,
a field region), cited like the others, so it is one finding, not two.

**Follow-up, recorded 2026-10-19 (PR #252's architect review, M2).** Tables still take their
`sectionPath` from `buildDocument`'s own heading stack (`enterHeading`, `packages/md/src/model/document.ts`),
while links read the section index. The two agree by equivalence, pinned by the row `a link and the
table under one heading report the same sectionPath`, not by construction. One owner would be
`sectionPathAt(doc, table.line)`, at the cost of `buildDocument` depending on `sections.ts`, which
reads the document it builds. Not done here; a later change to either walk should take it. The three
copies of "the sections of a name at a depth" (M3) were folded into `sectionsMatching` in the same
review round.

Measured: `check:corpus`'s acceptance-criteria rule examines 17 live proposals and reports 0, before
and after the rebuild (proposals 001 and 002 put in sentence case first); `check:corpus` 3,990 checks
across 325 documents, 0 violations, 6.4 s. The new non-vacuity row (`corpus/proposal-criteria-depth`,
006's section demoted to `###`) gives exactly one finding,
`missing section "Acceptance criteria" at depth 2; "Acceptance criteria" at line 200 is at depth 3`,
checked by hand before the row was committed.

**Sabotage matrix.** Run 2026-10-19 at `1621af4` (after bug 0502's fix, which row 14 needs: before it,
`links()` did not read `contains`), in this worktree, tree clean before and after: each mutant applied
to one file under `packages/md/src`, the named tests run with `vitest -t`, the file restored by
`git checkout`. 17 rows (the plan's 16 and bug 0502's) in 18.5 s; every row red. `sections` is
`packages/md/tests/sections.test.ts`.

| row | mutant                                                                | red (named test in `sections`)                                             |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | every open section's `endLine` stops at the next heading of any depth | a depth skip nests                                                         |
| 2   | no section is closed: `endLine` is the document's end                 | extent overrun                                                             |
| 3   | `sectionsOf` reads the contained headings as sections too             | a heading in a list item, a blockquote or a footnote definition …          |
| 4   | `hasSection` ignores `depth`                                          | a document lacks a section at a depth                                      |
| 5   | `inSection` reads the nearest heading only                            | areInSection matches any enclosing heading                                 |
| 6   | the section `haveTable` reads every table of the document             | a section lacks a table                                                    |
| 7   | `headingNotes` returns nothing                                        | a subsection at the wrong depth; … only a heading in a container           |
| 8   | `checkDepth` refuses nothing                                          | a depth that cannot match is refused                                       |
| 9   | the index memo is a `Map` keyed on `relPath`                          | two corpora with the same relPath                                          |
| 10  | `stateless` returns the caller's `RegExp`                             | a g-flagged name examines every section                                    |
| 11  | `areAtDepth`'s test is `() => true`                                   | a setext heading is a section                                              |
| 12  | `subsectionsOf` ignores `depth`                                       | a depth skip nests                                                         |
| 13  | `declarationFindings` returns nothing when the noun is `sections`     | a selected name misspelt …; a section that must not exist, hidden …        |
| 14  | `contains` excludes the heading line                                  | a link in a heading's text is inside that heading's section                |
| 15  | the container and depth notes read every document                     | a container heading outside the rule's document scope …                    |
| 16  | the scan starts with no cited line                                    | … only a heading in a container: one finding; … lacks a section at a depth |

Bug 0502's row is recorded on that bug. The matrix script and its output are this session's scratch
files; the mutant column is written so a row can be rebuilt.

## Progress ledger

- [x] Phase 1: `sectionsOf`, `contains`, `containedHeadings`, the near-miss helper
      (`headingNotes`), `MdSectionElement`, `matchName` without `g`/`y`
- [x] Phase 2: `sections()` with three predicates and two conditions; the shared section-name scan
      in `CorpusRuleBuilder`; `haveSection`'s `depth`
- [x] Phase 3: the example, the dogfood rebuild with its subjects and verdicts unchanged (17, 0), the
      non-vacuity row, the vacuity probe, docs, changeset
- [x] Sabotage rows 1–16, each red on its named test; 18.5 s with bug 0502's row
- [x] Bug 0506: its first box's md half done-otherwise here (row 10, and the bug's own row in
      `sections.test.ts`); its crossvalidate half was fixed in #251, so the bug is closed in this
      pull request, its last box deferred to bug 0511 as #251 left it
- [ ] `check:corpus`, `check:nonvacuity`, `check:vacuity`, `check:examples`, `check:family`,
      `check:release` and `npm run validate` green — validation-owed: `npm run validate` runs once,
      at the pull request's final head; its exit, duration and SHA are in the pull request's
      description, and CI gates the merge
- [x] Close: this plan → `completed/`; ROADMAP and proposal 017's row

Deferred: none
