#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the corpus/adr gate must reject an ADR whose enforcement
 * table declares an invalid tier. adrEnforcement() is run over a corpus rooted
 * at scripts/nonvacuity/bad-adr/**, whose only ADR (999-bad.md) declares tier 9.
 * Expected: the `adr/valid-tiers` check fails and adrEnforcement throws.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = invalid tier detected (gate correctly failed on violating input) — OK
 *   0 = no violation (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, etc.) — the harness treats this as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

let c
try {
  c = corpus({ roots: ['scripts/nonvacuity/bad-adr/**'] })
} catch (err) {
  console.error(`bad-adr: unexpected error loading corpus — ${err.message}`)
  process.exit(2)
}

// `adrEnforcement` bundles several checks (sections, tier validity, citation
// resolution). Catching "it threw" would let ANY of them satisfy a gate labelled
// `adr/valid-tiers` — set the fixture's tier to a valid value and break its
// citation instead, and the tier check could be deleted outright with this gate
// still green. That is bug 0109's class, so assert the violation's identity
// rather than the error's existence: `report: 'return'` hands back the
// violations with their ruleIds (ADR-008 — the caller owns reporting).
let violations
try {
  // dir MUST point at the fixture ADRs; the preset default is docs/adr/**.
  violations = adrEnforcement(c, { dir: 'scripts/nonvacuity/bad-adr/**', report: 'return' })
} catch (err) {
  console.error(`bad-adr: unexpected error running adrEnforcement — ${String(err)}`)
  process.exit(2)
}

const tierViolations = violations.filter((v) => v.ruleId === 'adr/valid-tiers')
if (tierViolations.length > 0) {
  console.error(
    `bad-adr: invalid tier rejected as expected — ${tierViolations.length} adr/valid-tiers violation(s)`,
  )
  for (const v of tierViolations) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

console.error(
  `bad-adr: NO adr/valid-tiers violation detected — gate is vacuous ` +
    `(${violations.length} other violation(s): ${[...new Set(violations.map((v) => v.ruleId))].join(', ') || 'none'})`,
)
process.exit(0)
