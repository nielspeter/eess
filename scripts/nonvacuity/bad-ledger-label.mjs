#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0444: `honestyAtClose` must not skip a record whose
 * state is written under a label it does not read, nor a call that reads no state.
 *
 *   under-another-label  records/: 0001 writes `**Status:** Done` beside a `State:`
 *                        record → `ledger/state-under-another-label` on 0001 only.
 *   no-readable-state    stateless/: no document carries a state line →
 *                        `ledger/no-readable-state`, once.
 *
 * Exit codes: 1 = the finding fired as expected; 0 = it did not (the gate is
 * vacuous); 2 = an unexpected error or the fixture's premise broke.
 */
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const ROOT = 'scripts/nonvacuity/bad-ledger-label'
const SCENARIOS = {
  'under-another-label': { dir: 'records', rule: 'ledger/state-under-another-label', on: '0001-status-done-live.md' },
  'no-readable-state': { dir: 'stateless', rule: 'ledger/no-readable-state', on: 'm1.md' },
}
const scenario = SCENARIOS[process.argv[2] ?? '']
if (scenario === undefined) {
  console.error(`bad-ledger-label: unknown scenario ${String(process.argv[2])}`)
  process.exit(2)
}
let found
try {
  found = honestyAtClose(corpus({ roots: [`${ROOT}/${scenario.dir}/**`] }), { report: 'return' })
} catch (err) {
  console.error(`bad-ledger-label: unexpected error — ${String(err)}`)
  process.exit(2)
}
const hits = found.filter((v) => v.rule === scenario.rule)
if (hits.length === 0) {
  console.error(`bad-ledger-label: ${scenario.rule} did not fire — the gate is vacuous`)
  process.exit(0)
}
if (hits.length !== 1 || !hits[0].element.endsWith(scenario.on)) {
  console.error(`bad-ledger-label: ${scenario.rule} fired on the wrong records: ${hits.map((v) => v.element).join(', ')}`)
  process.exit(2)
}
console.error(`bad-ledger-label: ${scenario.rule} fired on ${scenario.on}`)
process.exit(1)
