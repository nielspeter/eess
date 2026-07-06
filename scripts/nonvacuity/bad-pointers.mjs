#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the corpus/pointers gate must reject an unresolvable
 * live code pointer. pointers().that().areLive().should().resolve() runs over
 * scripts/nonvacuity/bad-pointers/**, whose stale.md cites a nonexistent file.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = unresolved pointer found (gate correctly failed) — OK
 *   0 = no violation (gate vacuous — harness fail)
 *   2 = unexpected error — harness fail
 */
import { corpus, pointers } from '@nielspeter/eess-md'

let stale
try {
  const c = corpus({ roots: ['scripts/nonvacuity/bad-pointers/**'] })
  stale = pointers(c)
    .that()
    .areLive()
    .should()
    .resolve()
    .rule({ id: 'nonvacuity/pointers-resolve' })
    .violations()
} catch (err) {
  console.error(`bad-pointers: unexpected error — ${err.message}`)
  process.exit(2)
}

if (stale.length > 0) {
  console.error(`bad-pointers: ${stale.length} unresolved pointer(s) found as expected`)
  process.exit(1)
}

console.error('bad-pointers: NO unresolved pointer detected — gate is vacuous')
process.exit(0)
