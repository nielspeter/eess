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
import { ArchRuleError } from '@nielspeter/eess'
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
  // Only an ArchRuleError is the intended failure. A parse error, a missing
  // fixture, or any other throw is a broken harness, not a detected violation —
  // reporting it as success is bug 0109, which this file demonstrated.
  if (!(err instanceof ArchRuleError)) {
    console.error(`bad-crossval: unexpected error (not ArchRuleError) — ${String(err)}`)
    process.exit(2)
  }
  // Being an ArchRuleError is still not enough. `diagramMatchesCode` checks
  // completeness in BOTH directions and this fixture violates both, so the
  // code→diagram half alone would satisfy a gate labelled for the diagram→code
  // half — delete the direction under test and the gate stays green. Assert the
  // direction, not just the failure. (`diagramMatchesCode` returns void — bug
  // 0097 — so the violations are read off the thrown error, not a return value.)
  const ghost = err.violations.filter(
    (v) => v.ruleId === 'crossval/diagram-completeness' && /has no matching TS class/.test(v.message),
  )
  if (ghost.length === 0) {
    const seen = [...new Set(err.violations.map((v) => v.ruleId))].join(', ') || 'none'
    console.error(
      `bad-crossval: threw, but no diagram→code violation — gate is vacuous for the direction it names (ruleIds: ${seen})`,
    )
    process.exit(0)
  }
  console.error(
    `bad-crossval: drift detected as expected — ${ghost.length} diagram class(es) absent from the code: ${ghost.map((v) => v.element).join(', ')}`,
  )
  process.exit(1)
}

console.error('bad-crossval: NO drift detected — gate is vacuous')
process.exit(0)
