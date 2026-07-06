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

try {
  // dir MUST point at the fixture ADRs; the preset default is docs/adr/**.
  adrEnforcement(c, { dir: 'scripts/nonvacuity/bad-adr/**' })
} catch (err) {
  console.error(`bad-adr: invalid tier rejected as expected — ${err.message.split('\n')[0]}`)
  process.exit(1)
}

console.error('bad-adr: NO violation detected — gate is vacuous')
process.exit(0)
