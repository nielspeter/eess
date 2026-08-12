#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the honesty-at-close gate must reject a closed item that
 * still carries an undisposed `- [ ]`. `honestyAtClose` is run over
 * scripts/nonvacuity/bad-ledger/**, whose `completed/0001-silent-open-box.md` is
 * `State: Done` with one silent open box. Expected: `ledger/silent-open-box`.
 *
 * This gate existed as a `no-gate-yet` waiver until bug 0119, which is precisely
 * what the waiver let through: the placement half of this preset had never
 * examined a real document — it looked for `State:` above the first heading and
 * every record in this corpus writes it under `## Status`. The fixtures below
 * deliberately use the corpus's shape, not the preamble shape the old unit
 * fixtures used, because agreeing with the code instead of the corpus is how
 * that stayed invisible.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the silent box was detected (gate correctly failed) — OK
 *   0 = no violation (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const ROOT = 'scripts/nonvacuity/bad-ledger'
// All THREE rules, not one. The first version of this fixture asserted only
// `silent-open-box`, and both its documents sat in `/completed/` — so they were
// classified done by FOLDER and `findState` was never called. Review measured the
// consequence: reverting bug 0119 exactly, or bug 0118 exactly, or making
// `findState` return null outright, all left this fixture exiting 1 and the
// harness reporting the gate proven. A gate that cannot see the code path it
// guards is the defect it exists to catch, one level up.
const RULES = ['ledger/silent-open-box', 'ledger/state-folder-mismatch', 'ledger/unknown-state']

let c
try {
  c = corpus({ roots: [`${ROOT}/**`] })
} catch (err) {
  console.error(`bad-ledger: unexpected error loading corpus — ${String(err)}`)
  process.exit(2)
}

// The fixture's own denominator. An empty corpus has no undisposed boxes, so
// "no violation" would be trivially true and this gate would sit green forever
// on a drifted root (bug 0110's class).
const docs = c.documents().length
if (docs !== 4) {
  console.error(
    `bad-ledger: the corpus loaded ${docs} document(s), expected 4 — this fixture proves ` +
      `nothing against an empty corpus; check ${ROOT}`,
  )
  process.exit(2)
}

let violations
try {
  violations = honestyAtClose(c, { doneFolders: ['/completed/'], report: 'return' })
} catch (err) {
  console.error(`bad-ledger: unexpected error running honestyAtClose — ${String(err)}`)
  process.exit(2)
}

// The clean direction, so a permanently-red gate cannot pass for a working one:
// 0002 is closed and reconciled, and must contribute nothing.
const fromReconciled = violations.filter((v) => v.file.includes('0002-reconciled'))
if (fromReconciled.length > 0) {
  console.error(
    `bad-ledger: the reconciled fixture produced ${fromReconciled.length} violation(s) — the ` +
      `fixture's premise is broken, not the gate proven: ${fromReconciled.map((v) => v.rule).join(', ')}`,
  )
  process.exit(2)
}

const fired = new Set(violations.map((v) => v.rule))
const missing = RULES.filter((r) => !fired.has(r))
if (missing.length > 0) {
  console.error(
    `bad-ledger: ${missing.length} of ${RULES.length} rules did not fire — gate is vacuous for ` +
      `${missing.join(', ')} (fired: ${[...fired].join(', ') || 'none'})`,
  )
  process.exit(0)
}

console.error(
  `bad-ledger: all ${RULES.length} rules fired as expected across ${docs} documents — ` +
    RULES.join(', '),
)
for (const v of violations) console.error(`  x ${v.rule} · ${v.message.split('\n')[0]}`)
process.exit(1)
