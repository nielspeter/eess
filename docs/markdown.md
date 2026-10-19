# Markdown dialect — `eess-md`

Architecture testing for a **Markdown corpus** — the Markdown dialect of the [eess](/) family. Same kernel, same fluent DSL, applied to your docs instead of your code.

A repo's markdown — docs, ADRs, plans — should stay honest: cross-links resolve, code pointers point at real lines, and (if you use them) ADRs declare how they're enforced. `eess-md` validates all of that declaratively, so you write a rules file instead of a bespoke validator script.

## Install

```bash
npm install -D @nielspeter/eess-md
```

## Example

```typescript
import { corpus, links, pointers } from '@nielspeter/eess-md'

const c = corpus({
  roots: ['docs/**'],
  frozen: ['**/completed/**', '**/archived/**'], // historical: links still checked, pointers not
})

// markdown-to-markdown links resolve
links(c).that().areInternal().should().resolve().check()

// `path:line` code pointers ground against real files
pointers(c).that().areLive().should().resolve().check()
```

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

`corpus()`'s argument is `CorpusOptions`: `roots` (required), `frozen` (as
above), and two more worth knowing about — `ignore` and `cwd` (the repo root
`roots`/`frozen`/`ignore` resolve against — the same thing `c.root` reports
back, and defaults to `process.cwd()` as the second bullet below explains).

A root that matches no file, or only ignored files, while another root loads is refused with an
`ArchConfigError` that names it: a mistyped root would otherwise drop its documents without a word
(bug 0465). A root that is empty on purpose, such as a lane with no records yet or a test fixture that
writes only the folder its rule reads, is named in `expectEmptyRoots`. That declaration expires: once
the root loads a document, it is refused until you remove the name (bug 0475). A test fixture that
builds a shared multi-root corpus can pass `ROOTS.filter((r) => r !== populatedRoot)`.

`ignore` is narrower than it sounds, in three ways worth knowing before you rely
on it. It is a **glob over repo-relative file paths**, so a bare directory name
(`ignore: ['drafts']`) matches nothing and reports nothing — write
`'**/drafts/**'`. It is applied **after** the filesystem walk and only decides
which `.md` files become documents, so ignored files still appear in `fileIndex`:
links and `path:line` pointers still resolve into that folder, and
`vocabulary({ fromFolders })` still derives terms from it. And it is **not**
merged with the built-in walk exclusions (`node_modules`, `.git`, `dist`,
`coverage`, `.output`, `.nuxt`, `.vercel`, and the rest of `BUILTIN_IGNORE`) —
those two are separate mechanisms that never see each other.

`sections`, `tables`, and `codeBlocks` are themselves typed: `MdSection`
(`name`, `depth`, `line`), `MdTable` (`header`, `rows`, `rowLines` — one real
source line per body row, parallel to `rows`, so a table finding cites the
exact row — `line`, and `sectionPath`, the enclosing heading names outermost
first), and `MdCodeBlock` (`lang`, `value`, `line`; every code block at any depth, one in a list item or a
blockquote included, in document order). Every `line` is 1-based
and comes from the real mdast position, not a derived offset.

Two things worth knowing:

- **`frozen` documents are loaded, not skipped.** They appear in `documents()` with
  `frozen: true`; it is the rules that treat them as history. So `documents().length` is
  the total, and `documents().filter((d) => !d.frozen).length` is what a gate will fail on.
- **`root` defaults to `process.cwd()`**, which is why a gate run from a subdirectory
  silently resolves a different set. If a corpus comes back smaller than you expect, print
  `c.root` first.

`@nielspeter/eess-gherkin`'s `features()` returns the same shape of answer — `root`,
`features()` and `scenarios()` — for the same reason.

## A corpus from text, for tests

To test a rule without a directory on disk, build the corpus from text. `corpusFromText(files)`
takes a map of repo-relative POSIX path → text: the documents, and any other file a link or
pointer names. It returns an ordinary `Corpus`, so every builder, condition and preset takes it.

```typescript
import { corpusFromText, links, pointers } from '@nielspeter/eess-md'

const c = corpusFromText({
  'docs/guide.md': '# Guide\n\nSee [setup](./setup.md) and `src/app.ts:2`.\n',
  'docs/setup.md': '# Setup\n',
  'src/app.ts': 'export const a = 1\nexport const b = 2\n',
})
links(c).should().resolve().check()
pointers(c).that().areLive().should().resolve().check()
```

It is `corpus()` with the walk swapped out, so links and pointers resolve as they would over the
same files on disk; a parity test over this package's own fixture trees holds that (plan 0455). The
options, `TextCorpusOptions`, are `corpus()`'s, with two differences: `roots` defaults to every `.md` key in the map, and
there is no `cwd`. `frozen` keeps its default, so a document under `completed/` is frozen here too.
A pointer's target is in the map or it is not there: the text corpus never reads your real code.
`root` (what each document reports in `file`) defaults to `/__eess_text_corpus__`.

What cannot behave as on disk is refused with an `ArchConfigError`, never silently different:

- **a waiver directive in a loaded document** (`<!-- eess-exclude … -->`): the kernel reads waivers
  from the file on disk, so here it would not apply. A directive inside a fenced code block, which
  the kernel does not read as one, is accepted. Test waivers with `corpus()` over a fixture;
- **a key that is not one repo-relative path**: absolute, with `..`, `./` or `\`, or not
  normalised (`a//b.md`);
- **a key that is also the directory of another** (`a` beside `a/b.md`);
- **a key under a directory `corpus()` never walks** (`node_modules/`, `.git/`, `dist/`, …);
- **a `root` that exists on disk**.

An empty map loads no documents, as `corpus()` over an empty tree does, and a rule over it gets the
empty-source configuration finding, which outranks `.expectEmpty()`. A rule meant to pass on "no
matching documents" needs at least one document in the map, so that the source is not empty and
the selection is.

## What it checks

- **Links** — internal cross-links between markdown files resolve to real targets. Static-site conventions are supported (extensionless links, `index.md` directories, a site root) via options on `.resolve()`.
- **Pointers** — inline `path:line` references (the code pointers you scatter through plans and ADRs) point at files that exist, at lines that exist. Liveness is fence-aware, so example pointers inside code blocks aren't treated as live claims. A pointer resolves by path suffix by default, so `admin/index.vue:2` finds the one file whose path ends that way; a **bare name matching several files is a violation** naming the candidates, because it does not say which one you meant. Pass `{ paths: 'exact' }` to require full repo-relative paths instead.
- **Frozen roots** — completed/archived docs describe the world as it was. Their links are still gated; their pointers are not examined at all, so pointer drift in them is neither reported nor fatal. To get a report, select them explicitly: `pointers(c).that().areFrozen().should().resolve().warn()`.

