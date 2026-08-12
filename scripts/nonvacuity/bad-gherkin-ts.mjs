#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the scenario↔test gate must reject a test that cites a
 * scenario the feature set does not contain. scenarioTestsResolve() is run with
 * the committed gherkin-ts `red` fixture project (whose it() titles cite a
 * missing feature, an ambiguous suffix, and an absent scenario title) against
 * the `features/**` set. Expected: it throws ArchRuleError.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = expected dangling citation detected (gate correctly failed) — OK
 *   0 = NO drift detected (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, etc.) — the harness treats this as fail
 */
import { ArchRuleError } from '@nielspeter/eess'
import { scenarioTestsResolve } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'

const root = 'packages/crossvalidate/tests/fixtures/gherkin-ts'

try {
  scenarioTestsResolve(
    project(`${root}/red/tsconfig.json`),
    features({ cwd: root, roots: ['features/**'] }),
  )
} catch (err) {
  // Only an ArchRuleError is the intended failure. Anything else — a missing
  // fixture project, a parse error — is a broken harness, not a detected
  // violation. Reporting it as success is bug 0109.
  if (!(err instanceof ArchRuleError)) {
    console.error(`bad-gherkin-ts: unexpected error (not ArchRuleError) — ${err.message}`)
    process.exit(2)
  }
  console.error(
    `bad-gherkin-ts: dangling citation detected as expected — ${err.message.split('\n')[0]}`,
  )
  process.exit(1)
}

console.error('bad-gherkin-ts: NO drift detected — gate is vacuous')
process.exit(0)
