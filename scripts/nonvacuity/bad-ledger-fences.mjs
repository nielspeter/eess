#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0286. The honesty-at-close gate must read a record's own State line the way
 * CommonMark does, from both directions of the fence misreading:
 *
 * - route A: `0007-fenced-example.md` is closed in place, shows the house template's non-terminal State
 *   line inside a four-backtick example, and carries a silent box. It must report that box — before the
 *   fix the example was read as the record's own state and the box was never checked.
 * - route B: `0008-unclosed-fence.md` opens a fence that never closes, so by CommonMark its State line
 *   and box are code. It must report `ledger/unterminated-fence` — before the fix it reported nothing.
 *
 * - `0010-state-in-code.md` has its only State line indented four spaces, a code block by CommonMark. It
 *   must report `ledger/state-in-code` — before, the regex read it; after the fix, nothing would.
 *
 * `0009-plain-fence.md` is the clean direction: a plain fenced example and every box done.
 *
 * One route per run: the first argument, `fenced-example`, `unterminated-fence` or `state-in-code`, names it, so each
 * registry row goes red for its own route alone.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the named route reported (gate correctly failed) — OK
 *   0 = the named route reported nothing (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const ROOT = 'scripts/nonvacuity/bad-ledger-fences'
const ROUTE = process.argv[2]
const ROUTES = {
  'fenced-example': ['0007-fenced-example', 'ledger/silent-open-box'],
  'unterminated-fence': ['0008-unclosed-fence', 'ledger/unterminated-fence'],
  'state-in-code': ['0010-state-in-code', 'ledger/state-in-code'],
}
if (!(ROUTE in ROUTES)) {
  console.error(`bad-ledger-fences: name a route — ${Object.keys(ROUTES).join(', ')}, not ${String(ROUTE)}`)
  process.exit(2)
}

let c
try {
  c = corpus({ roots: [`${ROOT}/**`] })
} catch (err) {
  console.error(`bad-ledger-fences: unexpected error loading corpus — ${String(err)}`)
  process.exit(2)
}

const docs = c.documents().length
if (docs !== 4) {
  console.error(`bad-ledger-fences: the corpus loaded ${docs} document(s), expected 4 — check ${ROOT}`)
  process.exit(2)
}

let violations
try {
  violations = honestyAtClose(c, {
    closeInPlace: true,
    states: ['Draft', 'Done'],
    terminalStates: ['Done'],
    report: 'return',
  })
} catch (err) {
  console.error(`bad-ledger-fences: unexpected error running honestyAtClose — ${String(err)}`)
  process.exit(2)
}

const from = (name) => violations.filter((v) => v.file.includes(name))
if (from('0009-plain-fence').length > 0) {
  console.error(
    `bad-ledger-fences: the clean fixture produced ${from('0009-plain-fence').length} violation(s) — ` +
      `the fixture's premise is broken, not the gate proven`,
  )
  process.exit(2)
}

const [document, rule] = ROUTES[ROUTE]
const reported = from(document).some((v) => v.rule === rule)
if (!reported) {
  console.error(`bad-ledger-fences: route ${ROUTE} SILENT — the gate is vacuous for it`)
  process.exit(0)
}

console.error(`bad-ledger-fences: route ${ROUTE} reported across 4 documents`)
console.error(
  ROUTE === 'fenced-example'
    ? '  x fenced-example: silent box reported under an example of a State line'
    : `  x ${rule}: reported`,
)
process.exit(1)
