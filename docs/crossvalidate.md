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

## Markdown ↔ Gherkin

Every scenario a markdown story cites — a backticked `.feature` path plus an optional quoted title — must exist in the loaded feature set:

```typescript
import { scenarioCitationsResolve } from '@nielspeter/eess-crossvalidate/md-gherkin'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'

// a story cites `checkout.feature` · 'Apply a valid code'
scenarioCitationsResolve(
  corpus({ roots: ['docs/**'] }),
  features({ roots: ['features/**/*.feature'] }),
)
```

Three failure modes fail the build: the cited feature file is missing, the path is ambiguous, or the scenario title doesn't exist. Spec↔spec — it binds a _story_ to the _behaviour spec_ it references, so a renamed or deleted scenario can't silently orphan the story that cites it.

## Gherkin ↔ TypeScript

The mirror image of the above, one layer down: instead of a story citing a scenario, a **test** cites the scenario it proves — in its `it()` title, using the same convention. Both directions are gated:

```typescript
import { scenarioTestsResolve, scenariosCovered } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'

const set = features({ roots: ['features/**/*.feature'] })
const p = project('tsconfig.json')

scenarioTestsResolve(p, set) // every it('checkout.feature › Apply a valid code') resolves
scenariosCovered(p, set) // every scenario is cited by at least one test
```

`scenarioTestsResolve` catches a test orphaned by a renamed or deleted scenario; `scenariosCovered` catches a scenario shipped with no test at all — the pincer that keeps `.feature` files and the test suite from drifting apart. The citation is read from the test AST via eess-ts's public API (no ts-morph, per ADR-007), so it also sees `it.only`, `it.skip`, and the `test` alias. Because coverage keys on `relPath + title`, pair it with eess-gherkin's `haveUniqueTitles` so duplicate scenario titles can't let one citation cover its twin.

**Honest scope:** it proves a test _cites_ a scenario, not that the test _exercises_ its behaviour — that last step is Tier 2, still open. eess dogfoods this pairing on itself: `packages/crossvalidate/specs/scenario-binding.feature` is a use case, proven by a test whose `it()` titles cite its scenarios, gated live in `check:crossval`.

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
