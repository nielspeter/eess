# @nielspeter/eess-crossvalidate

Cross-validation presets for the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family — bind two dialects' artifacts and fail the build when they drift.

The generic engine lives in the kernel: [`correspondence()`](https://www.npmjs.com/package/@nielspeter/eess) binds two element `Selection`s (from any dialects) and checks completeness both ways plus relation preservation. This package ships the **dialect-coupled presets** — the pairs that must import two concrete dialects.

## Mermaid ↔ TypeScript

```typescript
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'

// every class in the diagram exists in code, and vice versa — throws on drift
diagramMatchesCode(diagram('docs/architecture.mmd'), project('tsconfig.json'))
```

If the code gains a `ModuloOperation` class the diagram doesn't have (or vice
versa), the build fails with a two-sided, actionable message. This supersedes the
deprecated `fromDiagram()` bridge — class-level correspondence, both directions.

## Markdown ↔ TypeScript

```typescript
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'

// every it('…') cited in an ADR enforcement table exists as a real test
adrCitationsResolve(corpus({ roots: ['docs/**'] }), project('tsconfig.json'))
```

AST-grounded: cited titles are resolved against actual `it()` call expressions
(via eess-ts's public API — no ts-morph here, per ADR-007), so it also catches
no-substitution template titles the text-level check misses.

## Markdown ↔ Gherkin

```typescript
import { scenarioCitationsResolve } from '@nielspeter/eess-crossvalidate/md-gherkin'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'

// every scenario a story cites — `checkout.feature` · 'Apply a valid code' —
// resolves to a real scenario in the feature set
scenarioCitationsResolve(
  corpus({ roots: ['docs/**'] }),
  features({ roots: ['features/**/*.feature'] }),
)
```

Spec↔spec: a markdown story cites a behavior — a backticked `.feature` path plus
an optional quoted scenario title — and the citation is resolved against the
loaded feature set. Three failure modes fail the build: the feature file is
missing, the path is ambiguous, or the scenario title doesn't exist. The
`gherkin-ts` preset below is its code↔spec mirror.

## Gherkin ↔ TypeScript

```typescript
import { scenarioTestsResolve } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'

// every scenario a test cites — it('checkout.feature › Apply a valid code') —
// resolves to a real scenario in the feature set
scenarioTestsResolve(project('tsconfig.json'), features({ roots: ['features/**/*.feature'] }))
```

The mirror image of md↔gherkin's story citations: here the citing side is the
**test AST** (`it('…')` titles, read via eess-ts's public API — no ts-morph, per
ADR-007). A scenario renamed or deleted out from under the test that cites it
fails the build. It resolves the citation; it does not claim the test exercises
the scenario's steps (Tier 2, still open).

```typescript
import { scenariosCovered } from '@nielspeter/eess-crossvalidate/gherkin-ts'

// every scenario must be cited by at least one test — the coverage
// (right→left) direction, the complement of scenarioTestsResolve. `include`
// narrows the requirement so not-yet-implemented flows don't force a red
// build.
scenariosCovered(project('tsconfig.json'), features({ roots: ['features/**/*.feature'] }), {
  include: (s) => !s.tags.includes('wip'),
})
```

A scenario shipped with no citing test fails the build. Pair `include` with
`scenarioExemptionsCurrent`'s `isExempt`, below — the two must use the same
tag, and neither has a default, on purpose: a `@wip` scenario excluded from
one but not the other would fail one gate or the other unconditionally.

```typescript
import { scenarioExemptionsCurrent } from '@nielspeter/eess-crossvalidate/gherkin-ts'

// the reverse of scenariosCovered: an exempt scenario must NOT already have a
// citing test. Once a test proves it, the exemption has outlived its reason.
scenarioExemptionsCurrent(
  project('tsconfig.json'),
  features({ roots: ['features/**/*.feature'] }),
  {
    isExempt: (s) => s.tags.includes('wip'),
  },
)
```

An exemption (`@wip` by the convention above, or any tag `isExempt` reads) that
is still in force when a real test starts citing the scenario is a silent hole
in the coverage gate it was meant to narrow — the exemption should have been
removed the moment the work landed. The violation names both the scenario and
the citing test's own `file`/`line`.

## Markdown ↔ Mermaid

```typescript
import {
  embeddedDiagramsMatchCode,
  embeddedDiagramStats,
} from '@nielspeter/eess-crossvalidate/md-mermaid'
```

A ```mermaid fence embedded in a Markdown page must match the code it claims to
describe — a diagram that drifts from the source is a document that lies while
looking authoritative.

Only **class diagrams** are compared. A fence declaring another kind
(`sequenceDiagram`, `flowchart`, `gantt`, …) is skipped as a different artifact,
not treated as a broken class diagram; a fence whose kind is unrecognised is
still handed to the parser, so an unknown diagram costs a loud finding rather
than silent coverage loss. `embeddedDiagramStats` reports what was compared —
`documents`, `diagrams`, and the `skipped` count — so a pass is evidence rather
than a default:

```typescript
const docs = corpus({ roots: ['docs/architecture.md'] })
embeddedDiagramsMatchCode(docs, project('tsconfig.json'), { completeness: 'both' })

const stats = embeddedDiagramStats(docs)
if (stats.diagrams === 0) throw new Error('selected zero class diagrams — green-but-empty')
```

`diagrams` counts fences **selected**, not classes compared — a fence that turns
out not to parse is selected and then reported. Pair the guard with
`completeness: 'both'` if you also want an emptied diagram to fail.

## Markdown ↔ Mermaid ER

```typescript
import { tableErAgree, tableErStats } from '@nielspeter/eess-crossvalidate/md-mermaid-er'
```

An ER diagram and the table it documents must agree. `tableErStats` reports what
was compared, so a pass is evidence rather than a default.

## Files

```typescript
import { files } from '@nielspeter/eess-crossvalidate/files'
```

A file-set loader for binding a side of a correspondence to paths on disk rather
than to a parsed dialect.

## Peers

The dialects are optional peer dependencies — install the ones your presets use
(`@nielspeter/eess-ts`, `@nielspeter/eess-mermaid`, `@nielspeter/eess-md`,
`@nielspeter/eess-gherkin`).

## License

MIT