### Sanctioning a finding, and why a table cell cannot

A finding you mean to keep is waived with an exclusion comment — the family
mechanism, documented in [Violation reporting](./violation-reporting.md):

```markdown
<!-- eess-exclude corpus/pointers-resolve: illustrative, not a live claim -->

An example pointer: `src/example.ts:12`
```

**Two things bite here specifically, and eess now tells you about both.**

A directive covers only the **next line**. A GFM table puts every cell on one
physical line, so a directive written inside a cell covers the next _row_ — never
the finding beside it. It is well-formed, correctly spelled, and does nothing.
eess reports it rather than leaving you to guess.

The region form works around a table:

```markdown
<!-- eess-exclude-start corpus/pointers-resolve: dated citations, not live -->

| Rule | Pointer           |
| ---- | ----------------- |
| a    | `src/moved.ts:12` |

<!-- eess-exclude-end -->
```

Note the cost: wrapping a whole table waives that rule for **every row in it**,
which is coarser than the one row you meant. There is no finer instrument today.

The second: an exclusion matches a finding **by rule id**, so a chain that never
calls `.rule({ id })` has nothing to match and no directive can apply to it. eess
says so, and names the file and lines it found directives on.

## Documents, links, pointers, and task items

`docs()`, `links()`, `pointers()`, and `taskItems()` are peer entry points — each
returns its own rule builder (`DocsRuleBuilder`, `LinkRuleBuilder`,
`PointerRuleBuilder`, `TaskItemRuleBuilder`), all on the same
`.that().should().check()` chain:

```typescript
import { corpus, docs, links, pointers } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })

// DocsRuleBuilder — .that() predicates filter documents (resideInFolder,
// resideInFile, haveNameMatching); haveSection is dual-use, a predicate
// before .should() and a condition after it.
docs(c).that().resideInFolder('docs/adr/**').should().haveSection('Context').check()

// LinkRuleBuilder — element type MdLink (url, text, line, external, doc).
// .resolve() takes LinkResolveOptions for static-site conventions.
links(c)
  .that()
  .areInternal()
  .should()
  .resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })
  .check()

// PointerRuleBuilder — element type MdPointer (path, startLine, endLine,
// raw, line, doc). .resolve() takes PointerResolveOptions.
pointers(c)
  .that()
  .areLive()
  .should()
  .resolve({ paths: 'suffix', externalRoots: ['../legacy-repo'] })
  .check()
```

`links()`'s elements are `MdLink` — every `[text](url)` occurrence, with `.doc`
pointing back to its `MdDocument`. `.areInternal()`/`.areExternal()` split on
whether the URL carries a scheme; `LinkResolveOptions` (`tryExtensions`,
`tryIndex`, `rootDir`, `resolveDirectories`) is what makes `.resolve()`
understand a static site's routing instead of only a repo-hosted one.

`pointers()`'s elements are `MdPointer` — every `path.ext:line[-end]` citation
in prose (fenced/indented code is excluded, per "What it checks" above).
Besides `paths` (`'suffix'` vs `'exact'`), `PointerResolveOptions.externalRoots`
lets a pointer ground against a directory outside this repo (a legacy codebase
a traceability matrix cites) instead of only the corpus's own file index;
`presentExternalRoots(roots)` — the subset of those roots that actually exist
on disk — is what a caller uses to report that scope honestly in a gate's
summary line rather than silently skipping unreachable pointers.

`taskItems(c)` — a peer of `docs()`/`links()`/`pointers()` — builds a
`TaskItemRuleBuilder` over the corpus's GFM task-list items (`- [ ]` /
`- [x]`). Its elements are `MdTaskItem` (`checked`, `text`, `line`, `doc`);
`.areOpen()` and `.areChecked()` filter on the box state. The underlying
extraction, `collectTaskItems(root)`, returns the doc-less `MdTaskItemRef`
(`checked`, `text`, `line`) that `MdTaskItem` adds `doc` to — a task item
inside fenced code or a blockquote is excluded for free — but by two different
mechanisms, worth knowing if you ever debug a box that vanished. Fenced code is
never a `listItem` in mdast at all, so it costs nothing. A blockquote **does**
produce a `listItem`, and `collectTaskItems` skips it deliberately with an
`inBlockquote` flag — a guard that exists, not an absence. It's the primitive `honestyAtClose`'s
ledger reconciliation is built from (see "Ledger reconciliation" below), and
is exported for a caller who wants task items without going through the
corpus builder chain.

### Selecting the links a block declares: `areLabelled` and `areInSection`

A record often declares a relation in one place — a `**Related to:**` line, a
`## See also` section — and the rule is about those links only, not every link
in the document. Two selectors on `links()` pick them out:

```typescript
// Every link a "Related to" label declares must resolve.
links(c).that().areLabelled('Related to').should().resolve().check()

// Every link under a "See also" heading (and its sub-headings) must resolve.
links(c).that().areInSection('See also').should().resolve().check()
```

**`areLabelled(label)`** matches the label exactly, case included, in any of
four forms: `**Label:**`, `**Label**:`, `__Label__:` and plain `Label:`. The
colon is required in every form, so prose that merely begins with the word is
not a declaration. The label is read at the start of a block's content, so it
may follow a list marker (`-`, `1.`), a task box (`[ ]`) or a blockquote `>`.

A link is declared under the label when it sits in the label's **block** or
below it: the paragraph or list item the label opens (a wrapped second line
included), that item's nested lists, and — when the label stands alone on its
line — every list directly after it. A list after an intervening paragraph is
not under the label, and a label with a link of its own does not take the list
that follows it.

The nearest label decides. Walking outwards from the link, the first block that
is the declared label, or that opens with a wrapped label of its own, settles
it. A plain line that is not the label — `bug 0402: [b](b.md)`, `Notes:`, a URL
— settles nothing, so an annotated item stays in its declaration and a
`**Related to:**` item under an intro such as `Metadata:` is still read. A
different wrapped label inside the declaration (`- **Supersedes:** [s](s.md)`)
takes its links out of it, and is reported.

**`areInSection(name)`** selects the links under a heading named `name` — a
string matched exactly, or a `RegExp` — at any depth beneath it, until the next
heading of the same or a shallower depth.

