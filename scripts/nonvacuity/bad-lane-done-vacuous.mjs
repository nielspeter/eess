#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `findLaneDoneVacuity` (bug 0131 round 3) must fire when
 * a lane declares a real `terminalStates` vocabulary but scanned zero done
 * items, and must NOT fire for: a lane with real done-items (`healthy`), a
 * structurally-exempt lane with `terminalStates: []` (`exempt`, mirroring the
 * real `proposals` lane), or a lane that explicitly declares
 * `expectEmptyDone: true` (`declared-empty`, mirroring a freshly-bootstrapped
 * `kit/`-seeded lane).
 *
 * This closes a real gap found in review: `check-ledger.mjs`'s original fix
 * summed done-items across ALL lanes before comparing to zero, so a
 * corruption scoped to just one lane (e.g. only `bugs/`) stayed completely
 * invisible as long as another lane (e.g. `plans/`) still had a nonzero
 * count. Per-lane checking is the only way to catch that — this fixture
 * proves it does, with a healthy lane sitting right alongside the vacuous one
 * so a regression back to summed checking can't hide behind it.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = fired on `vacuous` only — OK
 *   0 = missed it, or fired on a lane it shouldn't have — vacuous
 *   2 = unexpected error
 */
import { findLaneDoneVacuity, LANE_DONE_VACUOUS_RULE } from '../lib/lane-coverage.mjs'

const lanes = [
  { name: 'healthy', terminalStates: ['Done'], doneItems: 5 },
  { name: 'vacuous', terminalStates: ['Done'], doneItems: 0 },
  { name: 'exempt', terminalStates: [], doneItems: 0 },
  { name: 'declared-empty', terminalStates: ['Done'], doneItems: 0, expectEmptyDone: true },
]

let violations
try {
  violations = findLaneDoneVacuity(lanes)
} catch (err) {
  console.error(`bad-lane-done-vacuous: unexpected error — ${String(err)}`)
  process.exit(2)
}

const fired = violations.map((v) => v.element)
if (fired.length !== 1 || fired[0] !== 'vacuous') {
  console.error(
    `bad-lane-done-vacuous: fired on [${fired.join(', ')}], expected exactly ['vacuous'] — ` +
      `gate is vacuous or over-fires`,
  )
  process.exit(fired.includes('vacuous') ? 2 : 0)
}
if (violations[0].rule !== LANE_DONE_VACUOUS_RULE) {
  console.error(`bad-lane-done-vacuous: fired but not as ${LANE_DONE_VACUOUS_RULE}`)
  process.exit(2)
}

console.error(
  `bad-lane-done-vacuous: ${LANE_DONE_VACUOUS_RULE} fired correctly on 'vacuous' only ` +
    `('healthy', 'exempt', 'declared-empty' correctly skipped)`,
)
process.exit(1)
