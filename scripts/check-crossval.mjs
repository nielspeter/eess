#!/usr/bin/env node
/**
 * Dogfood: cross-validate this repo's own spec artifacts against its code with
 * eess-crossvalidate (plan 0060 Phase 2).
 *
 * Wiring note: the crossvalidate presets return void and throw ArchRuleError —
 * they cannot live in an eess-ts CLI rule file (the loader only accepts
 * .check()-able builders), so this is a script, matching check-corpus.mjs.
 *
 *  1. diagram ↔ code — docs/architecture.mmd must agree with the kernel's
 *     classes in BOTH directions, within the a-priori charter declared in the
 *     diagram itself (plan 0060 Phase 1): kernel classes only. The scope below
 *     IS that charter, not a reaction to any check result.
 *  2. ADR ↔ test — every `it('…')` title cited in an ADR Enforcement table
 *     must exist in the actual test AST. (Non-vacuous once the Phase 3 ADR
 *     migration lands Enforcement tables; the harness in Phase 6 proves it.)
 *
 * Run: `npm run check:crossval`. Exits non-zero on drift.
 */
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import {
  scenarioTestsResolve,
  scenariosCovered,
  scenarioTestStats,
} from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { features, scenarios } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import { corpus } from '@nielspeter/eess-md'

let failures = 0
const gate = (name, fn) => {
  try {
    fn()
    console.error(`crossval: ${name} — OK`)
  } catch (err) {
    failures++
    console.error(`crossval: ${name} — FAILED`)
    console.error(err.message)
  }
}

gate('diagram↔code (kernel charter, both directions)', () =>
  diagramMatchesCode(
    diagram('docs/architecture.mmd'),
    project('packages/core/tsconfig.build.json'),
    {
      scope: '**/packages/core/src/**',
    },
  ),
)

// dir MUST be set: the preset default is 'docs/adr/**' and our ADRs live at
// /adr — omitting it would silently check zero documents (green-but-empty).
// The DEV tsconfig (includes tests/) — the build tsconfig excludes tests, so
// cited it() titles would never resolve against it (this gate caught exactly
// that misconfiguration on first run with real citations).
gate('ADR↔test (citations resolve in the AST)', () =>
  adrCitationsResolve(corpus({ roots: ['adr/**'] }), project('packages/ts/tsconfig.json'), {
    dir: 'adr/**',
  }),
)

// scenario↔test — eess-crossvalidate's own scenario↔test binding contract
// (specs/scenario-binding.feature) is proven by tests whose it() titles cite it;
// this gate fails if a scenario is renamed/deleted (resolve) or left uncited
// (covered). Scoped via a dedicated tsconfig to ONE spec test, so the gherkin-ts
// *fixtures* — whose .cases.ts carry citation-shaped it() titles by design —
// never pollute it. (The same 'scope the project' lesson the ADR gate learned.)
// `**/*.feature` (not `*.feature`) so a nested spec can't slip in ungated.
const scenarioSpecs = features({
  cwd: 'packages/crossvalidate/specs',
  roots: ['**/*.feature'],
})
const scenarioSpecProject = project('packages/crossvalidate/specs/gate.tsconfig.json')

gate('scenario↔test (every citation resolves)', () =>
  scenarioTestsResolve(scenarioSpecProject, scenarioSpecs),
)

// Precondition for sound coverage: scenariosCovered keys on `relPath + title`,
// so duplicate titles in a file would let one citation cover its twin. Enforce
// eess-gherkin's own haveUniqueTitles here so that can't happen.
gate('scenario↔test (scenario titles are unique)', () =>
  scenarios(scenarioSpecs).should().haveUniqueTitles().check(),
)

gate('scenario↔test (every scenario is proven by a test)', () => {
  scenariosCovered(scenarioSpecProject, scenarioSpecs)
  const s = scenarioTestStats(scenarioSpecProject, scenarioSpecs)
  console.error(`  scenario↔test — ${s.citations} citations across ${s.scenarios} scenarios`)
})

process.exit(failures > 0 ? 1 : 0)