A declaration the selector cannot read selects nothing, and a rule over an empty
selection would otherwise be quiet about it. So a rule built with either
selector also reports what it cannot read, as findings on the rule:

- a wrapped label (`**Related To:**`, `**Related  to:**`) that differs from the
  declared one only in case or inner spacing. The plain `Label:` form is never
  reported this way — prose beginning "related to:" is common — so a plain
  `Related To:` is the one misspelling the rule does not catch;
- a different wrapped label inside the declaration, which takes the links under
  it out of the declaration;
- the label, exact or near, where no block starts — later in a paragraph,
  mid-line, in a table cell or in a heading — where it declares nothing; or at
  a block's start in a form it does not read (`**_Related to:_**`, a whole line
  in bold);
- a declaration, in any form, holding reference-style links (`[text][ref]`),
  which eess-md does not read — its inline links are still selected;
- a wrapped label spelt exactly right with nothing under it: either it names no
  record (`**Related to:** bug 0253`), or it stands alone with no list directly
  under it. A template that writes `**Related to:** none` gets this finding;
  leave the label out instead;
- a heading that misses a **string** `areInSection` declaration by case or
  spacing. A `RegExp` states its own tolerance, so none is reported for it.

The scan covers the whole corpus, not only the rule's selection — a misspelt
declaration is, by definition, not selected — so a rule narrowed with other
selectors, and every rule declaring the same label, reports the same findings.
They are ordinary findings, each with its remedy as the suggestion, and each
names its kind at the end of its element — `(near miss)`, `(inside "…")`,
`(not at a block start)`, `(formatting)`, `(reference links)`, `(empty)` — so
one `.excluding()` sanctions one kind: `.excluding(/→ label "Supersedes" \(empty\)$/)`
accepts a template's `**Supersedes:** none` and still reports everything else
about that label.

Each `MdLink` carries what the selector reads: `block`, the innermost paragraph
or list item holding it, and `blockPath`, every block enclosing it, outermost
first. A label alone on its line counts as enclosing the lists directly after
it, though Markdown does not nest them under it.

These findings come from the rule — `.check()`, `.warn()`, `.violations()`. A
`.select()` over the same chain returns the selected links and carries **no**
such check, so a correspondence side built this way states nothing about a
misspelt declaration.

### A declared link is answered: `beLinkedBack` and `haveLiveTargets`

A declaration is half of a relation. `beLinkedBack()` checks the other half:
each selected link's target links back to the record that declared it.

```typescript
const resolveOptions = { tryExtensions: ['.md'] }
links(c)
  .that()
  .areLabelled('Related to')
  .and()
  .haveLiveTargets(resolveOptions)
  .should()
  .beLinkedBack(resolveOptions)
  .check()
```

**Any link back answers.** Several links back are one answer, a fragment
(`a.md#why`) is still a link to `a.md`, and the back-link may sit anywhere in
the target — which means an incidental mention counts too. A link inside a code
fence or an HTML comment is not a link and does not answer. Both ends resolve
the way `resolve()` does: `beLinkedBack()` takes the same options, so a corpus of
extensionless links passes them once and both directions agree.

**A frozen record cannot answer** — it is history, held to its own time. Add
`haveLiveTargets()`, with the same options, to leave links into frozen folders
out of the selection; it is an ordinary `.that()` filter, so it shows in the
rule's own text and is not counted. Forgetting it fails closed: the link is
examined, and if the frozen record does not link back the finding says so and
names the selector.

The selection is what is examined. A rule whose labels match nothing, or whose
every target is frozen, fails with the zero-examined finding rather than
passing. `haveLiveTargets()` filters on the **target**; a declaration made
_inside_ a frozen record is still examined, and its live target must link back.
That is answerable, so it is checked; to leave history's declarations out, filter
on the source as well — `.and().satisfy({ description: 'are in live records',
test: (l) => !l.doc.frozen })` — the way `pointers().areLive()` filters on the
document a pointer sits in.

A target that cannot answer is one finding, on the declaring link's line, named
`source → target`, with its remedy as the suggestion. The target is the resolved
repo path, except for a missing or external one, which has none and is named by
its URL — write an exclusion against what the finding shows. A file the corpus
did not load for several reasons is reported for the one whose remedy comes
first: not Markdown, then ignored, then outside the roots.

| The target                   | The finding                                             | The remedy                                                |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| a live record, no link back  | `a.md declares b.md, and b.md does not link back`       | add a link to `a.md` in `b.md`, or remove `b.md`          |
| a frozen record, no selector | `b.md is frozen and cannot answer`                      | add `.haveLiveTargets()`, or remove `b.md`                |
| outside the corpus roots     | `b.md is outside the corpus, so its links are not read` | add its folder to the corpus `roots`, or correct the link |
| ignored by the corpus        | `b.md matches the corpus ignore option, …`              | correct the link, or stop ignoring the path               |
| not a Markdown file          | `b.png is not a Markdown record`                        | declare a record, not a file — a `.png` cannot link back  |
| nothing                      | `b.md does not exist`                                   | correct the link — the same fix clears `resolve()`        |
| a directory                  | `the link names a directory, … not a record`            | link the record's file                                    |
| the record itself            | `the link points at this record`                        | remove it                                                 |
| an external URL              | `the declaration links outside the repository, to …`    | declare a record in the corpus                            |

### Front matter

A document may open with YAML front matter between `---` lines. It is read as front matter — a
`yaml` node in `MdDocument.root`, not a section — only when it is a YAML mapping that parses without
error and holds no task box and no link into the repository. Anything else between a first-line
`---` and a later one is read as Markdown, so a document that opens with a horizontal rule keeps its
boxes, links and headings checked, and front matter with a YAML error still appears as a section.
`terms()`, `pointers()` and the ledger read front-matter lines in both cases. TOML (`+++`) front
matter is not recognised and is read as Markdown.

### Resolving a link yourself: `resolveLink`

A condition over links usually needs to know where a link points. Don't
re-implement that: `resolveLink(link, corpus, options?)` is the resolver
`.resolve()` itself uses, so a custom rule and `.resolve()` cannot disagree. It
takes the same `LinkResolveOptions`, never throws, and returns one named case:

| `kind`          | meaning                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `document`      | an existing, loaded corpus document (`path`, `doc`)                                                               |
| `not-in-corpus` | an existing file the corpus did not load; `reasons` lists every one of `not-markdown`, `ignored`, `outside-roots` |
| `directory`     | no candidate is a file, but one names a real directory                                                            |
| `missing`       | nothing exists; `tried` lists every candidate, in order                                                           |
| `self`          | a pure `#anchor`, an empty link, or a path back to the linking document                                           |
| `external`      | a URL with a scheme                                                                                               |

