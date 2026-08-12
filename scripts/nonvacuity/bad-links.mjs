#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the corpus/links gate must reject a broken internal
 * link. links().that().areInternal().should().resolve() is run over a corpus
 * rooted at scripts/nonvacuity/bad-links/**, whose broken.md links to a file
 * that does not exist. Expected: at least one violation.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = broken link found (gate correctly failed on violating input) — OK
 *   0 = no violation (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, etc.) — the harness treats this as fail
 */
import { corpus, links } from '@nielspeter/eess-md'

let broken
try {
  const c = corpus({ roots: ['scripts/nonvacuity/bad-links/**'] })
  broken = links(c)
    .that()
    .areInternal()
    .should()
    .resolve()
    .rule({ id: 'nonvacuity/broken-links' })
    .violations()
} catch (err) {
  console.error(`bad-links: unexpected error — ${err.message}`)
  process.exit(2)
}

const RULE = 'nonvacuity/broken-links'
const fired = broken.filter((v) => v.ruleId === RULE)
if (fired.length > 0) {
  // Name the rule, not just the count: the harness asserts this token, so a
  // failure from some other rule cannot answer for this gate (bug 0110).
  console.error(`bad-links: ${fired.length} broken internal link(s) found as expected — ${RULE}`)
  for (const v of fired) console.error(`  x ${v.message}`)
  process.exit(1)
}

console.error(`bad-links: no ${RULE} violation detected — gate is vacuous`)
process.exit(0)
