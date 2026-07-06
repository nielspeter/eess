# @nielspeter/eess-md

Architecture testing for a **Markdown corpus** — the Markdown dialect of the [eess](../../README.md) family. _Specifications you can run._

A repo's markdown (docs, ADRs, plans) should stay honest: cross-links resolve, code pointers point at real lines, and — if you use them — ADRs declare how they're enforced. `eess-md` validates all of that on the shared [`@nielspeter/eess`](../core) kernel, so you write a declarative rules file, not a custom validator script.

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
  frozen: ['**/completed/**', '**/archived/**'], // historical records: reported, never failed
})

// markdown-to-markdown links resolve
links(c).that().areInternal().should().resolve().check()

// `path:line` code pointers ground against real files
// (resolves by unique path-suffix: `admin/index.vue` matches the one file
//  ending with it; pass `{ paths: 'exact' }` to require full repo paths)
pointers(c).that().areLive().should().resolve().check()

// documents have the sections/tables they should
docs(c).that().resideInFolder('docs/adr/**').should().haveSection('Context').check()
```

`docs()`, `links()`, and `pointers()` are entry points on the same fluent
`.that().should().check()` chain as every other eess dialect — with `.because()`,
`.warn()`, `.excluding()`, and baseline mode all working unchanged.

## Binding a spec table to code: `rows()` + `correspondence()`

A markdown table is a **spec** — a package list, an ADR index, a field
reference. `rows()` turns its body rows into first-class elements, and
`.select()` (inherited from the kernel, on every eess builder) turns any
selection into one side of a `correspondence()`. Bind a table to what it
describes and drift in either direction fails the build:

```typescript
import { corpus, rows } from '@nielspeter/eess-md'
import { correspondence } from '@nielspeter/eess'

const c = corpus({ roots: ['README.md'] })

// each body row of the "Packages" table becomes a selectable element
const packageRows = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ }, // role → header pattern
}).select({
  label: 'README package row',
  identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
})

// `workspacePackages` is a plain Selection you build from the filesystem
correspondence({ left: packageRows, right: workspacePackages, keyBy: (e) => e.name })
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
