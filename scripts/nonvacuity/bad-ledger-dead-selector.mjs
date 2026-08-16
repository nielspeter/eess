#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0131's own headline claim: `honestyAtClose` must
 * reject a dead `headerViolations` selector (a corpus whose only document is
 * a board file) rather than silently reading as "nothing to report," the way
 * the pre-fold hand-rolled implementation did forever. Run over
 * scripts/nonvacuity/bad-ledger-dead-selector/**, whose only document is
 * `ROADMAP.md` — a board file, so `notBoardFile` correctly excludes it and
 * the real, non-board selection is empty.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the dead selector was reported (gate correctly failed) — OK
 *   0 = no finding (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const ROOT = 'scripts/nonvacuity/bad-ledger-dead-selector'

let c
try {
  c = corpus({ roots: [`${ROOT}/**`] })
} catch (err) {
  console.error(`bad-ledger-dead-selector: unexpected error loading corpus — ${String(err)}`)
  process.exit(2)
}

// The fixture's own denominator: exactly one document (the board file), or
// this fixture proves nothing against a drifted root.
const docs = c.documents().length
if (docs !== 1) {
  console.error(
    `bad-ledger-dead-selector: the corpus loaded ${docs} document(s), expected 1 — this ` +
      `fixture proves nothing against the wrong root; check ${ROOT}`,
  )
  process.exit(2)
}

let violations
try {
  violations = honestyAtClose(c, { boardFiles: ['ROADMAP.md'], report: 'return' })
} catch (err) {
  console.error(`bad-ledger-dead-selector: unexpected error running honestyAtClose — ${String(err)}`)
  process.exit(2)
}

const found = violations.some((v) => v.message.includes('examined zero units'))
if (!found) {
  console.error(
    `bad-ledger-dead-selector: no "examined zero units" finding — the dead-selector guard is ` +
      `vacuous (fired: ${violations.map((v) => v.rule).join(', ') || 'none'})`,
  )
  process.exit(0)
}

// The clean direction, so a permanently-red gate cannot pass for a working
// one: declaring `expectEmptyHeaders` on the identical corpus must clear it.
let reconciled
try {
  reconciled = honestyAtClose(c, {
    boardFiles: ['ROADMAP.md'],
    expectEmptyHeaders: true,
    report: 'return',
  })
} catch (err) {
  console.error(`bad-ledger-dead-selector: unexpected error on the escape-hatch run — ${String(err)}`)
  process.exit(2)
}
if (reconciled.length > 0) {
  console.error(
    `bad-ledger-dead-selector: expectEmptyHeaders:true still produced ` +
      `${reconciled.length} finding(s) — the escape hatch's own premise is broken, not the ` +
      `gate proven: ${reconciled.map((v) => v.rule).join(', ')}`,
  )
  process.exit(2)
}

console.error(
  `bad-ledger-dead-selector: "examined zero units" reported by default, cleared by ` +
    `expectEmptyHeaders — as expected`,
)
process.exit(1)