Candidates are tried in a fixed order: the repo-root target, then the
content-root one when `rootDir` is set, each as written, then with
`tryExtensions`, then `tryIndex`. The first existing file wins; a directory is
reported only when no candidate is a file. A link into a built-in ignored folder
(`node_modules`, `dist`, …) is `missing`, because the corpus never walks those.
The `not-in-corpus` reasons come from the corpus `corpus()` built; a `Corpus`
you assemble yourself (or copy with a spread) carries no record of its `roots`
and `ignore`, so its unloaded files are all reported `outside-roots`.

```typescript
import { corpus, links, resolveLink } from '@nielspeter/eess-md'
import type { Condition, MdLink } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })

const intoTheCorpus: Condition<MdLink> = {
  description: 'point at a loaded corpus document',
  evaluate: (found) =>
    found.flatMap((link) => {
      const target = resolveLink(link, c)
      if (target.kind !== 'not-in-corpus') return []
      return [
        {
          rule: 'docs/links-stay-in-the-corpus',
          element: `${link.doc.relPath} → ${link.url}`,
          file: link.doc.file,
          line: link.line,
          message: `"${link.url}" is outside the corpus: ${target.reasons.join(', ')}`,
        },
      ]
    }),
}

links(c).that().areInternal().should().satisfy(intoTheCorpus).check()
```

### Writing a condition for task items

`TaskItemRuleBuilder` ships the two predicates above and **no conditions** — so
`taskItems(c).that().areOpen().should().check()` type-checks and then fails closed
at runtime, correctly: _"selects subjects but asserts nothing about them, so it
cannot fail and certifies nothing."_ The assertion is yours to write.

