#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the md↔gherkin gate must reject a markdown citation
 * that names a scenario title absent from the cited feature file.
 * scenarioCitationsResolve() is run over
 * scripts/nonvacuity/bad-md-gherkin/cites-missing-scenario.md, which cites the
 * real scenario-binding.feature (so only the title is wrong) against the real
 * feature set. This is the load-bearing proof for md↔gherkin: check-crossval's
 * own `citations` floor (plan 0096 Phase 1) counts citations, not resolved
 * titles, so it cannot reach the title-resolution path — only this fixture can.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = expected title-missing violation detected (gate correctly failed) — OK
 *   0 = NO violation detected (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { scenarioCitationsResolve } from '@nielspeter/eess-crossvalidate/md-gherkin'
import { features } from '@nielspeter/eess-gherkin'

const ROOT = 'packages/crossvalidate/specs'
const RULE = 'crossval/scenario-citations-resolve'

const set = () => features({ cwd: ROOT, roots: ['**/*.feature'] })

// The clean direction, so a gate stuck permanently red cannot pass for a
// working one: docs/crossvalidate.md's real citation (planted by plan 0096
// Phase 1) must resolve with zero violations against the real feature set.
try {
  scenarioCitationsResolve(corpus({ roots: ['docs/crossvalidate.md'] }), set())
} catch (err) {
  console.error(
    `bad-md-gherkin: docs/crossvalidate.md's real citation failed to resolve — the ` +
      `fixture's premise is broken, not the gate proven — ${String(err)}`,
  )
  process.exit(2)
}

try {
  scenarioCitationsResolve(
    corpus({ roots: ['scripts/nonvacuity/bad-md-gherkin/cites-missing-scenario.md'] }),
    set(),
  )
} catch (err) {
  if (!(err instanceof ArchRuleError)) {
    console.error(`bad-md-gherkin: unexpected error (not ArchRuleError) — ${String(err)}`)
    process.exit(2)
  }
  // Assert WHICH submode fired, not that something did (bug 0110) —
  // scenarioCitationsResolve emits the identical ruleId for all three of its
  // failure modes (missing file, ambiguous suffix, missing scenario title),
  // one shared `v()` helper in md-gherkin.ts. ruleId alone can't tell them
  // apart; the planted citation is engineered so exactly the title-missing
  // submode fires.
  const missing = err.violations.filter(
    (v) => v.ruleId === RULE && /no such scenario in that feature file/.test(v.message),
  )
  if (missing.length === 0) {
    const seen = [...new Set(err.violations.map((v) => v.ruleId))].join(', ') || 'none'
    console.error(
      `bad-md-gherkin: threw, but no title-missing ${RULE} violation — gate is vacuous ` +
        `(ruleIds: ${seen})`,
    )
    process.exit(0)
  }
  console.error(
    `bad-md-gherkin: title-missing citation detected as expected — ${RULE}, ` +
      `${missing.length} violation(s)`,
  )
  for (const v of missing) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

console.error(
  `bad-md-gherkin: NO ${RULE} violation detected — a citation naming a missing scenario ` +
    `title resolved; gate is vacuous`,
)
process.exit(0)
