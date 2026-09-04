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

adrEnforcement(c, { dir: 'docs/adr/**' }) // section+table present, valid tiers, citations resolve
```

An index/schema doc in the ADR directory (`README.md` or `index.md`) is exempt —
it isn't an ADR, so it isn't required to carry an `## Enforcement` table.

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

## License

MIT
