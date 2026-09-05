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
first), and `MdCodeBlock` (`lang`, `value`, `line`). Every `line` is 1-based
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
text after the label, before cleanup — `doc`, `line`). `.resideInFile(glob)`
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
// yields `Billing`, not the whole tail. Fenced code is blanked before scanning,
// so an example in a fence never becomes a reference.
terms(c, { label: /Bounded Context:/ })
  .that()
  .resideInFile('docs/**')
  .should()
  .resolveAgainst(contexts)
  .check()
```

## ADR enforcement tables

`eess-md` ships an `adrEnforcement()` preset that validates the `## Enforcement` table convention: every ADR ends with a **Clause | Tier | Mechanism | Status** table, tiers are valid, and cited file paths resolve. Binding those cited `it('…')` test titles against the real test AST is the cross-validation step — see [`eess-crossvalidate`](/crossvalidate).

`adrEnforcement(corpus, options?)` takes `AdrEnforcementOptions`: `dir` (glob
selecting ADR files, default `docs/adr/**`), `section` (default
`/^enforcement$/i`), `columns` (header patterns for the tier/mechanism/status
columns, default English), `tiers` (valid tier numbers, default `[1,2,3,4,5]`),
and `verifyCitations` (default `true` — turn off to gate on the table's shape
without resolving citations). It extends the kernel's `PresetBaseOptions`, so
`overrides` can downgrade or disable its three rule ids individually
(`adr/enforcement-declared`, `adr/valid-tiers`, `adr/citations-resolve`).

### Citing something that is not a file or a test

`adrEnforcement` resolves two citation forms in a Mechanism cell: a backticked
file path, and an `it('…')` title. A team whose mechanism is a **named rule in
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

// Your citation form. The preset's two are a path and an it('…') title.
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
document's `State:` header line, and reports four things: a done item with an
open box carrying no disposition token (`ledger/silent-open-box`), a
`Deferred: none` summary that contradicts a box disposed as
`deferred→<home>` (`ledger/deferred-none-lie`), a `State:` value that
doesn't match its folder (`ledger/state-folder-mismatch`), and a `State:` value
outside the declared vocabulary (`ledger/unknown-state`).

That last one is the finding a new adopter meets first, and it is a **violation,
not an ignore**: the default vocabulary is `Draft | Ready | Open | Done |
Won't-do`, so a corpus using `In Review` or `Shipped` reds until you pass your own
`states`/`terminalStates`. An unreadable state is reported rather than skipped on
purpose — a record whose status nobody can parse is indistinguishable from one
that has none, which is what bug 0120 is about.

`findState(text, vocabulary)` is the same scan the preset uses to read a
document's status, exported so a caller can ask the question without a second
opinion. It returns `{ state?, raw, line }` or `null`, and the three things it
gets right are the three a hand-rolled regex gets wrong: it strips fenced code
first (so an example `**State:** Draft` inside a fence is not the document's
state), it accepts every label form the corpus uses (`**State:**`, `**State**:`,
`__State__:`, bare `State:`, with or without a bullet), and it canonicalises
apostrophe glyphs so a smart-quoted `Won’t-do` is the same token as `Won't-do`.
`state` is absent when the value is outside `vocabulary` — `raw` still carries
what was written, which is what `ledger/unknown-state` reports.

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
shape), and `expectEmptyHeaders` (declare that a freshly-bootstrapped lane may
legitimately hold zero items yet — the declaration expires the day a real
document appears).

`ledgerStats(corpus, options?)` is the denominator `honestyAtClose` computes
for itself, exposed separately so a caller can print it rather than staying
blind-and-green: a `LedgerStats` — `scanned` (documents considered, board
files excluded), `withReadableState` (…of which carry a `State:` line the
declared vocabulary can read), `unreadableState` (…of which carry one it
can't), and `doneItems` (…of which are done, by folder or by terminal state,
and so ledger-checked). A caller should print this, not re-derive its own copy
of the same expression — this repo's own `scripts/check-ledger.mjs` did once,
and its copy silently disagreed with the preset.

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/md) for the full DSL surface.
