# Migrating to 0.15

> Written for the release tagged `v0.15.0`. All six packages move; the kernel goes to 0.8.0. The tag
> is not `v0.8.0` because `v0.8.0` and [Migrating to 0.8](./migrating-to-0.8.md) are an earlier,
> unrelated release, and tags only go up (RELEASING.md). Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-md @nielspeter/eess-mermaid @nielspeter/eess-gherkin @nielspeter/eess-crossvalidate`.

| package                          | from   | to     |
| -------------------------------- | ------ | ------ |
| `@nielspeter/eess`               | 0.7.1  | 0.8.0  |
| `@nielspeter/eess-ts`            | 0.13.1 | 0.14.0 |
| `@nielspeter/eess-md`            | 0.11.0 | 0.12.0 |
| `@nielspeter/eess-mermaid`       | 0.8.0  | 0.8.1  |
| `@nielspeter/eess-gherkin`       | 0.6.0  | 0.7.0  |
| `@nielspeter/eess-crossvalidate` | 0.9.0  | 0.10.0 |

Every dialect at this release depends on the kernel at `^0.8.0`, which on `0.x` does not admit 0.7.x,
and the dialects import members that are new in kernel 0.8.0 (`globTextFault`,
`repoRelativeCorrection`, `kleene`). A dialect left at its old version installs a second kernel
beside it. **Upgrade the packages you use together.** `eess-crossvalidate` 0.10.0 raises its peer
floors to this release's dialects: `eess-ts` 0.14.0, `eess-md` 0.12.0, `eess-mermaid` 0.8.1 and
`eess-gherkin` 0.7.0 or later. An older dialect installed beside it is a peer-dependency conflict.
The floors have no ceiling, so a future dialect built on a newer kernel is not refused this way: keep
the family on one release.

**Most of the work is in `eess-md`.** It carries nine breaking changesets, and nearly all of them
make a check that used to pass over nothing say so. Expect findings on documents you did not
change. They are real: read them before you widen a declaration to make them go away.

## Code edits

### eess-md: `collectTaskItems` takes the document's source

`collectTaskItems(root)` now requires `{ source }`, because mdast resolves an escaped `\[` away and
only the text tells it apart. It also returns more elements than before: undeclared marks,
malformed boxes and empty `- [ ]` / `- [x]`, each with `checked: false` and a `state` of
`'undeclared'` or `'malformed'`. A caller that counted `!checked` as open sees its count rise.

Pass the shared `BOX_MARKS` (the next section), and report a box you cannot read before you filter
to `'open'`. A filter on `'open'` alone drops an undeclared `[~]` without a word, which is the
blindness this release removes:

```ts
import { collectTaskItems } from '@nielspeter/eess-md'

// BOX_MARKS is your one shared constant: see "declare your box marks once" below.
for (const box of collectTaskItems(doc.root, { marks: BOX_MARKS, source: doc.text })) {
  if (box.state === 'undeclared' || box.state === 'malformed') {
    throw new Error(`${doc.relPath}:${box.line}: box [${box.mark}] is ${box.state}`)
  }
  if (box.state !== 'open') continue
  // ...
}
```

### eess-md: declare your box marks once

Box marks beyond GFM's `[ ]` and `[x]` are now read. A mark nobody declared is
`md/undeclared-box-mark` (once per document and mark), and a near-GFM box (`[ x ]`, `[x]done`, an
empty `- [ ]`) is `md/malformed-box`. Both are configuration findings: a `.warn()` rule that carries
one fails, and `.excluding()` does not hide them. A rule reports such a box only when its predicates
could have reached it.

Declare each mark once ([box marks](./markdown.md#box-marks)), in one shared constant, and pass that constant to every `taskItems()` and
`honestyAtClose()` call. Two copies drift, and the call you forgot reports the mark as undeclared.

```ts
import { taskItems } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

// [~] partly done, so still open; [→] moved to another record, so it neither blocks a
// close nor counts as done: unjudged, never done, since a move is not a verification.
export const BOX_MARKS = { '~': 'open', '→': 'unjudged' } as const

taskItems(c, { marks: BOX_MARKS }).that().areOpen().should().notExist().check()
honestyAtClose(c, { marks: BOX_MARKS })
```

Declare the state a mark means: `'done'` claims the work is finished. In the trial, declaring `[~]`
open found real partly-done boxes in closed records ("6 of 9 done") that had passed before. Or
rewrite the box as `[ ]` or `[x]`; rewrite a `[ x ]` or an empty box; and escape (`\[`) or
code-span a bracket that is not a box.

**A mark for a box nobody should judge, such as `[?]`, is `'unjudged'`** (bug 0525). Declaring it
`'open'` asks for a disposition on every such box (in one corpus with 1,680 `[?]` boxes, that gave
3,344 findings), and declaring it `'done'` claims work that was never done. An unjudged box is
neither: `areOpen()` and `areChecked()` do not select it, `honestyAtClose` neither asks it for a
disposition nor counts it as finished, and a `deferred→` on it is not a deferral. A rule still
selects it by its mark or by `state === 'unjudged'`. Declare `'unjudged'` only if the box never blocks a close in any record: it leaves every close rule for good, in live and closed records alike. `[~]` is the wrong use: it marks unfinished work, which is `'open'`. Only a declaration makes a mark unjudged; an
undeclared mark is still a finding. `collectTaskItems()` now validates its `marks` too, so a state
that is not one of the three, `undefined` included, is refused there as well.

```ts
import { corpus, taskItems } from '@nielspeter/eess-md'

export const BOX_MARKS = { '~': 'open', '→': 'unjudged', '?': 'unjudged' } as const

const c = corpus({ roots: ['work/**'] })
taskItems(c, { marks: BOX_MARKS }).that().areOpen().should().notExist().check()
```

More in [box marks](./markdown.md#box-marks).

### eess-md: types that gained required fields

- `MdTaskItemRef` gains `mark` and `state`. `MdTaskItem` no longer extends it: it carries `mark` and a
  `state` of `'open' | 'done' | 'unjudged'`. Add both to any you construct.
- `MdTerm` gains `label` (as written, without its colon) and `form` (`'pattern'` for a `terms()`
  element). Add both to any literal you build.
- `TermRuleBuilder`'s constructor takes a different argument. Build one with `terms()` or `fields()`;
  a subclass or a direct `new TermRuleBuilder(corpus, options)` stops compiling.
- `ParsedCodeBlocks` gains `documents`. A hand-built object typed as `ParsedCodeBlocks` needs it to
  compile; `codeBlocks()` refuses such an object anyway.

### eess-ts: remove `.expectNonEmpty()` from `.notExist()` rules

On a `.notExist()` rule it can never pass, and it is now reported. To catch a glob typo that empties
the rule, put a positive rule over the same population beside it:

```ts
import { modules } from '@nielspeter/eess-ts'

modules(p).that().resideInFolder('src/legacy/**').should().notImportFrom('src/app/**') // reds when it selects nothing
```

### Optional: drop `g` and `y` from section matchers

A section name given as a `RegExp` with `g` or `y` is now read without it, in eess-md (`haveSection`,
a table's `section`, `links().areInSection()`) and in eess-crossvalidate (`adrCitationsResolve`,
`adrCitationStats`). Dropping the flags changes nothing; leaving them changes nothing either.

## What can go red on update

| package              | what is now checked                                                                                                | why it passed before                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `eess-md`            | a `frozen` glob that marks none of the loaded documents is refused; one that can never match is refused with a fix | it emptied `areFrozen()`, so an absence rule passed (bug 0499)    |
| `eess-md`            | a root that loads no file is refused, when another root loads                                                      | it was dropped without a word (bug 0465)                          |
| `eess-md`            | a corpus that loaded no document is an empty source, which `.expectEmpty()` cannot declare away                    | an absence rule over it passed (plan 0456)                        |
| `eess-md`            | `honestyAtClose` reports a record whose state sits under another label, and a call with no readable state at all   | such records were skipped (bug 0444)                              |
| `eess-md`            | `honestyAtClose` reads a state written as a heading, `## Status: Done`, and a label after `1.`                     | the record went unread (bug 0476, plan 0468)                      |
| `eess-md`            | an undeclared box mark or a malformed box is a finding                                                             | `- [~]` was an ordinary list item (plan 0454, bug 0445)           |
| `eess-md`            | a box's `text` is all of its content, so a `deferred→` on its second line meets `Deferred: none`                   | only the first paragraph was read (bug 0507)                      |
| `eess-md`            | `links().areInSection()` reads the sections every other reader reads                                               | a heading inside a list item scoped the links after it (bug 0502) |
| `eess-md`            | a `g`/`y` section matcher reads every document                                                                     | `lastIndex` skipped every other document (bug 0506)               |
| `eess-ts`            | `.expectNonEmpty()` on a `.notExist()` rule                                                                        | it set a flag nothing read (bugs 0467, 0466)                      |
| `eess-gherkin`       | `haveUniqueTitles` reports every scenario of a duplicate group, each naming the others                             | only the second and later were reported (plan 0459)               |
| `eess-crossvalidate` | `adrCitationsResolve` checks every ADR's citations when `section` carries `g` or `y`                               | every other ADR's table was skipped (bug 0506)                    |
| all presets          | a `report` mode other than `'throw'`, `'return'` or `'warn'` throws                                                | it printed and passed; TypeScript already rejected it (bug 0508)  |

The sections below are what the trial upgrade had to do about the first five rows.

### Frozen globs: declare the empty ones per `corpus()` call

For a lifecycle folder that holds no record yet (`'**/wont-do/**'` before anything is filed there),
name the glob in `expectEmptyFrozen`. **Do not remove it from `frozen`:** removed, a record filed
there later is read as live, and an absence rule over the frozen documents never sees it, which is
the false green this closes. The declaration expires: once the glob marks a document, `corpus()`
refuses until you drop the name.

The list is per call, not per repository. A glob is empty or not under that call's own `roots`, so a
frozen list shared by several corpora needs its own `expectEmptyFrozen` in each. In the trial, one
shared list of frozen globs needed one empty glob under `work/**` and seven under `work/bugs/**`.

```ts
import { corpus } from '@nielspeter/eess-md'

const FROZEN = ['**/completed/**', '**/fixed/**', '**/wont-do/**', '**/archive/**']

const ledger = corpus({ roots: ['work/**'], frozen: FROZEN, expectEmptyFrozen: ['**/archive/**'] })
const bugs = corpus({
  roots: ['work/bugs/**'],
  frozen: FROZEN,
  expectEmptyFrozen: ['**/completed/**', '**/wont-do/**', '**/archive/**'],
})
```

Writing the default list out makes it yours, and it is judged; the omitted default is not. If you
passed `frozen: ['**/completed/**', '**/archived/**']` and lack one of those folders, omit `frozen`
or declare the missing one.

### Dead roots: declare the empty ones

A root that loads no Markdown document, while another root does, is refused. Correct the glob, remove
the root, or, when it is empty on purpose (a lane with no records yet), name it in
`expectEmptyRoots`. That declaration expires too. A root that matches files but no Markdown, such as
a code glob, is not refused. A `honestyAtClose` lane whose roots match no file at all now fails:
create the folder with its board file, or remove the lane.

### Test fixtures: compute the empties, or mirror the live tree

A test that runs your real corpus factory against a fixture tree is where this release bit hardest.
The fixture holds only what its case writes, so almost every frozen glob and most roots are empty in
it, and `corpus()` refuses them. `corpusFromText` judges the same way.

**One static declaration cannot serve both trees.** `expectEmptyFrozen` and `expectEmptyRoots`
expire as soon as their glob matches: the live tree's `'**/fixed/**'` holds records, so naming it is
refused there; the fixture's holds none, so not naming it is refused there. Whichever tree a fixed
list is right for, it is wrong for the other. The trial found two working patterns.

**Compute the empties from the tree.** Keep the live tree's measured list static, and read a
fixture's empties from the fixture itself:

```ts
import { globSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { corpus } from '@nielspeter/eess-md'

const ROOTS = ['work/bugs/**', 'work/plans/**']
const FROZEN = ['**/completed/**', '**/fixed/**', '**/wont-do/**', '**/rejected/**']
const LIVE_EMPTY_FROZEN = ['**/wont-do/**', '**/rejected/**'] // measured on the live tree

export function emptiesIn(cwd: string, roots: readonly string[], frozen: readonly string[]) {
  const mdUnder = (root: string): string[] =>
    globSync(root, { cwd }).filter((f) => f.endsWith('.md'))
  const md = roots.flatMap(mdUnder)
  return {
    expectEmptyRoots: roots.filter((r) => mdUnder(r).length === 0),
    // A corpus that loads nothing is left to the empty-source report, so declare no frozen glob then.
    expectEmptyFrozen:
      md.length === 0 ? [] : frozen.filter((g) => !md.some((f) => matchesGlob(f, g))),
  }
}

// The live tree: a static declaration, and no cwd to pass.
export function workCorpus() {
  return corpus({ roots: ROOTS, frozen: FROZEN, expectEmptyFrozen: LIVE_EMPTY_FROZEN })
}

// A fixture tree only. Never call it on the live tree.
export function fixtureCorpus(cwd: string) {
  return corpus({ roots: ROOTS, frozen: FROZEN, cwd, ...emptiesIn(cwd, ROOTS, FROZEN) })
}
```

Keep the two apart by name, not by whether a `cwd` was passed: CI, or a script run from another
directory, passes the live tree's `cwd` too. **Computing the live tree's list would auto-declare a
renamed folder.** Rename `fixed/` and its glob marks nothing; a computed list declares it empty, and
the declaration never expires, which is the false green this release closes. The live list is the
statement that a folder is empty on purpose, so it stays written down and expires when a record lands
there.

**Or mirror the live tree's emptiness in the fixture.** When the test runs a script that builds its
own corpus, and the script carries the live tree's static declaration, make the fixture match it:
write a stub document into each frozen folder the live tree holds records in.

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The script declares ['**/archive/**'] empty, so every other frozen folder must hold a document.
for (const folder of ['fixed', 'completed', 'wont-do']) {
  const file = join(fixtureDir, 'work/x', folder, 'stub.md')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, '# stub\n')
}
```

The first keeps the fixture minimal; the second keeps the script untouched. Either way, the fixture
now says which folders it meant to leave empty.

### `honestyAtClose`: narrow the corpus before you add a label

`honestyAtClose` now reports `ledger/state-under-another-label` for a record with no `State:` line
whose header holds a state from your vocabulary under another label, such as `**Status:** Done`. The
finding suggests `aliases: ['Status']`, and in a corpus where every record writes its state as
`Status:`, that, or `label: 'Status'`, is the fix.

**Do not add the alias blindly in a corpus with several lanes.** In the trial, a ledger corpus over
`work/**` covered plans and bugs, which write `State:`, and refinement topics, which write a lane
`Status:` of their own (`open`, `parked`, `promoted`). Two topics said `Status: open`, which matches
the default vocabulary's `Open`. Adding `aliases: ['Status']` read every topic's status as a ledger
state and gave 224 findings; adding a `State:` line to the topics would have invented a state. The
fix was to narrow the corpus to the lanes that write `State:`. In the trial that took 4 of 394
documents, and 14 of 461 open boxes, out of the ledger's counts. Before you narrow, check that no
done folder leaves with the lanes you drop: see "Narrowing must not drop a closed record" below.

**`ignore` is never judged.** `corpus()` refuses a dead root, but not an `ignore` glob that matches
nothing or matches too much, so a ledger record filed later under an ignored folder glob is skipped
without a word ([bug 0530](https://github.com/nielspeter/eess/blob/main/work/bugs/0530-an-ignore-glob-is-never-judged.md)). Name the exact files, not a folder glob, or narrow `roots` to the lanes that write
`State:` instead, since a root is judged:

```ts
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

// These topics write a lane Status (open/parked/promoted), not a ledger State. Named one by one,
// so a record filed beside them later is still read.
const c = corpus({
  roots: ['work/**'],
  ignore: ['work/refinement/topic-a.md', 'work/refinement/topic-b.md'],
})
honestyAtClose(c)
```

`ledger/no-readable-state`, raised once per call, has the same remedy: the call covers folders that
hold no records, so narrow the corpus's `roots`, or `ignore` the exact files.

A state written as a heading in the header, `## Status: Done`, is now read under the labels in force.
Pass the label your records use: `label: 'Status'`, or `label: 'Status', aliases: ['State']` if they
mix forms.

**Narrowing must not drop a closed record.** `honestyAtClose` treats a record as closed when its path
holds one of its done folders, whatever its header says. Unless you pass `doneFolders`, those are
`completed/`, `fixed/`, `wont-do/`, `delivered/` and `archived/`. A root you remove takes its done
folders with it, and nothing reports that: their records leave every close check, and an open box
in one of them stays open without a finding. After this release, an adopter narrowed its ledger to
its plans and bugs lanes, and so dropped its support lane, whose `delivered/` and `archived/`
folders held closed records. Its own review caught it.

So keep every lane that has a done folder among your `roots`. Check before you narrow, from the
repository root: this lists every tracked Markdown file under a default done folder.

```sh
git ls-files '*.md' | grep -E '(^|/)(completed|fixed|wont-do|delivered|archived)/'
```

Each path it prints must sit under one of the `roots` you pass to the corpus, and under no `ignore`
glob, since `ignore` is never judged. A path outside them is a closed record the close checks no
longer read. Test fixtures that hold such folders are
listed too; they are not records, so skip them. If you pass `doneFolders`, grep for your own list
instead. A lane that writes its state under another label, such as a support lane with
`Status:`, gets a call of its own with that label rather than leaving the ledger (and its own
`states` and `terminalStates`, declared together, if its words differ):

```ts
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

honestyAtClose(corpus({ roots: ['work/plans/**', 'work/bugs/**'] }))
honestyAtClose(corpus({ roots: ['work/support/**'] }), { label: 'Status' })
```

### Box text, links in sections, and the rest

- **Box text.** A closed record whose deferral sits below its box now reds `ledger/deferred-none-lie`
  until its `Deferred:` line names it. A rule that tested a box's `text` sees its other lines, joined
  by single spaces. In the trial this needed no edit in either corpus.
- **`links().areInSection()`.** A rule that relied on a heading inside a list item or blockquote to
  scope links moves the heading to the top level. A rule over a real section may now examine, and
  report, links it used to drop.
- **`haveUniqueTitles`.** A duplicate pair gives two findings, each naming the other, with a new
  message and an element of `<file>:<line> › <title>`. Update tests, baselines and `.excluding()`
  patterns keyed on the old message, count or element. A waiver on one occurrence no longer hides the
  pair: rename the scenario.
- **`adrCitationsResolve`.** Fix or remove each dangling citation it now reports.

## Coming from an earlier release

The trial upgrade also ran from releases well before 0.14. These came from earlier pages, and they
are what it hit, in the order it hit them:

- **`/internal` plumbing** (kernel 0.5.0, [Migrating to v0.5](./migrating-to-0.5.md)):
  `applyFixes` and `clearRegisteredCaches` live on `@nielspeter/eess/internal`. Under pnpm,
  `@nielspeter/eess` must be a direct dependency for `/internal` to resolve.
- **`expect(x.violations()).toEqual([])`** (kernel 0.5.0) fails, because the receipt carries
  `examined`. Use `toHaveLength(0)`.
- **A description snapshot** (eess-ts 0.6.0, [Migrating to eess-ts 0.6](./migrating-to-eess-ts-0.6.md)):
  `noFunctionConstructor`'s description is `Function constructor`, so a snapshot or baseline of rule
  descriptions is out of date. Review it and regenerate it.
- **Ambiguous pointers** (eess-md 0.6.0): a `file:line` pointer whose suffix matches two or more
  files is a violation naming every candidate. Cite a longer suffix.
- **New floor findings** (eess-ts 0.7.0, [Migrating to 0.7](./migrating-to-0.7.md)): the
  `recommended` floor reads callbacks and module code, so expect real findings such as a silent
  `catch {}` there.

```ts
import { applyFixes, clearRegisteredCaches } from '@nielspeter/eess/internal'
```

## New

Every block below is in [the Markdown dialect](./markdown.md).

- **`fields(c, { label, forms })`**: a labelled value in the forms you name, with `resolveAgainst` a
  `Vocabulary` or a whole-value `RegExp`, and `region: 'header'` or `{ section, depth? }`
  ([a labelled value](./markdown.md#a-labelled-value-fields)).
- **`docs().haveField()`** and **`predicateHaveField()`**: a document has a readable value, as a
  selector or a condition ([haveField](./markdown.md#a-document-has-a-value-havefield)).
- **`inDocuments(p)`**, with **`areFrozen()`**, **`areLive()`** and **`predicateHaveSection()`**: a
  document predicate lifted onto boxes, links, pointers, rows, terms and code blocks
  ([inDocuments](./markdown.md#scoping-a-rule-to-documents-indocuments)).
- **`docs().should().agreeWithFolder({ field, groups, direction })`**: a document's value and its folder agree
  ([agreeWithFolder](./markdown.md#a-value-agrees-with-its-folder-agreewithfolder)).
- **`beUniqueBy(key, what)`** on `docs()`, `fields()` and `terms()`: no two share a key
  ([beUniqueBy](./markdown.md#unique-values-beuniqueby)).
- **`corpusFromText(files)`**: a corpus from a map of path to text, for tests
  ([a corpus from text](./markdown.md#a-corpus-from-text-for-tests)).
- **`sections(c)`**: a rule over sections, with `haveSubsection`, `haveTable` and `notExist()`
  ([sections](./markdown.md#inside-each-section-sections)).
- **`inSections(p)`**, with `sectionsNamed`, `sectionsAtDepth`, `sectionsInSection` and
  `sectionsWithSubsection`: a section predicate lifted onto any element on a line of its document
  ([inSections](./markdown.md#inside-matching-sections-insections)).
- **`haveTextMatching(re)`** on `taskItems()`, and **`predicateHaveTextMatching(re)`** over any
  element with a `text` ([inSections](./markdown.md#inside-matching-sections-insections)).
- **`docs().haveTitle(name?)`**, and on `sections()` **`haveContent()`**, **`haveCodeBlock()`**,
  **`haveListItem()`**, **`haveLink()`** and **`haveCodePointer()`**
  ([a document's shape](./markdown.md#a-documents-shape-built-from-blocks)).
- **`region: { section, depth? }`**: a field read only inside a named section
  ([a labelled value](./markdown.md#a-labelled-value-fields)).
- **`haveSection(name, { depth })`**: only a heading at that level counts.
- **`.should().notExist()`** on `docs()`, `links()`, `pointers()`, `rows()`, `terms()`, `taskItems()`
  and `codeBlocks()`, and `resideInFolder`, `resideInFile` and `haveNameMatching` as predicates.

```ts
import {
  corpusFromText,
  fields,
  inDocuments,
  inSections,
  predicateHaveField,
  predicateHaveSection,
  predicateHaveTextMatching,
  sections,
  sectionsNamed,
} from '@nielspeter/eess-md'
```

**How a twin is named (ADR-023).** Where a word is both a method and a free predicate, the method
keeps the plain word and the free predicate takes the `predicate` prefix: `docs().haveSection()` and
`predicateHaveSection()`, `docs().haveField()` and `predicateHaveField()`,
`taskItems().haveTextMatching()` and `predicateHaveTextMatching()`. All three predicates are new in
this release.

For dialect authors, the kernel adds `Predicate.undecided` (ADR-021): a predicate may declare it
cannot judge a subject, and each cause is one unsuppressable finding wherever the verdict depends on
it. New on `@nielspeter/eess/internal`: `uniqueByCondition`, `notExistCondition`,
`cardinalitySelectorFault()`, `globTextFault`, `repoRelativeCorrection`, `membership`, `partition`,
`kleene` and the rest named in the kernel's changelog. The kernel root gains the `Undecided` type.

## Package by package

- **`@nielspeter/eess`**: `Predicate.undecided`; new `/internal` members for dialect authors; a
  misspelt preset `report` mode throws.
- **`@nielspeter/eess-ts`**: `.expectNonEmpty()` on `.notExist()` is reported; strong Kleene
  combinators; the `report` mode check.
- **`@nielspeter/eess-md`**: everything above.
- **`@nielspeter/eess-mermaid`**: a patch, for the kernel's `notExist()` hook. Nothing to do.
- **`@nielspeter/eess-gherkin`**: `haveUniqueTitles` reports every member of a duplicate group;
  `ConditionContext` and `Undecided` re-exported.
- **`@nielspeter/eess-crossvalidate`**: `g`/`y` section matchers read every ADR; the `report` mode
  check.
