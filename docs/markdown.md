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
  frozen: ['**/completed/**', '**/archived/**'], // historical records: reported, never failed
})

// markdown-to-markdown links resolve
links(c).that().areInternal().should().resolve().check()

// `path:line` code pointers ground against real files
pointers(c).that().areLive().should().resolve().check()
```

## What it checks

- **Links** — internal cross-links between markdown files resolve to real targets. Static-site conventions are supported (extensionless links, `index.md` directories, a site root) via options on `.resolve()`.
- **Pointers** — inline `path:line` references (the code pointers you scatter through plans and ADRs) point at files that exist, at lines that exist. Liveness is fence-aware, so example pointers inside code blocks aren't treated as live claims.
- **Frozen roots** — completed/archived docs describe the world as it was; drift in them is reported but never fails the build.

## Binding a table to code

A markdown table is a spec — a package list, an ADR index. `rows()` turns its body rows into first-class elements, and `.select()` (inherited from the kernel on every eess builder) makes any selection one side of a [`correspondence()`](/crossvalidate). Bind the table to what it describes, and drift either way fails the build:

```typescript
import { corpus, rows } from '@nielspeter/eess-md'
import { correspondence } from '@nielspeter/eess'

const c = corpus({ roots: ['README.md'] })

const packageRows = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ },
}).select({
  label: 'README package row',
  identify: (r) => ({ name: r.get('pkg'), file: r.doc.relPath, line: r.line }),
})

correspondence({ left: packageRows, right: workspacePackages, keyBy: (e) => e.name })
  .should()
  .beComplete({ direction: 'both' })
  .check()
```

Each row carries `get(role)` (located cell text), its real source `line`, and its `doc`/`table`. Rows come from every table matching the section and columns.

## ADR enforcement tables

`eess-md` ships an `adrEnforcement()` preset that validates the `## Enforcement` table convention: every ADR ends with a **Clause | Tier | Mechanism | Status** table, tiers are valid, and cited file paths resolve. Binding those cited `it('…')` test titles against the real test AST is the cross-validation step — see [`eess-crossvalidate`](/crossvalidate).

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/md) for the full DSL surface.