`Condition`, `Predicate`, `ConditionContext` and `ArchViolation` are re-exported
from `@nielspeter/eess-md`, so a plain object literal is enough and no second
install is needed. (`defineCondition`/`definePredicate` are kernel helpers and are
**not** on eess-md's barrel — reach for the literal, not the helper.)

```typescript
import { corpus, taskItems } from '@nielspeter/eess-md'
import type { Condition, MdTaskItem } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/**'] })

const carriesAnOwner: Condition<MdTaskItem> = {
  description: 'names who owns it',
  evaluate: (items) =>
    items
      .filter((item) => !/@[a-z0-9-]+/i.test(item.text))
      .map((item) => ({
        rule: 'ledger/unowned-open-box',
        element: item.text,
        file: item.doc.file,
        line: item.line,
        message: `open box has no owner: "${item.text}"`,
      })),
}

taskItems(c).that().areOpen().should().satisfy(carriesAnOwner).check()
```

`evaluate` receives the filtered items and returns one `ArchViolation` per
failure — an empty array means every item passed.

## A document's shape, built from blocks

A rule about what a kind of document must hold is written with the blocks above, in your own words.
eess-md defines no plan, bug or page shape for you. For example, every page under `guides/` has a
`Prerequisites` section:

```ts
import { corpus, docs } from '@nielspeter/eess-md'

const pages = corpus({ cwd: 'site', roots: ['**/*.md'] })

docs(pages)
  .that()
  .resideInFolder('guides/**')
  .should()
  .haveSection('Prerequisites')
  .because('a guide states what it assumes')
  .check()
```

Worked examples, each using only eess-md's public exports and each with a passing fixture and a
failing one, are in [`examples/md/`](https://github.com/nielspeter/eess/tree/main/examples/md).

## Scoping a rule to documents: `inDocuments`

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

## Binding a table to code

A markdown table is a spec — a package list, an ADR index. `rows()` turns its body rows into first-class elements, and `.select()` (inherited from the kernel on every eess builder) makes any selection one side of a [`correspondence()`](/crossvalidate). Bind the table to what it describes, and drift either way fails the build:

```typescript
import { corpus, rows, correspondence } from '@nielspeter/eess-md'

const c = corpus({ roots: ['README.md'] })

const packageRows = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ },
}).select({
  label: 'README package row',
  identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
})

// workspacePackages is a plain Selection you build from the filesystem —
// keyBy omitted: it defaults to each side's own identify().name
const workspacePackages = {
  elements: [] as { name: string }[],
  label: 'workspace package',
  identify: (p: { name: string }) => ({ name: p.name }),
}

correspondence({ left: packageRows, right: workspacePackages })
  .should()
  .beComplete({ direction: 'both' })
  .check()
```

Each row carries `get(role)` (located cell text), its real source `line`, and its `doc`/`table`. Rows come from every table matching the section and columns.

`rows(corpus, opts)` returns a `RowsRuleBuilder` — like every entry point, a
`RuleBuilder` you can also `.that().satisfy(…)`/`.should().satisfy(…)`
directly, not just `.select()` into a correspondence. `opts` is
`RowMatchOptions`: `section` (optional heading scope) plus `columns`, a
`ColumnSpec` — `Readonly<Record<string, RegExp>>` mapping a role name to the
header pattern that locates its column. Each element is an `MdRow` — `cells`
(the row, trimmed), `get(role)`, `rowIndex`, `line`, and the `doc`/`table` back
references named above.

Row extraction itself — shared by `rows()` and `haveTableRowsSatisfying`
(below) — is the exported `matchTableRows(doc, opts, mode?)` function. `mode`
is a `RowMatchMode`: `'all'` (the default, and what `rows()` uses — every
matching table across the document contributes rows, so a correspondence
source never silently drops a second matching table) or `'first'` (what
`haveTableRowsSatisfying` uses, preserving its older single-table behavior).

`docs().should().haveTable(opts)`, and the standalone `haveTable(opts)`
condition for composing a custom preset, both take `HaveTableOptions`: an
optional `section` to scope to a heading, and `columns` — one regex per
required header, ANDed (the table must have all of them, in any order).
`haveSection`/`haveTable` are the two building blocks `adrEnforcement`'s own
"has an Enforcement table" check is made from — reach for them directly when
your ADRs don't fit the tier model (see "ADR enforcement tables" below).

`haveTableRowsSatisfying(opts)` is the per-row sibling: it takes
`HaveTableRowsOptions` (`section`, the same `columns: ColumnSpec` `rows()`
takes, and `row` — a callback returning violation messages for a row, `[]`
meaning the row is fine) and runs `row` once per body row of the _first_
matching table. The callback's argument type is exported as `TableRowContext`,
a named alias kept for back-compat — it is exactly `MdRow`, and new code can
reference `MdRow` directly. This is the primitive `adrEnforcement`'s own tier
and citation checks are written against.

## Code blocks that parse

`parseCodeBlocks` checks every fenced block of one language with a parser **you** name, and
`codeBlocks()` turns the result into an ordinary rule. eess-md owns the loop and the evidence. It
never loads a parser itself, so it carries no dependency on any language's grammar.

This parser is real and needs nothing installed: it checks every ` ```json ` block with
`JSON.parse`.

```ts
import {
  corpus,
  parseCodeBlocks,
  codeBlocks,
  type CodeBlockParser,
  type CodeBlockVerdict,
} from '@nielspeter/eess-md'

const json: CodeBlockParser = {
  name: 'JSON.parse',
  version: process.version, // a built-in parser is versioned by its runtime
  // Blocks the parser must reject. If it ever accepts one, nothing it says can be trusted.
  canaries: [{ text: '{ "unclosed": ', expect: 'invalid' }],
  parse: (texts) =>
    texts.map((text): CodeBlockVerdict => {
      try {
        JSON.parse(text)
        return { outcome: 'valid' }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { outcome: 'invalid', message, line: null, remedy: 'Fix the JSON in this block.' }
      }
    }),
}

const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'] }), {
  language: 'json',
  parser: json,
})
codeBlocks(parsed).should().parse().check()
console.error(parsed.summary()) // "N json blocks parsed with JSON.parse v24…"
```

**Facts first, then a synchronous rule.** `parseCodeBlocks` is the only async call. It parses the
whole batch once and returns a frozen fact object, and `codeBlocks()` reads it synchronously. Its
elements are the parsed blocks, so `.that().resideInFile()` or `.resideInFolder()` can only narrow
what was parsed. No rule surface becomes async; an async `check()` would need an ADR.
`codeBlocks()` refuses an object this copy of eess-md's `parseCodeBlocks` did not build.

**The port.** A parser is `{ name, version, canaries, parse(texts, { signal, budgetMs }) }`.

- **What `parse` is handed.** `texts` holds the canaries first, in declared order, then the blocks
  in document order. It returns one verdict per text, in that order, synchronously or as a promise:
  - `{ outcome: 'valid' }`;
  - `{ outcome: 'invalid', message, line, remedy }`, where `line` counts from the block's first
    body line, or is `null`;
  - `{ outcome: 'unrecognised', message, remedy }`, for a block the parser cannot classify. It is
    never worded as the author's syntax error.
- **A verdict is checked, not trusted.** Annotating your parser's results as `CodeBlockVerdict`, as
  the example does, is the only check at compile time, since `parse` may return any values. Each is
  read once. Anything that is not one of the three
  shapes, or has an empty message or remedy, is reported as the instrument, never read as `valid`.
- **A parser names itself, and declares canaries:** blocks it must reject, each with the outcome it
  must give, `invalid` or `unrecognised`.
  - eess-md parses them in the same batch, and a canary answered with any other outcome is the
    instrument.
  - A parser with no name, no version or no canaries, or a canary with empty text or an `expect`
    that allows a pass, makes `parseCodeBlocks` throw `ArchConfigError` before anything is
    selected. So do an empty `language` and a budget a timer cannot hold.
  - **What this cannot stop:** a caller who writes a parser that accepts everything except its own
    canaries can still lie to themselves. The canaries make a forged pass deliberate, not
    impossible.
- **A parser that knows why it failed** rejects with an error carrying `remedy` and `blockIndex`
  (an index into `texts`). The remedy becomes the finding's `Fix:` line, and the block its file and
  line.
- **A parser that holds a resource** (a worker, a process) releases it itself once it has answered.
  eess-md aborts the `signal` only when the budget runs out.

**What each failure reports.**

| what happened                                    | reported as                                                    |
| ------------------------------------------------ | -------------------------------------------------------------- |
| no Markdown file loaded                          | a finding, even with `.expectEmpty()`                          |
| files loaded, no block of the language           | the zero-examined finding, unless `.expectEmpty()`             |
| `invalid`                                        | a finding at the block's Markdown line plus the verdict's line |
| `invalid` with no line, or one outside the body  | a finding at the fence line, saying so                         |
| `unrecognised`                                   | a finding with the parser's remedy                             |
| `parse` throws or rejects                        | the instrument                                                 |
| `parse` runs past its budget                     | the instrument, naming the budget                              |
| the wrong number of verdicts, or a malformed one | the instrument                                                 |
| a canary answered wrongly                        | the instrument                                                 |

**The instrument** is one unsuppressable finding per rule. Its rule id is
`eess-md: code-block parser` (exported as `CODE_BLOCK_PARSER_INSTRUMENT`), and its element
`name@version`. While it stands, `examined` still counts the blocks of the language, none of which
has a verdict, so the rule cannot pass. Several rules over one failed parse each carry it. `eess-ts check`
collapses findings with the same rule id and element to one, so two different failures
of one parser over two corpora would collapse too and show one cause. A script gate that collects
findings itself sees one per rule.

**`summary()`** is the line a gate prints: "N json blocks parsed with JSON.parse v24…". When the
parser failed it says "0 of N … checked" and gives the cause, never "parsed".

**The budget** is a start-up allowance plus one per text: by default 10 s plus 250 ms a text. Pass
`budget: { startUpMs, perBlockMs }` to change either. When it runs out, eess-md aborts the `signal`
it passed, and stopping is the parser's job. **A synchronous parser cannot be interrupted.** Its
overrun is reported after it returns, and one that never returns is never reported.

**Which blocks.** The language tag is matched in any letter case, and nothing else is normalised
([ADR-019](../adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md)): ` ```JSON ` is
read as `json`, and so is `language: 'JSON'`, but ` ```json5 ` is not, and ` ```mmd ` is not
`mermaid`. A corpus whose every block carries such a tag gets the zero-examined finding, which
does not name the tag.

