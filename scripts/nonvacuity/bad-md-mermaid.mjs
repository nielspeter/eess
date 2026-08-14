#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the md↔mermaid gate must reject an embedded diagram
 * that disagrees with the code, in EITHER direction, and must not be fooled by
 * an emptied fence (an empty diagram vacuously satisfies leftUnmatched under
 * the left-to-right default — plan 0096's whole reason for completeness:
 * 'both'). Three cases, all three required to pass before this fixture prints
 * its sentinel (the bad-md-ts.mjs clean+dangling contract, extended to three —
 * a single gates-array row, crossval/embedded-diagram, covering all of them):
 *
 *   1. drifted-diagram.md — a class the code lacks → leftUnmatched →
 *      crossval/embedded-diagram, "has no matching TS class".
 *   2. emptied-diagram.md — a content-free classDiagram fence → under
 *      completeness 'both', every real kernel class becomes unmatched on the
 *      code side → rightUnmatched → crossval/embedded-diagram, "has no
 *      matching diagram class".
 *   3. clean-diagram.md — docs/architecture.mmd's real content, embedded
 *      verbatim → zero violations (the sanity check: a gate stuck permanently
 *      red cannot pass for a working diagram either).
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = both drift cases detected as expected, clean case clean — OK
 *   0 = any case behaved wrong (gate is vacuous) — the harness treats this as fail
 *   2 = unexpected error, or a case's own premise broke — treated as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { embeddedDiagramsMatchCode } from '@nielspeter/eess-crossvalidate/md-mermaid'
import { project } from '@nielspeter/eess-ts'

const RULE = 'crossval/embedded-diagram'
const ROOT = 'scripts/nonvacuity/bad-md-mermaid'
const opts = { scope: '**/packages/core/src/**', completeness: 'both', report: 'return' }

const run = (doc) =>
  embeddedDiagramsMatchCode(corpus({ roots: [`${ROOT}/${doc}`] }), project('packages/core/tsconfig.build.json'), opts)

let drifted, emptied, clean
try {
  drifted = run('drifted-diagram.md')
  emptied = run('emptied-diagram.md')
  clean = run('clean-diagram.md')
} catch (err) {
  console.error(`bad-md-mermaid: unexpected error — ${String(err)}`)
  process.exit(2)
}

// The clean direction first, so a gate stuck permanently red cannot pass for a
// working diagram either.
if (clean.length > 0) {
  console.error(
    `bad-md-mermaid: the clean-direction fixture (docs/architecture.mmd embedded verbatim) ` +
      `produced ${clean.length} violation(s) — the fixture's premise is broken, not the gate ` +
      `proven — ${clean.map((v) => v.message.split('\n')[0]).join('; ')}`,
  )
  process.exit(2)
}

// Assert WHICH submode fired, not that something did (bug 0110) —
// embeddedDiagramsMatchCode emits the identical crossval/embedded-diagram for
// both leftUnmatched and rightUnmatched; ruleId alone can't tell them apart.
const ghostClass = drifted.filter(
  (v) => v.ruleId === RULE && /has no matching TS class/.test(v.message),
)
if (ghostClass.length === 0) {
  const seen = [...new Set(drifted.map((v) => v.ruleId))].join(', ') || 'none'
  console.error(
    `bad-md-mermaid: drifted-diagram.md produced no leftUnmatched ${RULE} violation — gate is ` +
      `vacuous for that direction (ruleIds: ${seen})`,
  )
  process.exit(0)
}

const emptiedFence = emptied.filter(
  (v) => v.ruleId === RULE && /has no matching diagram class/.test(v.message),
)
if (emptiedFence.length === 0) {
  const seen = [...new Set(emptied.map((v) => v.ruleId))].join(', ') || 'none'
  console.error(
    `bad-md-mermaid: emptied-diagram.md produced no rightUnmatched ${RULE} violation — the ` +
      `completeness: 'both' fix does not actually close the emptied-fence hole (ruleIds: ${seen})`,
  )
  process.exit(0)
}

console.error(
  `bad-md-mermaid: drift detected as expected in both directions — ${RULE}, ` +
    `${ghostClass.length} ghost-class violation(s), ${emptiedFence.length} emptied-fence ` +
    `violation(s); clean diagram produced none`,
)
process.exit(1)
