#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the crossval gate must reject a diagram that disagrees
 * with the code. diagramMatchesCode() with completeness 'both' is run against
 * scripts/nonvacuity/ghost-diagram.mmd (declares GhostClassXyz, which the kernel
 * does NOT contain) over packages/core/src. Expected: it throws ArchRuleError.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = expected drift detected (gate correctly failed on violating input) — OK
 *   0 = NO drift detected (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, etc.) — the harness treats this as fail
 */
import { diagramMatchesCode } from '@nielspeter/eess-crossvalidate/mermaid-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { project } from '@nielspeter/eess-ts'

try {
  diagramMatchesCode(
    diagram('scripts/nonvacuity/ghost-diagram.mmd'),
    project('packages/core/tsconfig.build.json'),
    { scope: '**/packages/core/src/**' },
  )
} catch (err) {
  // ArchRuleError from the correspondence check — the intended failure.
  console.error(`bad-crossval: drift detected as expected — ${err.message.split('\n')[0]}`)
  process.exit(1)
}

console.error('bad-crossval: NO drift detected — gate is vacuous')
process.exit(0)