A block that is broken on purpose, such as an example of an error, is kept out by its tag: write it
` ```text `. Narrowing the corpus globs also works. There is no skip comment.

## Controlled vocabulary

Two composable primitives bind free-text references in your prose to a closed
set of names — a bounded-context list, a package list, a set of canonical
folder names — and fail when the prose drifts from it.

`vocabulary(corpus, options)` derives the term set. `VocabularyOptions` has
three sources, unioned: `fromFolders` (ONE glob string, not an array; each matched
directory **that contains at least one file** contributes its basename as a term —
terms are derived by splitting file paths out of `fileIndex`, so a freshly-created
empty folder contributes nothing and the resulting violation will blame your prose
rather than the empty folder), `fromHeadings` (`{ files, depth?
}` — every heading at that depth in the matched files becomes a term), and
explicit `terms`. `normalize` (default: trim) is applied to both the derived
terms and the references checked against them. It returns a `Vocabulary`:
`terms` (the normalized `ReadonlySet<string>`) and the `normalize` function in
force — pass this straight to `.resolveAgainst()`.

`terms(corpus, options)` finds the references. `TermsOptions.label` is a
regex locating a labeled reference on a line (e.g. `/Bounded Context:/`);
`value` (default: strip markdown emphasis characters and trim) extracts the
referenced value from the text following the label match. It returns a
`TermRuleBuilder`, whose elements are `MdTerm` (`value`, `raw` — the line's
text after the label, before cleanup — `doc`, `line`, and since plan 0468 `label` and
`form: 'pattern'`). `.resideInFile(glob)`
scopes to a file pattern; `.resolveAgainst(vocab)` is the condition — every
reference's `value` must be a term of the given `Vocabulary`.

```typescript
import { corpus, vocabulary, terms } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/**'] })

// `fromFolders` is ONE glob (a string, not an array). Each matched directory
// that contains at least one file contributes its basename as a term.
const contexts = vocabulary(c, { fromFolders: 'src/contexts/*' })

// `label` locates the reference; `value` (optional) extracts it from the rest
// of the line. The default strips markdown emphasis, trims, AND truncates at
// the first ` · `, ` — `, ` – ` or ` | ` — so "**Billing** — the money one"
// yields `Billing`, not the whole tail. A fenced block that closes is set aside
// before scanning, with fences paired as CommonMark pairs them, so an example
// in one never becomes a reference. A fence that never closes is read past,
// so a malformed document reports too much rather than nothing.
terms(c, { label: /Bounded Context:/ })
  .that()
  .resideInFile('docs/**')
  .should()
  .resolveAgainst(contexts)
  .check()
```

## A labelled value: `fields()`

`fields(corpus, options)` reads a labelled value (`Status`, `Severity`, `Owner`) in the forms your
corpus writes, which you name: eess-md has no default form.

| form        | reads                              |
| ----------- | ---------------------------------- |
| `bold`      | `**X:** v`, `**X**: v`, `__X__: v` |
| `heading`   | `## X: v`, at any heading depth    |
| `bold-line` | `**X: v**`, a whole line in bold   |
| `plain`     | `X: v`                             |

Each form may sit behind up to three spaces, and every form but `heading` after a list marker. The
label is compared ignoring ASCII case and runs of whitespace; `aliases` adds other spellings, each
reported under its own name. `region: 'header'` reads only the record's header: lines before the
first heading of depth 2 or more that is not itself a `## Label: value` heading, so `## Status:
open` followed by `## Severity: High` stays one header. Fenced code is not read. A value continues
over lines until a blank line, a heading, another label, or the end of its list item; a `heading`
or `bold-line` value is one line.

The elements are `MdTerm`s, as `terms()` gives, with the `label` as written and the `form` it was
read in. The value is `cleanValue` of the text after the label by default: paired emphasis and a
leading or trailing pictograph removed, whitespace collapsed, nothing cut. Pass `value` to cut it,
composing the exported helpers: `untilDelimiter(['—'])` cuts at the first delimiter, and
`longestOf(words)` takes the longest of your words the text starts with as a whole word, or the
whole text when none matches, so the check reports it. `split` turns one value into several.

```typescript
import { corpus, fields, longestOf, vocabulary } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/bugs/**'] })
const states = ['Draft', 'Ready', 'Fixed', 'Rejected']

fields(c, { label: 'State', forms: ['bold', 'heading'], value: longestOf(states) })
  .should()
  .resolveAgainst(vocabulary(c, { terms: states }))
  .check()
```

`resolveAgainst` takes a `Vocabulary` or a `RegExp`, which must match the whole value. A field's
finding names the value, the label and the line, never the whole set: `'Shipped' (Status, line 3)
does not resolve against the vocabulary (4 terms)`. A value that is empty after cutting (an
emoji-only `✅`, a `### Status:` with the value on the next line) is a finding too: `(Status, line 3)
has no value this rule can read`.

A line in your rule's selection that names the label with markup before its colon, and that the
rule did not read, is a finding. When a form you did not name reads it: ``found `## Status: open`
at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the
line``. When no form reads its shape (a blockquote, a task box, `__Status:__`, `## **Status:**`):
``… in a shape no form reads; rewrite it as `**Status:** v`, `## Status: v` or `**Status: v**` ``.
Plain prose is never taken for a label: `Status: see the note` with no markup before the colon is
neither read (unless you name `plain`) nor reported. With `region: 'header'`, a label below the
header is neither read nor reported; plan 0469's `haveField` reports a value outside the region.
`fields()` reads the same label grammar as `honestyAtClose` (any indent, a bullet or a numbered
marker), and a CRLF file reads as an LF one. This repository's own `check:corpus` reads every live
plan's and bug's State this way.

### A document has a value: `haveField`

`docs(c).haveField(options)` is dual-use, like `haveSection`. After `.that()` it selects the documents
whose labelled value resolves and, with `oneOf` (a `Vocabulary` or a `RegExp`), is allowed; after
`.should()` it asserts every selected document has one. It reads the value as `fields()` does and
resolves one per document: a structured form (`bold`, `heading`, `bold-line`) beats `plain` prose;
one structured value resolves it, and prose that disagrees is reported at its own line; two
structured values are a conflict; plain values alone resolve only when they agree.

```typescript
import { corpus, docs, untilDelimiter } from '@nielspeter/eess-md'

const c = corpus({ roots: ['bugs/**'] })

docs(c)
  .that()
  .haveField({
    label: 'Status',
    forms: ['bold', 'heading'],
    value: untilDelimiter(['—']),
    oneOf: /fixed/i,
  })
  .should()
  .haveSection('Verification')
  .check()
```

Every cause that makes a value unreadable is reported in either position, for the documents the
rule's other predicates keep: `Status is given twice (line 3 'open', line 9 'fixed'); keep one`,
`found … in a form this rule does not read`, `Status at line 14 is outside the header (region:
'header'); …`, `Status at line 3 has no value this rule can read`, and `prose says Status 'open',
but the field at line 3 says 'fixed'`. As a condition it also reports `no Status field (read as
bold, heading); its labels: Severity, State` and a value outside `oneOf`. As a selector, a readable
value outside `oneOf` is the filter doing its job and is not reported: a misspelt `Fxed` is a
different value, so pair the rule with `fields(...).resolveAgainst(...)`. So is a document with no
field at all, or a misspelt label (`**Satus:**`): pair the selector with a
`.should().haveField({ label, forms })` rule over the same documents, which reports it. A value
after a code fence that never closes is reported (`Status at line 9 follows a code fence that never
closes; close the fence`), and a plain line the rule does not read is named in the no-field finding.
This repository's `check:corpus` requires one State in every live plan and bug this way, as a
condition.

**As a predicate.** `predicateHaveField(options)` is exported on its own, for `satisfy()` and the
combinators. `inDocuments(predicateHaveField(…))` lifts it onto a document's boxes or links (see
[Scoping a rule to documents](#scoping-a-rule-to-documents-indocuments)); a hand-written lift must
forward `undecided`, or the predicate's `test` refuses. A document whose value cannot be read is **undecided**
([ADR-021](../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)): it is not selected, not
dropped, and each cause is one finding that cannot be suppressed, reported wherever the rule's
verdict depends on it. Combined with a predicate that decides the document anyway (a folder that
excludes it, an `or` branch that holds), it is not reported. A value that resolved, allowed or not, is
decided, even beside prose that disagrees: the condition form reports that. `.select()` over an undecided document
throws, naming the cause.

```typescript
import {
  and,
  corpus,
  docs,
  predicateHaveField,
  longestOf,
  type MdDocument,
  type Predicate,
} from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/**'] })
const closed = predicateHaveField({
  label: 'State',
  forms: ['bold'],
  value: longestOf(['Done', 'Draft']),
  oneOf: /^Done$/,
})
const live: Predicate<MdDocument> = {
  description: 'are live plans',
  test: (d) => !d.relPath.includes('/completed/'),
}

// No closed plan sits in a live folder; a plan whose State cannot be read is reported, not skipped.
docs(c).that().satisfy(and(live, closed)).should().notExist().check()
```

This repository's `check:corpus` states a version of the same rule over its plans and bugs
(`corpus/closed-records-sit-in-done-folders`).

## ADR enforcement tables

`eess-md` ships an `adrEnforcement()` preset that validates the `## Enforcement` table convention: every ADR ends with a **Clause | Tier | Mechanism | Status** table, tiers are valid, and cited file paths resolve. It does **not** check that a cited `it('…')` title names a real test: that is `eess-crossvalidate`'s `adrCitationsResolve`, which reads the test AST — see [`eess-crossvalidate`](/crossvalidate). If your ADRs cite test titles, run it too; with `eess-md` alone, a title citation is not verified by anything.

`adrEnforcement(corpus, options?)` takes `AdrEnforcementOptions`: `dir` (glob
selecting ADR files, default `docs/adr/**`), `section` (default
`/^enforcement$/i`), `columns` (header patterns for the tier/mechanism/status
columns, default English), `tiers` (valid tier numbers, default `[1,2,3,4,5]`),
and `verifyCitations` (default `true` — turn off to gate on the table's shape
without checking cited paths). It extends the kernel's `PresetBaseOptions`, so
`overrides` can downgrade or disable its three rule ids individually
(`adr/enforcement-declared`, `adr/valid-tiers`, `adr/citations-resolve`).

### Citing something that is not a file or a test

`adrEnforcement` resolves one citation form in a Mechanism cell, a backticked
file path; an `it('…')` title is `eess-crossvalidate`'s to resolve. A team whose mechanism is a **named rule in
its own architecture tool** — `` `acme/handlers-validate-input` ``, defined in
its `arch.rules.ts` — cites neither, and the preset takes no plugin for it: what
counts as a _live_ id is the team's fact, not the corpus's, and a plugin host
would make an opinionated preset own overlap and ordering for twenty lines you
can write. Those twenty lines are two primitives from above, joined: `rows()`
gives you the Mechanism cells, and `correspondence()` binds what they cite to
the set you hold.

```typescript
import { corpus, rows, correspondence, type MdRow } from '@nielspeter/eess-md'

const c = corpus({ roots: ['docs/adr/**'] })

// Your citation form. The preset's is a path; an it('…') title is eess-crossvalidate's.
const RULE_ID = /`(acme\/[a-z0-9-]+)`/g

// Every Enforcement-table row, then one element per id a row cites — each
// attributed to the row, so a stale citation reports the ADR and the line.
const enforcementRows = rows(c, {
  section: /^enforcement$/i,
  columns: { mechanism: /mechanism/i },
}).select({
  label: 'enforcement row',
  identify: (r) => ({ name: `${r.doc.relPath}:${r.line}`, file: r.doc.relPath, line: r.line }),
})
const cited = {
  elements: enforcementRows.elements.flatMap((row) =>
    [...row.get('mechanism').matchAll(RULE_ID)].flatMap((m) => {
      const id = m[1]
      return id === undefined ? [] : [{ id, row }]
    }),
  ),
  label: 'cited rule id',
  identify: (x: { id: string; row: MdRow }) => ({
    name: x.id,
    file: x.row.doc.relPath,
    line: x.row.line,
  }),
}

// The live set is yours to hold — what your rule tool reports, or a frozen
// snapshot of it. Read it however you keep it; the correspondence only needs
// the names.
const liveIds: string[] = ['acme/handlers-validate-input', 'acme/no-cross-context-import']
const live = {
  elements: liveIds,
  label: 'rule declared in arch.rules.ts',
  identify: (id: string) => ({ name: id }),
}

// Both directions: a cited id that is not live, and a live id no ADR cites.
correspondence({ left: cited, right: live })
  .should()
  .beComplete({ direction: 'both' })
  .because(
    'every rule id an ADR cites is live, and every live rule is the mechanism of some clause',
  )
  .check()
```

What makes this red when it is wrong, rather than quietly green: a
correspondence counts **both** sides as its evidence, so a `RULE_ID` pattern
that matches nothing over a non-empty live set is not a pass — every live id
is then uncited, and `beComplete` reports each one — and an empty live set over
cited ids reports every citation as unresolved. Only both sides empty examines
nothing, and that is the configuration finding, not a tick.

The reverse direction is the half the preset cannot give you. Its own checks
are built on `haveTableRowsSatisfying`, which sees one row at a time and cannot
know what is live and uncited. Reach for that when the forward check alone is
what you mean; for the both-directions contract, the correspondence is the
primitive.

## Ledger reconciliation

`@nielspeter/eess-md/rules/ledger` ships a second opt-in preset,
`honestyAtClose` — the working-method's "an item closes with nothing silently
lost" gate. It reads GFM task boxes (via `collectTaskItems`, above) and a
document's `State:` header line, and reports eight things: a done item with an
open box carrying no disposition token (`ledger/silent-open-box`), a
`Deferred: none` summary that contradicts a box disposed as
`deferred→<home>` (`ledger/deferred-none-lie`), a `State:` value that
doesn't match its folder (`ledger/state-folder-mismatch`), a `State:` value
outside the declared vocabulary (`ledger/unknown-state`), a fenced code block that
never closes (`ledger/unterminated-fence`), and a document whose header has a
`State:` line only inside a code block (`ledger/state-in-code`). The last two are the
same fact seen twice: by CommonMark a line in code is not prose, so a record whose State
line is code states nothing, and the gate would check nothing without them. The gate
cannot tell such a record from a document that is not one — a guide in the lane showing
the template in a code block — so `ledger/state-in-code` reports that too; name a
document like that in `boardFiles`.

The last two are about a state the preset could not read at all (bug 0444):

- **`ledger/state-under-another-label`**: a record with no `State:` line whose header holds a
  value from the vocabulary under another label, such as `**Status:** Done` or `Status: Done`. A
  page that is not a record but carries such a line (`**Questions:** Open`) is reported too; list
  it in `boardFiles`.
- **`ledger/no-readable-state`**: a call in which no document carries a state line at all.
  Raised once per call. Its first remedy is to narrow the corpus you pass to the folders that hold
  records, because the preset has no lane list: each call is one lane.

A corpus that writes its state under another label passes `label: 'Status'`, or adds it with
`aliases: ['Status']`. A record whose header carries its state as a heading, `## Status: Done`, is read too, under the
labels in force; a run of `## Label: value` headings before the first plain section heading is one
header (bug 0476). As with a label line, the value is matched from its start, so `## Status: Open
questions` reads `Open`.

The vocabulary finding, `ledger/unknown-state`, is the one a new adopter meets first, and it is a **violation,
not an ignore**: the default vocabulary is `Draft | Ready | Open | Done |
Won't-do`, so a corpus using `In Review` or `Shipped` reds until you pass your own
`states`/`terminalStates`. An unreadable state is reported rather than skipped on
purpose — a record whose status nobody can parse is indistinguishable from one
that has none, which is what bug 0120 is about.

`findState(text, vocabulary, root?, labels?)` is the same scan the preset uses to read a
document's status, exported so a caller can ask the question without a second
opinion. It returns `{ state?, raw, line }` or `null`, and the three things it
gets right are the three a hand-rolled regex gets wrong: it reads the document's prose as
CommonMark does, through the parser the task-box pass uses (so an example `**State:** Draft` in a
code block — fenced with any run of backticks or tildes, or indented — is not the document's state;
HTML blocks are read as prose; pass the parsed `root` if you have it), it accepts every label form the corpus uses (`**State:**`, `**State**:`,
`__State__:`, bare `State:`, with or without a bullet), and it canonicalises
apostrophe glyphs so a smart-quoted `Won’t-do` is the same token as `Won't-do`.
`state` is absent when the value is outside `vocabulary` — `raw` still carries
what was written, which is what `ledger/unknown-state` reports. `null` means no State line in
prose: a record whose State line sits only in a code block, or after a fence that never closes, is
`null` too — `honestyAtClose` reports those, and a caller of its own should not read `null` as "not an
item" without the same check.

If you are writing your own ledger check, call this rather than re-deriving it.
This repo learned that twice: once when `check-ledger.mjs` re-derived the scan and
printed a wrong denominator, and again when a new check hand-rolled the same
regexes and got all four of the above wrong.

Like every preset, `honestyAtClose` throws by default: `HonestyAtCloseOptions`
extends `PresetReportOptions`, so `report: 'return'` hands you the
`ArchViolation[]` instead and `report: 'warn'` prints without failing (ADR-008 —
the caller owns emission). The same is true of `adrEnforcement`.

```typescript
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose, ledgerStats } from '@nielspeter/eess-md/rules/ledger'

const c = corpus({ roots: ['work/**'] })
const opts = {
  doneFolders: ['completed', 'fixed'],
  // Declared together or not at all — see below.
  states: ['Draft', 'Ready', 'Open', 'Done', "Won't-do"],
  terminalStates: ['Done', "Won't-do"],
}

// Throws on the first finding — pass `report: 'return'` to get the array instead.
honestyAtClose(c, opts)

// Print what it examined; a zero here is the failure to watch, not a pass.
const stats = ledgerStats(c, opts)
console.error(`${stats.doneItems} done-items across ${stats.scanned} records`)
```

`HonestyAtCloseOptions` configures the vocabulary this reads: `doneFolders`
(path segments marking a document done, beyond a terminal `State:` token),
`boardFiles` (basenames that are never scanned as items — `ROADMAP.md` and
friends), `closeInPlace` (disable the folder-placement half, for a corpus that
closes items where they sit instead of moving them), `states` and
`terminalStates` (the full `State:` vocabulary and which of it counts as
closed — a bug lane passes `['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked']`
/ `['Fixed', 'Rejected']` where a plan lane passes the default `Done`/`Won't-do`
shape), `label` and `aliases` (the label a record's state is written under: default `State`;
`aliases` adds labels beside it, and a blank label is refused). **Pass `states` and
`terminalStates` together, or neither**: either one alone throws
an `ArchConfigError`. They declare one vocabulary, and a half used to take the other from the
defaults — so a closing token you added to `states` was never terminal, its records were never
treated as done, and their open boxes passed with no finding at all (bug 0284). To keep the
defaults and add your own tokens, extend both lists. Then there is `expectEmptyHeaders` (declare that a freshly-bootstrapped lane may
legitimately hold zero items yet — the declaration expires the day a real
document appears).

`ledgerStats(corpus, options?)` is the denominator `honestyAtClose` computes
for itself, exposed separately so a caller can print it rather than staying
blind-and-green: a `LedgerStats` — `scanned` (documents considered, board
files excluded), `withReadableState` (…of which carry a state line, under the
labels in force, that the declared vocabulary can read), `unreadableState` (…of which carry one it
can't), and `doneItems` (…of which are done, by folder or by terminal state,
and so ledger-checked). A caller should print this, not re-derive its own copy
of the same expression — this repo's own `scripts/check-ledger.mjs` did once,
and its copy silently disagreed with the preset.

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/md) for the full DSL surface.
