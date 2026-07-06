# Cross-validation — `eess-crossvalidate`

Bind two dialects' artifacts and **fail the build when they drift**. This is what makes eess artifacts _siblings_ rather than one being the source of truth for the others: a diagram and its code, or an ADR and its tests, are held in agreement in both directions.

The generic engine lives in the kernel: `correspondence()` binds two element `Selection`s (from any dialects) and checks completeness both ways plus relation preservation. This package ships the **dialect-coupled presets** — the pairs that must import two concrete dialects.

## Install

```bash
npm install -D @nielspeter/eess-crossvalidate
```

## Mermaid ↔ TypeScript

Every class in the diagram must exist in code, and every class in code must appear in the diagram:

```typescript
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'

diagramMatchesCode(diagram('docs/architecture.mmd'), project('tsconfig.json')).check?.()
```

If the code gains a class the diagram doesn't have (or vice versa), the build fails with a two-sided, actionable message — class-level correspondence, both directions.

## Markdown ↔ TypeScript

Every `it('…')` cited in an ADR's enforcement table must exist as a real test:

```typescript
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'

adrCitationsResolve(corpus({ roots: ['docs/**'] }), project('tsconfig.json'), {
  dir: 'docs/adr/**',
})
```

This closes the loop `eess-md` opens: `eess-md` checks the table is well-formed; `eess-crossvalidate` checks its citations resolve against the compiled test AST — so an ADR can't claim a test that doesn't exist, and a renamed test can't silently orphan its ADR.

## Coverage is just a direction

`beComplete()` takes a `direction`, and that one option is also the **coverage** primitive. A correspondence checks two things at once:

- `left-to-right` — every spec claim has a code counterpart (no _lying_ spec).
- `right-to-left` — every code artifact has a spec claim (no _unclaimed_ code).

The right-to-left half is coverage: run it and "every exported class is named in the diagram" or "every workspace package has a README row" becomes a build failure, not a hope. `direction: 'both'` asserts both — the spec is total over the code, and the code is total over the spec. This is the same move as the ADR `## Enforcement` table (gate on declaredness, not on hardness), pointed at code instead of clauses: it converts the _unclaimed_ surface from unknown into a failing list.

### Coverage against several specs at once

A `Selection` is a plain object (`{ elements, label, identify }`), so a code artifact can be considered "claimed" if it appears in **any** of several specs — just concatenate their selections before the correspondence:

```typescript
const claimedAnywhere = {
  label: 'spec artifact',
  identify: (e) => e.identify(e),
  elements: [...diagramClasses.elements, ...specTableRows.elements],
}
```

No kernel change — the merge is ordinary code. Bind `claimedAnywhere` right-to-left against the code selection and a class claimed by neither the diagram nor a spec table fails the gate.

See the [package README](https://github.com/NielsPeter/eess/tree/main/packages/crossvalidate) for both presets and the underlying `correspondence()` primitive.
