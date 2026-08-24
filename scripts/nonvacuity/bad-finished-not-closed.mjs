#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `ledger/finished-not-closed` must fire on a record whose
 * ledger is fully ticked while its State is still open, and must NOT fire on the
 * two shapes that look similar.
 *
 * The rule is the reverse of `honestyAtClose`: that one proves a DONE item hides
 * no open box, this one proves an OPEN item is not secretly finished. It was
 * written after 0170 and 0171 sat fully ticked, zero open, "ready to close", for
 * five days with `check:ledger` green over them.
 *
 * The two controls are the point, not padding. A rule that fires on
 * "every box ticked" alone would also fire on every correctly-closed record in
 * the corpus (0003) and would be useless; one that ignored the open count would
 * fire on ordinary work in progress (0002). Only the conjunction is the defect,
 * so only the conjunction is asserted.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = fired on 0001 and stayed silent on the controls — OK
 *   0 = did not fire, or fired on a control (vacuous / over-broad) — fail
 *   2 = unexpected error — fail
 */
import {
  findFinishedNotClosed,
  FINISHED_NOT_CLOSED_RULE,
  FINISHED_NOT_CLOSED_VACUOUS_RULE,
} from '../lib/finished-not-closed.mjs'

const ROOT = 'scripts/nonvacuity/bad-finished-not-closed'

try {
  const { violations: found, examined } = findFinishedNotClosed([
    { roots: [`${ROOT}/**`], terminalStates: ['Fixed', 'Rejected'], states: ['Draft'] },
  ])
  const named = found.map((v) => v.element)
  if (examined === 0) {
    console.error(
      `bad-finished-not-closed: examined 0 records — the fixture's own corpus did not load, ` +
        `so nothing below proves anything`,
    )
    process.exit(2)
  }

  const hitTarget = named.some((f) => f.includes('0001-finished-but-open'))
  const hitControls = named.filter(
    (f) => f.includes('0002-still-open') || f.includes('0003-properly-closed'),
  )
  const wrongRule = found.filter((v) => v.rule !== FINISHED_NOT_CLOSED_RULE)

  if (!hitTarget) {
    console.error(
      `bad-finished-not-closed: did NOT fire on a fully-ticked, still-open record — ` +
        `the rule is vacuous (saw ${found.length} finding(s))`,
    )
    process.exit(0)
  }
  if (hitControls.length > 0) {
    console.error(
      `bad-finished-not-closed: fired on a control (${hitControls.join(', ')}) — ` +
        `the rule is over-broad, and would red every closed record or every open one`,
    )
    process.exit(0)
  }
  if (wrongRule.length > 0) {
    console.error(`bad-finished-not-closed: emitted a foreign rule id: ${wrongRule[0].rule}`)
    process.exit(2)
  }
  // The vacuity guard is itself a way to fail the build, so it gets proved here
  // too. Review demonstrated what its absence cost: point the scan at a root that
  // loads nothing, and the gate examined zero records, found zero findings, and
  // printed a confident green quoting a 170-record denominator that came from a
  // different derivation entirely.
  const emptyLane = findFinishedNotClosed([
    { roots: ['scripts/nonvacuity/__no_such_dir__/**'], terminalStates: ['Fixed'] },
  ])
  const criedVacuous = emptyLane.violations.some(
    (v) => v.rule === FINISHED_NOT_CLOSED_VACUOUS_RULE,
  )
  if (!criedVacuous || emptyLane.examined !== 0) {
    console.error(
      `bad-finished-not-closed: a lane that loaded nothing did not report ` +
        `${FINISHED_NOT_CLOSED_VACUOUS_RULE} (examined=${emptyLane.examined}) — the silent ` +
        `zero is unguarded`,
    )
    process.exit(0)
  }

  // The rule id is in the message on purpose: the harness's `gateNode` keys on
  // it, so a fixture that exits 1 for an unrelated reason cannot be read as proof
  // that THIS rule fired (bug 0110).
  console.error(
    `bad-finished-not-closed: OK — ${FINISHED_NOT_CLOSED_RULE} fired on the ` +
      `finished-but-open record, silent on work-in-progress and on a properly closed one`,
  )
  process.exit(1)
} catch (err) {
  console.error(`bad-finished-not-closed: unexpected error — ${String(err)}`)
  process.exit(2)
}
