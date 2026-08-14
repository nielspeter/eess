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
import { adrCitationsResolve, adrCitationStats } from '@nielspeter/eess-crossvalidate/md-ts'
import {
  scenarioTestsResolve,
  scenariosCovered,
  scenarioExemptionsCurrent,
  scenarioTestStats,
} from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { features, scenarios } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import { corpus } from '@nielspeter/eess-md'

// --format json/github — every gate call below threads this through so a
// throwing preset's own finishPreset writes a machine-readable block to
// stdout before it throws (plan 0145, bug 0110's precedent: check-baseline.mjs
// added this so a non-vacuity fixture could assert on ruleId instead of the
// rendered rule description, which any rewording would break). `gate()`'s own
// OK/FAILED lines stay on stderr either way — this only changes what a
// throwing preset additionally writes to stdout.
const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
const opts = format === undefined ? {} : { format }

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
      ...opts,
    },
  ),
)

// dir MUST be set: the preset default is 'docs/adr/**' and our ADRs live at
// /adr — omitting it would silently check zero documents (green-but-empty).
// The DEV tsconfig (includes tests/) — the build tsconfig excludes tests, so
// cited it() titles would never resolve against it (this gate caught exactly
// that misconfiguration on first run with real citations).
gate('ADR↔test (citations resolve in the AST)', () => {
  const adrs = corpus({ roots: ['adr/**'] })
  adrCitationsResolve(adrs, project('packages/ts/tsconfig.json'), { dir: 'adr/**', ...opts })
  // The denominator this gate ran on. A preset that resolves zero citations
  // reports OK, so without a count a drifted `dir`/`roots` reads as a clean pass
  // (CLAUDE.md: "if a count reads zero, treat that as a red flag"). Counted by
  // the preset's own extractor, so the number cannot disagree with what it saw.
  const s = adrCitationStats(adrs, { dir: 'adr/**' })
  console.error(`  ADR↔test — ${s.citations} citations across ${s.adrs} ADRs`)
})

// scenario↔test — eess-crossvalidate's own scenario↔test binding contract
// (specs/scenario-binding.feature) is proven by tests whose it() titles cite it;
// this gate fails if a scenario is renamed/deleted (resolve) or left uncited
// (covered). Scoped via a dedicated tsconfig to ONE spec test, so the gherkin-ts
// *fixtures* — whose .cases.ts carry citation-shaped it() titles by design —
// never pollute it. (The same 'scope the project' lesson the ADR gate learned.)
// `**/*.feature` (not `*.feature`) so a nested spec can't slip in ungated.
//
// EESS_CROSSVAL_GHERKIN_ROOT (plan 0145): overrides the corpus these three
// gates read, matching EESS_RELEASE_BASE's precedent — the real production
// script, run against a throwaway corpus, rather than a rebuilt copy of the
// rule (bug 0127's lesson). Only these three gates read it; diagram↔code and
// ADR↔test are unaffected, so a fixture pointing this at a throwaway
// directory can never mask drift in the other two.
const gherkinRoot = process.env.EESS_CROSSVAL_GHERKIN_ROOT ?? 'packages/crossvalidate/specs'
const scenarioSpecs = features({
  cwd: gherkinRoot,
  roots: ['**/*.feature'],
})
const scenarioSpecProject = project(`${gherkinRoot}/gate.tsconfig.json`)

gate('scenario↔test (every citation resolves)', () =>
  scenarioTestsResolve(scenarioSpecProject, scenarioSpecs, opts),
)

// Precondition for sound coverage: scenariosCovered keys on `relPath + title`,
// so duplicate titles in a file would let one citation cover its twin. Enforce
// eess-gherkin's own haveUniqueTitles here so that can't happen.
gate('scenario↔test (scenario titles are unique)', () =>
  scenarios(scenarioSpecs).should().haveUniqueTitles().check(),
)

// `@wip`-tagged scenarios are exempt from the coverage requirement — paired
// with scenarioExemptionsCurrent below, which requires the same tag be
// removed once cited. Neither option defaults to `@wip` (plan 0145): the two
// must never be able to silently disagree about the same tag.
const isWip = (s) => s.tags.includes('wip')

gate('scenario↔test (every scenario is proven by a test)', () => {
  scenariosCovered(scenarioSpecProject, scenarioSpecs, { include: (s) => !isWip(s), ...opts })
  // scenarioTestStats's own `scenarios` count is unfiltered — printing it
  // unchanged here would silently stop matching what this gate now actually
  // requires the moment `include` narrows it (plan 0145). Print the count
  // this gate itself gated on.
  const s = scenarioTestStats(scenarioSpecProject, scenarioSpecs)
  const inScope = scenarioSpecs.scenarios().filter((sc) => !isWip(sc)).length
  console.error(`  scenario↔test — ${s.citations} citations across ${inScope} in-scope scenarios`)
})

// scenario↔exemption — the complement of the gate above: an exempt scenario
// must not already have a citing test (proposal 005 / plan 0145). The
// population this gate examines (exempt scenarios) is empty in the steady
// state whenever nobody has written a `@wip` tag — a disjointness-shaped
// check is structurally an "empty green" machine, so the denominator is
// printed explicitly rather than left implicit in a bare OK.
gate('scenario↔exemption (no exempt scenario is already cited)', () => {
  scenarioExemptionsCurrent(scenarioSpecProject, scenarioSpecs, { isExempt: isWip, ...opts })
  const exempt = scenarioSpecs.scenarios().filter(isWip).length
  console.error(`  scenario↔exemption — ${exempt} exempt scenario(s) evaluated`)
})

process.exit(failures > 0 ? 1 : 0)
