# @nielspeter/eess-md

Architecture testing for a **Markdown corpus** — the Markdown dialect of the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family. _Specifications you can run._

A repo's markdown (docs, ADRs, plans) should stay honest: cross-links resolve, code pointers point at real lines, and — if you use them — ADRs declare how they're enforced. `eess-md` validates all of that on the shared [`@nielspeter/eess`](https://www.npmjs.com/package/@nielspeter/eess) kernel, so you write a declarative rules file, not a custom validator script.

## Install

```bash
npm install -D @nielspeter/eess-md
```

## Example

Neutral, universal conventions — a `docs/**` corpus, English headers, and the default frozen set
(`**/completed/**`, `**/archived/**`):

```typescript
import { corpus, docs, links, pointers } from '@nielspeter/eess-md'

// `frozen` omitted: the default freezes `completed/` and `archived/` folders
// (historical: links still checked, pointers not)
const c = corpus({ roots: ['docs/**'] })

// markdown-to-markdown links resolve
links(c).that().areInternal().should().resolve().check()

// `path:line` code pointers ground against real files
// (resolves by unique path-suffix: `admin/index.vue` matches the one file
//  ending with it. A bare name matching SEVERAL files is a violation naming
//  the candidates — it identifies none of them. Pass `{ paths: 'exact' }` to
//  require full repo paths instead.)
pointers(c).that().areLive().should().resolve().check()

// documents have the sections/tables they should
docs(c).that().resideInFolder('docs/adr/**').should().haveSection('Context').check()
```

`docs()`, `links()`, and `pointers()` are entry points on the same fluent
`.that().should().check()` chain as every other eess dialect — with `.because()`,
`.warn()`, `.excluding()`, and baseline mode all working unchanged.

## What did the corpus actually load?

A green rule over an empty corpus is the failure mode this project exists to catch, so
`corpus()` will tell you what it found. The returned `Corpus` is inspectable, not just
something you pass to a builder:

```typescript
import { corpus } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })

// Every document the globs matched, parsed — the denominator behind your rules.
for (const d of c.documents()) {
  console.log(d.relPath, d.frozen ? '(frozen)' : '', `${d.sections.length} sections`)
}

console.log(c.documents().length) // 0 here means the globs matched nothing, not that all is well
console.log(c.root) // repo root the globs, links and `path:line` pointers resolve against
console.log(c.fileIndex.size) // every file under that root — what link/pointer resolution searches
```

Each `MdDocument` carries `relPath`, `file`, `frozen`, `text`, `sections`, `tables`,
`codeBlocks` and the raw mdast `root`, so a one-off question about the corpus is a loop,
not a new rule.

Two things worth knowing:

- **`frozen` documents are loaded, not skipped.** They appear in `documents()` with
  `frozen: true`; it is the rules that treat them as history. So `documents().length` is
  the total, and `documents().filter((d) => !d.frozen).length` is what a gate will fail on.
- **`root` defaults to `process.cwd()`**, which is why a gate run from a subdirectory
  silently resolves a different set. If a corpus comes back smaller than you expect, print
  `c.root` first.

`@nielspeter/eess-gherkin`'s `features()` returns the same shape of answer — `root`,
`features()` and `scenarios()` — for the same reason.

To test a rule without a directory on disk, `corpusFromText({ 'docs/a.md': '# A\n', … })` builds the
same `Corpus` from a map of path → text, resolving links and pointers as `corpus()` does
([docs](https://github.com/nielspeter/eess/blob/main/docs/markdown.md#a-corpus-from-text-for-tests)).

## Binding a spec table to code: `rows()` + `correspondence()`

A markdown table is a **spec** — a package list, an ADR index, a field
reference. `rows()` turns its body rows into first-class elements, and
`.select()` (inherited from the kernel, on every eess builder) turns any
selection into one side of a `correspondence()`. Bind a table to what it
describes and drift in either direction fails the build:

```typescript
import { corpus, rows, correspondence } from '@nielspeter/eess-md'

const c = corpus({ roots: ['README.md'] })

// each body row of the "Packages" table becomes a selectable element
const packageRows = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ }, // role → header pattern
}).select({
  label: 'README package row',
  identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
})

// `workspacePackages` is a plain Selection you build from the filesystem —
// keyBy omitted: it defaults to each side's own identify().name
const workspacePackages = {
  elements: [] as { name: string }[],
  label: 'workspace package',
  identify: (p: { name: string }) => ({ name: p.name }),
}

correspondence({ left: packageRows, right: workspacePackages })
  .should()
  .beComplete({ direction: 'both' }) // every row has a package AND vice versa
  .because('the README package table must not drift from the workspace')
  .check()
```

A row carries `get(role)` (the located cell text), its real source `line`, and
back references to its `doc` and `table`. Rows are drawn from **every** table
that matches the section and columns — a correspondence source never silently
ignores a second matching table. Cell text is flattened (bold/links become
plain text); a link's URL is not recoverable from a row, so verify link targets
with a `links()` rule alongside.

`direction: 'both'` is doing two jobs: left-to-right catches a table row with no
package (a _lying_ spec), and right-to-left catches a package with no row
(_unclaimed_ code — coverage). Drop to a single direction when you only want
one. Coverage is the same "gate on declaredness" move the ADR `## Enforcement`
table makes, pointed at code.

## The ADR gate is an opt-in, opinionated preset

`@nielspeter/eess-md/rules/adr` ships `adrEnforcement()`, which implements **one
specific methodology** — the EESS enforcement-tier model (a `## Enforcement`
table with tier + mechanism + status). Most teams' ADRs (MADR, Nygard) have none
of that, and **you don't need it to get value from `eess-md`** — links, pointers,
sections, and tables all validate through the generic primitives above. Reach for
`adrEnforcement()` only if your ADRs follow the tier model; otherwise compose your
own gate from `haveSection` / `haveTable` / `haveTableRowsSatisfying` / `resolve`.
The same goes for a citation form the preset does not know — a rule id in your
own architecture tool, cited in a Mechanism cell: `rows()` over that column into
a `correspondence()` against the set you hold, both directions. The docs page's
"Citing something that is not a file or a test" section is the worked recipe.

```typescript
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

// section+table present, valid tiers, cited paths exist. A cited it('…') title is not
// checked here — run eess-crossvalidate's adrCitationsResolve for that.
adrEnforcement(c, { dir: 'docs/adr/**' })
```

An index/schema doc in the ADR directory (`README.md` or `index.md`) is exempt —
it isn't an ADR, so it isn't required to carry an `## Enforcement` table.

## A document's shape

eess-md defines no document shape. A rule about what your plans, bugs or pages must hold is built from
the blocks above in your own words; [the Markdown dialect's docs](../../docs/markdown.md#a-documents-shape-built-from-blocks)
show one, and [worked examples](https://github.com/nielspeter/eess/tree/main/examples/md) with passing and failing fixtures are in eess's repository.

## Inside each section: `sections()`

A requirement that holds per section, not per document, is a rule over `sections(c)`. Each heading not inside a list
item, blockquote or footnote, at any depth, is an element (`MdSectionElement`): its `name`, `depth` and `line`, the headings
that enclose it (`sectionPath`), and `endLine`, the line before the next heading at its depth or
shallower (else the document's last line). A section holds its heading line and every line to
`endLine`, its subsections included; a depth skip nests (`#### B` under `## A` is in `A`).

```ts
import { corpus, docs, inDocuments, resideInFolder, sections } from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['**/*.md'] })

// Every phase of a plan has a `Files changed` subsection.
sections(c)
  .that()
  .areNamed(/^Phase \d+/)
  .and()
  .satisfy(inDocuments(resideInFolder('plans/**')))
  .should()
  .haveSubsection('Files changed')
  .check()

// A plan with no phase at all is not a finding of a section rule: it is a second rule.
docs(c)
  .that()
  .resideInFolder('plans/**')
  .should()
  .haveSection(/^Phase \d+/)
  .check()
```

| method                             | phase    | meaning                                                                           |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `areNamed(name)`                   | selector | the heading text matches: a string exactly, or a `RegExp`, as `haveSection`       |
| `areAtDepth(depth)`                | selector | the heading level is `depth` (1 to 6)                                             |
| `areInSection(name)`               | selector | some enclosing heading matches, at any depth: what `links().areInSection()` reads |
| `haveSubsection(name, { depth? })` | both     | after `.that()`, sections holding one; after `.should()`, every section holds one |
| `haveTable({ columns })`           | assert   | every selected section holds a table with the columns                             |
| `haveContent()`                    | both     | the section holds a block after its heading (not a heading, a rule or a comment)  |
| `haveCodeBlock({ lang? })`         | both     | it holds a code block, tagged `lang` in any letter case when given                |
| `haveListItem()`                   | both     | it holds a list item, at any depth                                                |
| `haveLink()`                       | both     | it holds an inline link                                                           |
| `haveCodePointer()`                | both     | it holds a code pointer (that it is live is a `pointers()` rule)                  |
| `notExist()`                       | assert   | each selected section reported at its heading                                     |

`docs().haveTable({ section, columns })` passes when any table under a heading of the name has the
columns; `sections().haveTable({ columns })` asserts it of every selected section, and refuses a
`section` option. `haveSection(name, { depth })` (the condition, `docs().haveSection()` and
`predicateHaveSection`) counts only a heading at that level. A depth that is not 1 to 6 is refused.

What a section holds is read from its heading through its last line, subsections included, so a
block in the next section never counts, and a link or pointer in the heading's own text is the
section's, as `inSections` places it. A document's title is `docs().haveTitle(name?)`: its first
heading not inside a list item, blockquote or footnote, which must be at depth 1, and match `name`
when given (a string exactly, or a `RegExp`); a document with no heading, or whose first heading is at
depth 2, is a finding saying which, and a depth-1 heading written inside a container is named. A
front-matter `title:` is not read: a site whose pages keep their title there has no title to this
condition. A live code pointer under a named section is three rules reading one `const`:

```ts
import { corpus, docs, inSections, pointers, sections, sectionsNamed } from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['adr/**/*.md'] })
const ENFORCEMENT = 'Enforcement'

// The document holds the section: the two rules below see nothing of a document that lacks it.
docs(c).should().haveSection(ENFORCEMENT).check()
// The section holds a pointer: a pointer rule alone is green on a section that has none.
sections(c).that().areNamed(ENFORCEMENT).should().haveCodePointer().check()
// Each pointer in it is live.
pointers(c)
  .that()
  .satisfy(inSections(sectionsNamed(ENFORCEMENT)))
  .should()
  .resolve()
  .check()
```

**What is not a section.** A heading inside a list item, a blockquote or a footnote definition does
not start one: it cannot govern anything after its container closes. Neither does an `<h2>` in an HTML
block, nor a `#` line in a fence. A rule does not read past such a heading silently: a condition's
finding names it (`section "Phase 1" has no subsection "Files changed"; the heading "Files changed" at
line 15 is inside a list item, which does not start a section`), and so does the section-name scan.

**The section-name scan.** Every section name a rule reads (`areNamed`, `areInSection`,
`haveSubsection`, and `haveSection` with a `depth`) is scanned whatever the rule examined: a heading
that misses a string name only by case or spacing, a heading of the name inside a container, and, for a
name read at a depth, a document that has it only at other depths, each in the documents the rule can
see: those its `inDocuments` scopes admit (for `docs()`, those its own predicates select). A heading in
a document the rule's scope excludes is never its to correct. A `notExist()` rule over a section hidden in a
blockquote is therefore red, not green. What the scan does not see: a predicate you build by hand; a name with no near miss
(`'Acceptence'`) on an absence rule; a name given as a `RegExp`, which states its own tolerance and
turns the near-miss note off (so each user picks their own case); the `haveSection(name)` condition without a `depth`, which records nothing (it names a near miss in its own
finding instead), so a released rule gains no finding of the scan's; a `## Status` inside a fence or an
`<h2>` in an HTML block, which is not a heading to the parser and gets no note. `haveContent()` counts
any block that is not a heading, a thematic break or an HTML comment, so a link-reference definition or
a lone `<br>` is content. A section name's `RegExp` may carry `g`
or `y`; it is read without them.

**Do not join sections to other elements by hand.** A predicate testing `s.doc` and a line range, fed
from `sections().select()`, is green under `notExist()` when the section name is misspelt, and the scan
never sees it. Limit a rule over boxes or links to matching sections with `inSections`.

## Inside matching sections: `inSections`

`inSections(p)` lifts a section predicate onto any element on a line of its document (a box, a link,
a pointer, a row, a term, a field), through `satisfy()`, the way `inDocuments` lifts a document
predicate. An element is under every section that contains its line, so a box under `### Detail`
inside `## Acceptance criteria` is under both. The section predicates for it are on the root:
`sectionsNamed(name)`, `sectionsAtDepth(depth)`, `sectionsInSection(name)` and
`sectionsWithSubsection(name, { depth? })`, the `sections()` methods of the same meaning.
`predicateHaveTextMatching(re)` selects the elements whose `text` matches your pattern; on `taskItems()`,
`haveTextMatching(re)` is the method, and it is
also a condition, every selected box's text must match. A box's text is all of its own content, its
second paragraph and plain sub-bullets included, its nested boxes excepted. eess-md fixes no words:
you pass your own.

```ts
import {
  corpus,
  docs,
  predicateHaveTextMatching,
  inDocuments,
  inSections,
  not,
  predicateHaveField,
  sectionsNamed,
  taskItems,
} from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['plans/**/*.md'] })

// Each name and pattern is bound once, and the rule and its guard both read it.
const CLOSED = predicateHaveField({ label: 'Status', forms: ['bold'], oneOf: /^(done|closed)$/i })
const ACCEPTANCE = /^Acceptance criteria$/i
const VALIDATION_OWED = /\bvalidation-owed\b/

// In a closed record, an open box under the acceptance criteria may carry only validation-owed.
taskItems(c)
  .that()
  .areOpen()
  .and()
  .satisfy(inDocuments(CLOSED))
  .and()
  .satisfy(inSections(sectionsNamed(ACCEPTANCE)))
  .and()
  .satisfy(not(predicateHaveTextMatching(VALIDATION_OWED)))
  .should()
  .notExist()
  .check()

// The guard: some closed record has the section. The condition repeats the selection on purpose.
docs(c).that().satisfy(CLOSED).haveSection(ACCEPTANCE).should().haveSection(ACCEPTANCE).check()
```

A finding names the section it was attributed to, the innermost selected one, in its message:
`plans/1.md:12 should not exist (under "Acceptance criteria", line 5)`. Not in its element, so
`.excluding()` and a baseline keep their keys when a rule gains a section scope.

**The guard reads the same `const`.** On a positive rule a section scope that selects nothing is
named (`inSections(are named "…") selected none of the corpus's N sections in M documents`), and a
live one that holds none of the selected elements gives its three counts. On `notExist()` an empty
scope is green, as an absence rule over nothing is (ADR-010 §3). Two things stand in front of that: the
section-name scan reports a heading that misses a string name by case or spacing, and the guard reds
when no document has the section. A guard works only when it reads the rule's own `const`: a typo in
the `const` reaches both, and the guard reds; a literal copied into each can be misspelt in one.

**What stays silent, plainly.** Under `notExist()`, a section name with no near miss by case or spacing
(`'Acceptence'`) and no guard beside it is green; so is a pattern that selects (`haveTextMatching` in
front of `notExist()`) when it is misspelt, or the notation drifts from it, since no scan exists for
text. A pattern used to exclude (`not(predicateHaveTextMatching(…))`) fails closed. A guard on a selecting
pattern is a rule of the same tautology shape over the same elements. A section predicate wrapped in
`not()`, `and()` or `or()` inside `inSections` is not seen by the section-name scan.

**One document drifting is a second guard's.** The existence guard reds when no document has the
section; it stays green when one record writes `## Acceptence criteria` and another the right
spelling, and the drifted record's boxes are never judged. Where every selected document carries the
section, add the per-document guard, reading the same `const`:
`docs(c).that().satisfy(CLOSED).should().haveSection(ACCEPTANCE)`. Where the convention does not hold
(some documents legitimately lack the section), nothing catches a drifted heading in one of them
unless it misses the name only by case or spacing.

## Scoping a rule to documents: `inDocuments`

A note on names first. A plain name on this package's root keeps the kind it was first published as:
`haveSection` is the condition, and `resideInFolder` the predicate. Where a word is needed in the other
kind, the twin carries the prefix: `predicateHaveSection`, and `predicateHaveField` beside the
`docs().haveField()` method, and `predicateHaveTextMatching` beside `taskItems().haveTextMatching()`.
A free predicate over an element other than the builder's own subject is named element-first
(`sectionsNamed`), so a lift reads `inSections(sectionsNamed('X'))`. (eess-ts's plain names lean the
other way.)

Every element that belongs to a document (a box, a link, a pointer, a row, a term, a code block)
carries it, and `inDocuments(p)` lifts a document predicate onto them, through `satisfy()`. `areLive()`
and `areFrozen()` read the `frozen` globs you pass `corpus()`, or, when you pass none, its default
(`**/completed/**`, `**/archived/**`), so a page under `completed/` is not live
unless you pass `frozen` yourself; `predicateHaveSection(name)` is the
predicate form of `haveSection` (the bare name is the condition). A rule over boxes in the live pages that have a `Verification` section, and its
guard:

```ts
import {
  areLive,
  corpus,
  docs,
  predicateHaveSection,
  inDocuments,
  taskItems,
} from '@nielspeter/eess-md'

const SECTION = 'Verification'
// your archive folder; while it holds no page, also pass expectEmptyFrozen: ['archive/**']
const c = corpus({ cwd: process.cwd(), roots: ['**/*.md'], frozen: ['archive/**'] })

// The ratchet: no open box in a live document that has the section.
taskItems(c)
  .that()
  .areOpen()
  .satisfy(inDocuments(areLive()))
  .satisfy(inDocuments(predicateHaveSection(SECTION)))
  .should()
  .notExist()
  .check()

// The guard: its scope is not empty. notExist() does not check a section name; this does.
// The condition repeats the selection on purpose: the rule fails only when nothing is selected.
docs(c)
  .that()
  .satisfy(areLive())
  .haveSection(SECTION)
  .should()
  .haveSection(SECTION)
  .rule({ id: 'in-documents/verification-guard' })
  .check()
```

**A `notExist()` rule does not check that its scope matches anything.** If the heading is renamed in
the documents, or the name misspelt, the ratchet's scope matches no document and the rule stays
green: an absence rule over nothing is satisfied (ADR-010 §3, ADR-018 C3). The guard is what catches
it. Its condition repeats its selection, so it fails only when nothing is selected; the apparent
simplification `.that().satisfy(areLive()).should().haveSection(SECTION)` is a different, stronger
claim (every live document has the section). `.expectNonEmpty()` on the ratchet does not do this
job: in eess-md a `notExist()` rule that declares it can never be green, since it reds on every
element it examines and on examining none. (eess-ts reports that combination as a finding of its
own.) A scope built from `resideInFolder` or `resideInFile` is different: a broken glob
(`inDocuments(resideInFolder('/work/**'))`) is reported on an absence rule exactly as the bare
predicate is on `docs()`. `areFrozen()` and `areLive()` carry no glob; `corpus()` judges the
`frozen` globs it is given instead, and refuses one that can never match (`frozen: ['/archive/**']`)
or that marks none of the documents it loaded (bug 0499), unless it is named in `expectEmptyFrozen`.
Writing the default list out makes it yours, and it is judged; the omitted default is not.

**On a positive rule a scope that matched nothing is named.** `links(c).that().satisfy(inDocuments(
predicateHaveSection('Verificaton'))).should().resolve()` reds with `inDocuments(have section
"Verificaton") matched none of the corpus's N documents`, and a live scope whose documents hold none
of the elements the rest of the rule selects says `the scopes matched K of N documents, and they hold
none of the M links the rest of this rule selects`. Declare `.expectEmpty()` if that is expected; the
declaration lapses the first time the rule examines an element.

**Compose inside the scope.** `inDocuments(or(p, q))` and `inDocuments(not(p))` keep the scope one
of the rule's own predicates, so a dead one is named; `or(inDocuments(p), inDocuments(q))` still
reds, with the generic zero-examined finding. A scoped side of `correspondence()` built with
`.select()` holds only the scoped documents' elements; when the scope matches nothing, the
correspondence's own empty-side finding speaks, with no scope named.

A document the predicate cannot judge (`predicateHaveField` over a Status given twice) leaves its elements
undecided: each cause is reported once, and the elements are neither kept nor dropped. The one
asymmetry: `pointers(c).that().areFrozen()` is a method; everywhere else it is
`.satisfy(inDocuments(areFrozen()))`.

## Box marks beyond `[ ]` and `[x]`

GFM reads three box marks: `[ ]`, `[x]` and `[X]`. Any other mark is yours to declare, open (it
blocks a close, like `[ ]`), done (like `[x]`), or unjudged: neither, on purpose, so no close rule
judges it (bug 0525). Declare them once and pass the same object to every rule that reads boxes:

```ts
import { corpus, taskItems } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

// [→] is a box moved to another record: unjudged, never done, since a move is not a verification.
const marks = { '~': 'open', '→': 'unjudged', '?': 'unjudged' } as const
const c = corpus({ cwd: process.cwd(), roots: ['work/**'] })

taskItems(c, { marks }).that().areOpen().should().notExist().check()
honestyAtClose(c, { marks })
```

A box whose mark no one declared is reported as `md/undeclared-box-mark`, once per document and mark,
naming every line. A near-GFM box (`[ x ]`, `[x]done`, or a `- [ ]` with no text) is
`md/malformed-box`, one per box; `marks` cannot clear it. Both are configuration findings:
`.excluding()` cannot hide them, and they fail a `.warn()` rule. A rule reports such a box only when
its predicates could have reached it, read as open or as done.

An unjudged box is not open, so `honestyAtClose` does not ask it for a disposition, and it is not done,
so it does not count as finished work. `areOpen()` and `areChecked()` do not select it; it is still an
element, so a rule selects it by its mark (`t.mark === '?'`, that mark only) or by
`t.state === 'unjudged'` (every mark declared unjudged). Only a declaration makes
a mark unjudged: an undeclared one stays a finding.

A rule never sees an unread box: a `taskItems()` element's `state` is only `'open'`, `'done'` or
`'unjudged'`. To select an undeclared box, test `t.mark`. Not a box at all: an undeclared letter or digit (`[o]`,
`[1]`), a link or a defined reference (`[ref]`), a bracket escaped (`\[`) or in inline code, and a box
in a blockquote. A mark that is also a link definition's label (`[~]: url`) is read as a link
reference, not a box. A correspondence side built with `.select()` drops unread boxes without a
finding.

## A record named by a link: `mentions()`

`mentions(corpus, { pattern })` selects every match of your pattern in a document's text, inline code
included, and `beLinked()` reports each one that is not in a link. The pattern and the keys are
yours; nothing about records is built in. Not to be confused with `links().beLinkedBack()`, which
checks that a link's target links back.

```ts
import { corpus, mentions } from '@nielspeter/eess-md'

mentions(corpus({ roots: ['docs/**'] }), { pattern: /\bRFC\s+(?<n>\d+)\b/g })
  .should()
  .beLinked()
  .check()
```

`beLinked()` decides presence: a link that points somewhere is linked, wherever it points; `[x]()`
and `[x](#)` are not. Each mention's `link` carries its `text` and its `target` (where it resolves,
as `resolveLink` says), so a `correspondence()` between your mentions and your records can check that
a link opens the record it names, with `areInTitleLinks` taking out a link whose text is its target's
title. `beLinked({ fix })` gives a plain mention a fix, applied by `eess-ts check --fix --apply`,
when exactly one record holds its key and no other project is named around it. See
[the guide](https://github.com/nielspeter/eess/blob/main/docs/markdown.md) for the join, the fix,
the keys that let a record name itself, and what a mention rule cannot see.

## Every page claimed once: `notExist()`

Every builder over a corpus (`docs`, `links`, `mentions`, `pointers`, `rows`, `terms`, `taskItems`, and
`codeBlocks`) has `.should().notExist()`: each selected element is a finding at its own line. Two
absence rules state that a folder's pages each belong to exactly one of your selections:

```ts
import { and, corpus, docs, haveNameMatching, not, or, resideInFolder } from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['guides/**'] }) // its only root: a typo is an empty source
const howTo = resideInFolder('guides/how-to/**')
const reference = resideInFolder('guides/reference/**')
const tutorial = haveNameMatching(/^tutorial-/)

// Every page is claimed by a selection.
docs(c)
  .that()
  .satisfy(not(or(howTo, reference, tutorial)))
  .should()
  .notExist()
  .check()

// No page is claimed by two.
docs(c)
  .that()
  .satisfy(or(and(howTo, reference), and(howTo, tutorial), and(reference, tutorial)))
  .should()
  .notExist()
  .check()
```

The second rule grows with the square of the selections (three pairs for three). It also guards
the first: a selection widened to match everything claims every page twice.

A `notExist()` rule cannot tell a folder that names nothing from a ratchet that holds. Load the
folder as the corpus's only root, as here, so a typo is an empty source: a corpus that loaded no
document is reported, and `.expectEmpty()` cannot declare it away. Two shapes this does not
protect:

- **A folder named in `.that()` over a wider corpus.** `resideInFolder('gudies/**')` over
  `roots: ['**/*.md']` is green when no `gudies/` exists anywhere.
- **A glob that names nothing in the repository** is green on an absence rule, wherever it is
  written: it is also what a holding ratchet looks like.

What is reported on an absence rule that examined nothing, for each glob a selector declares: a
glob that can never match a path relative to the corpus's `cwd` (a leading `/`, a `../`, or a `./`
after the first segment; a leading `./` works); a glob that names Markdown files the corpus did not
load (outside its `roots`, or excluded by its `ignore`); and a `\` written as a path separator.
`docs()` and `terms()` declare the globs of their own `resideInFolder`/`resideInFile`. On
`codeBlocks()` only the glob's text is judged. `links()`, `pointers()`, `rows()` and `taskItems()`
have no location method: a predicate you pass to `satisfy()` is judged only when it declares its
glob (`globs: globNode({ glob, kind: 'file-path' })`); one that does not is never reported. A glob is matched with
picomatch, which reads `\` as an escape: `guides\**` that selects nothing while `guides/**`
selects files is reported as a separator. To name a literal `*` or `?` in a file name, write `[*]`
or `[?]`.

`resideInFolder`, `resideInFile` and `haveNameMatching` are on this package's root for
`satisfy()` and the combinators. eess-ts has the same names for its own elements, matched against
absolute paths (`'**/guides/**'`); here a glob is relative to the corpus's `cwd` (`'guides/**'`).

## No two pages share a value: `beUniqueBy()`

`docs(c).should().beUniqueBy(key, what)` states that no two selected documents share `key`'s value.
Every member of a group is a finding at its own line, naming the others, so excluding one member
does not hide the group. Values compare exactly (`066` and `0066` differ): normalise in `key`.
Select away a document without a value with `.that()` first.

For a value under a label (an Id, a number in a `**No:**` line), use the same method on `fields()`:
`fields(c, { label: 'Id', forms: ['bold'] }).should().beUniqueBy((f) => f.value, 'Id')` reports each
occurrence at its own line. [The Markdown dialect's docs](../../docs/markdown.md#unique-values-beuniqueby)
cover both forms.

```ts
import { corpus, docs } from '@nielspeter/eess-md'

const c = corpus({ cwd: process.cwd(), roots: ['guides/**'] })
const slug = (d: { relPath: string }): string => d.relPath.replace(/^.*\/|\.md$/g, '')

// `guides/a/install.md` and `guides/b/install.md` would publish at one URL.
docs(c).should().beUniqueBy(slug, 'slug').check()
```

## A labelled value: `fields()`

`fields(corpus, { label, forms })` reads a value such as `Status` in the forms your corpus writes:
`bold` (`**Status:** v`), `heading` (`## Status: v`), `bold-line` (`**Status: v**`) and `plain`
(`Status: v`). There is no default form. `.should().resolveAgainst(vocabulary | RegExp)` checks the
value, and a label your rule's selection writes with markup it does not read is reported, as is a
value that is empty after cutting. `region` bounds where it reads: `'header'`, or
`{ section: 'Status' }`, the body of every `## Status` section, so a feedback register of
`**Status:**` items elsewhere in the record is not part of the question.
`cleanValue`, `untilDelimiter` and `longestOf` cut a value. [The Markdown dialect's docs](../../docs/markdown.md#a-labelled-value-fields)
cover the region, multi-line values and the findings.

`docs(c).that().haveField({ label, forms, oneOf? })` selects the documents whose value resolves (and
is allowed); `.should().haveField(...)` asserts every selected document has it. One value per
document: a structured form beats plain prose, and two structured values are a conflict. A document
whose value cannot be read (a conflict, a form the rule does not read, a value outside the header,
an empty value, a value after a code fence that never closes) is reported in either position. As a
selector, a document with no field at all, or a misspelt label (`**Satus:**`), is left out like any
document the filter does not keep: pair the selector with a `.should().haveField({ label, forms })`
rule over the same documents, which reports it, and with `fields(...).resolveAgainst(...)` for a
misspelt value.

`predicateHaveField(options)` is `haveField` exported as a predicate, for `satisfy()` and `not`/`and`/`or` (and
`inDocuments(predicateHaveField(…))` lifts it onto a document's boxes or links). A document whose value cannot be read is **undecided**
(ADR-021): the rule neither keeps nor drops it, but reports the cause once, as a finding no
`.excluding()` or `.warn()` removes, wherever the rule's verdict depends on it. `.select()` over an
undecided document throws, naming the cause, since a selection has no way to report it.

`docs(c).should().agreeWithFolder({ field, groups, direction, normalize? })` says a document's value and
its folder agree: each group binds its values to its folders (one group may bind `'rest'`), and the
values are a closed set within the bound folders: a value no group names, in a folder a group binds,
is reported as a misspelling. Add a `'rest'` group to close the set everywhere. `direction` is the kernel's `Direction` with the value on the left and the folder on the
right (write the arrow beside it: `direction: 'right-to-left', // folder → value`). It is required,
unlike `correspondence()`'s, because adopters split between one way and both. A document in no
group's folders whose value is in no group is not this rule's: bind its folder, add a `'rest'` group,
or pair the rule with `fields(...).resolveAgainst(...)`. A resolved value's side findings (prose that
disagrees) are reported by every rule that reads the field. An agreement that selected documents
and judged none is its own finding, which no suppression removes: it read no value (a misspelt
label, the wrong forms or region), or every selected document sits in no group's folders with a
value no group names (declare those values in a `'rest'` group).
[The Markdown dialect's docs](../../docs/markdown.md#a-value-agrees-with-its-folder-agreewithfolder)
have the direction table and every finding.

## Custom conventions (localization, project-specific lifecycle)

Everything project-specific is configuration, not a fork — column headers match
by pattern (non-English works), and frozen folders are globs. Each glob you pass must mark a
loaded document, or be named in `expectEmptyFrozen` while its folder is empty. Removing it instead
is not safe: a record filed there later is read as live, and a rule over the frozen documents never
sees it. Writing the default list out makes it yours, and it is judged; the omitted default is not.

```typescript
const c = corpus({
  roots: ['work/**', 'docs/**'], // plans live under work/
  // this tree's closed records sit in completed/ and delivered/; wont-do/ holds none yet
  frozen: ['**/completed/**', '**/delivered/**', '**/wont-do/**'],
  expectEmptyFrozen: ['**/wont-do/**'], // expires once a record is filed there
  ignore: ['node_modules/**', '.git/**', '.nuxt/**'],
})

adrEnforcement(c, {
  section: /durchsetzung/i,
  columns: { tier: /tier/i, mechanism: /umsetzung/i, status: /status/i }, // German headers
})
```

## Code blocks that parse: `parseCodeBlocks()` + `codeBlocks()`

Check every fenced block of one language with a parser you name. eess-md owns the loop and the
evidence, and never loads a parser itself. `parseCodeBlocks(corpus, { language, parser })` is the
one async call; `codeBlocks(parsed).should().parse().check()` is an ordinary synchronous rule over
what it parsed. A parser names itself and declares canaries it must reject, and every way it can
fail (a throw, a hang past its budget, a malformed or missing verdict, a canary it accepts) is one
unsuppressable finding, never a pass. The port and the failure table are in
[the Markdown dialect's docs](../../docs/markdown.md#code-blocks-that-parse).

## `@nielspeter/eess-md/internal` is not API

| Specifier                      | What it is                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `@nielspeter/eess-md`          | The public API — the corpus, the builders, the presets. A change to it is a versioned change.                                       |
| `@nielspeter/eess-md/internal` | Family plumbing: `proseText`, the one reader of a document's prose the family shares, so nothing hand-rolls a fence regex. Not API. |

You want the root. `/internal` exists so the family's other markdown readers —
`@nielspeter/eess-crossvalidate`, and this repo's own gate scripts — can read prose the way this
dialect reads it, rather than keeping a copy that disagrees with it (bug 0287). It is published because
npm has no way to ship a package-private module. Nothing there is documented beyond its own JSDoc, the
package barrel does not re-export it, and it changes without migration notes. The kernel's
`/internal` says the same thing for the same reason; see
[ADR-011](https://github.com/nielspeter/eess/blob/main/adr/011-the-kernels-public-api-is-explicit.md).

## License

MIT
