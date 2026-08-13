#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `findUncoveredLanes` (bug 0121) must fire when a
 * work/-shaped directory carries `State:`-shaped records and no `LANES` entry
 * claims it, and must NOT fire for a claimed directory (`claimed/`, in the
 * passed-in claimed set) or a records-free one (`empty-unclaimed/`, mirroring
 * `work/spikes/`'s real shape today). Two independently-uncovered directories
 * (`unclaimed/`, `unclaimed-second/`) prove the check reports every hit, not
 * just the first — a single-directory version of this fixture cannot catch a
 * regression that silently caps the result at one (found in review: mutating
 * `findUncoveredLanes` to stop after its first push left a one-directory
 * fixture's assertions unchanged). All four live under one root so a single
 * run proves every direction at once.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = fired on both `unclaimed` and `unclaimed-second`, nothing else — OK
 *   0 = missed one or both — the gate is vacuous, or caps its own result
 *   2 = fired on a direction it shouldn't have, or an unexpected error —
 *       the fixture's own premise broke, not the gate proven
 */
import { findUncoveredLanes, UNCOVERED_LANE_RULE } from '../lib/lane-coverage.mjs'

const ROOT = 'scripts/nonvacuity/bad-lane-coverage'
const MUST_FIRE = ['unclaimed', 'unclaimed-second']
const MUST_NOT_FIRE = ['claimed', 'empty-unclaimed']

let violations
try {
  violations = findUncoveredLanes(ROOT, new Set(['claimed']))
} catch (err) {
  console.error(`bad-lane-coverage: unexpected error — ${String(err)}`)
  process.exit(2)
}

const dirs = violations.map((v) => v.element.split('/').pop())

const wrongly = MUST_NOT_FIRE.filter((d) => dirs.includes(d))
if (wrongly.length > 0) {
  console.error(
    `bad-lane-coverage: fired on ${wrongly.join(', ')}, which must not fire — fixture premise broken`,
  )
  process.exit(2)
}
const missing = MUST_FIRE.filter((d) => !dirs.includes(d))
if (missing.length > 0) {
  console.error(
    `bad-lane-coverage: did not fire on ${missing.join(', ')} — gate is vacuous or caps its ` +
      `own result (found: ${dirs.join(', ') || 'none'})`,
  )
  process.exit(0)
}
if (!violations.every((v) => v.rule === UNCOVERED_LANE_RULE)) {
  console.error(`bad-lane-coverage: fired but not as ${UNCOVERED_LANE_RULE} — wrong rule id`)
  process.exit(2)
}

console.error(
  `bad-lane-coverage: ${UNCOVERED_LANE_RULE} fired correctly on both ${MUST_FIRE.join(' and ')} ` +
    `(${MUST_NOT_FIRE.join(', ')} correctly skipped)`,
)
process.exit(1)
