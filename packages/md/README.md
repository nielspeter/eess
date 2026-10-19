# @nielspeter/eess-md

Architecture testing for a **Markdown corpus** — the Markdown dialect of the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family. _Specifications you can run._

A repo's markdown (docs, ADRs, plans) should stay honest: cross-links resolve, code pointers point at real lines, and — if you use them — ADRs declare how they're enforced. `eess-md` validates all of that on the shared [`@nielspeter/eess`](https://www.npmjs.com/package/@nielspeter/eess) kernel, so you write a declarative rules file, not a custom validator script.

## Install

```bash
npm install -D @nielspeter/eess-md
```

## Example

Neutral, universal conventions — a `docs/**` corpus, English headers, a minimal frozen set:

```typescript
import { corpus, docs, links, pointers } from '@nielspeter/eess-md'

const c = corpus({
  roots: ['docs/**'],
  frozen: ['**/completed/**', '**/archived/**'], // historical: links still checked, pointers not
})

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

const c = corpus({ roots: ['docs/**'], frozen: ['**/archived/**'] })

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

## Scoping a rule to documents: `inDocuments`

A note on names first. A plain name on this package's root keeps the kind it was first published as:
`haveSection` is the condition, and `resideInFolder` the predicate. Where a word is needed in the other
kind, the twin carries the prefix: `predicateHaveSection`, and `predicateHaveField` beside the
`docs().haveField()` method. (eess-ts's plain names lean the other way.)

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
predicate is on `docs()`. `areFrozen()` and `areLive()` are not: nothing checks the `frozen` globs
`corpus()` takes, so a broken one (`frozen: ['/archive/**']`) leaves an absence rule over
`inDocuments(areFrozen())` green, and on a positive rule the finding names the predicate, not the
`frozen` option.

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
blocks a close, like `[ ]`) or done (like `[x]`). Declare them once and pass the same object to every
rule that reads boxes:

```ts
import { corpus, taskItems } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const marks = { '~': 'open', '→': 'done' } as const
const c = corpus({ cwd: process.cwd(), roots: ['work/**'] })

taskItems(c, { marks }).that().areOpen().should().notExist().check()
honestyAtClose(c, { marks })
```

A box whose mark no one declared is reported as `md/undeclared-box-mark`, once per document and mark,
naming every line. A near-GFM box (`[ x ]`, `[x]done`, or a `- [ ]` with no text) is
`md/malformed-box`, one per box; `marks` cannot clear it. Both are configuration findings:
`.excluding()` cannot hide them, and they fail a `.warn()` rule. A rule reports such a box only when
its predicates could have reached it, read as open or as done.

A rule never sees an unread box: a `taskItems()` element's `state` is only `'open'` or `'done'`. To
select an undeclared box, test `t.mark`. Not a box at all: an undeclared letter or digit (`[o]`,
`[1]`), a link or a defined reference (`[ref]`), a bracket escaped (`\[`) or in inline code, and a box
in a blockquote. A mark that is also a link definition's label (`[~]: url`) is read as a link
reference, not a box. A correspondence side built with `.select()` drops unread boxes without a
finding.

## Every page claimed once: `notExist()`

Every builder over a corpus (`docs`, `links`, `pointers`, `rows`, `terms`, `taskItems`, and
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

## A labelled value: `fields()`

`fields(corpus, { label, forms })` reads a value such as `Status` in the forms your corpus writes:
`bold` (`**Status:** v`), `heading` (`## Status: v`), `bold-line` (`**Status: v**`) and `plain`
(`Status: v`). There is no default form. `.should().resolveAgainst(vocabulary | RegExp)` checks the
value, and a label your rule's selection writes with markup it does not read is reported, as is a
value that is empty after cutting.
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

## Custom conventions (localization, project-specific lifecycle)

Everything project-specific is configuration, not a fork — column headers match
by pattern (non-English works), and frozen folders are globs:

```typescript
const c = corpus({
  roots: ['work/**', 'docs/**'], // plans live under work/
  frozen: ['**/completed/**', '**/delivered/**', '**/wont-do/**', '**/archived/**'],
  ignore: ['node_modules/**', '.git/**', '.nuxt/**'],
})

adrEnforcement(c, {
  section: /håndhævelse/i,
  columns: { tier: /tier/i, mechanism: /mekanisme/i, status: /status/i }, // Danish headers
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
