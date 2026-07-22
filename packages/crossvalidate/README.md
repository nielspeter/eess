# @nielspeter/eess-crossvalidate

Cross-validation presets for the [eess](../../README.md) family — bind two dialects' artifacts and fail the build when they drift.

The generic engine lives in the kernel: [`correspondence()`](../core) binds two element `Selection`s (from any dialects) and checks completeness both ways plus relation preservation. This package ships the **dialect-coupled presets** — the pairs that must import two concrete dialects.

## Mermaid ↔ TypeScript

```typescript
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'

// every class in the diagram exists in code, and vice versa
diagramMatchesCode(diagram('docs/architecture.mmd'), project('tsconfig.json')).check?.()
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

## Peers

The dialects are optional peer dependencies — install the ones your presets use
(`@nielspeter/eess-ts`, `@nielspeter/eess-mermaid`, `@nielspeter/eess-md`,
`@nielspeter/eess-gherkin`).

## License

MIT
