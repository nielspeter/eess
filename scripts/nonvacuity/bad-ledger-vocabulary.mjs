#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — bug 0284: a half-declared vocabulary must be refused, not
 * silently defaulted. Passing `states` without `terminalStates` left a closing token the
 * author declared outside the terminal set, so its record was never treated as done and
 * its open box passed — a green gate that produced no finding at all, which is why the
 * existing ledger fixture (it asserts that rule ids fire) could not see it.
 *
 * The corpus is the record's mixed one: the victim, closed by `Promoted` with an open box,
 * beside an ordinary `Done` record. The second record keeps a lane-wide "zero done-items"
 * guard silent, so this fixture cannot be satisfied by that guard.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the half-declared vocabulary was refused, and the full one reports the box — OK
 *   0 = it was accepted (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { corpus, isArchConfigError } from '@nielspeter/eess-md'
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'

const ROOT = 'scripts/nonvacuity/bad-ledger-vocabulary'
const STATES = ['Draft', 'Ready', 'Open', 'Done', "Won't-do", 'Promoted']

let c
try {
  c = corpus({ roots: [`${ROOT}/**/*.md`] })
} catch (err) {
  console.error(`bad-ledger-vocabulary: unexpected error loading corpus — ${String(err)}`)
  process.exit(2)
}
const docs = c.documents().length
if (docs !== 2) {
  console.error(
    `bad-ledger-vocabulary: the corpus loaded ${docs} document(s), expected 2 — this ` +
      `fixture proves nothing against the wrong root; check ${ROOT}`,
  )
  process.exit(2)
}

let refusal
try {
  const violations = honestyAtClose(c, { states: STATES, report: 'return' })
  console.error(
    `bad-ledger-vocabulary: states without terminalStates was accepted, with ` +
      `${violations.length} finding(s) — the half-declared vocabulary is not refused`,
  )
  process.exit(0)
} catch (err) {
  if (!(err instanceof Error) || !isArchConfigError(err)) {
    console.error(`bad-ledger-vocabulary: unexpected error running honestyAtClose — ${String(err)}`)
    process.exit(2)
  }
  refusal = err.message
}

// The mirror half: terminalStates alone must be refused too, or a sabotage that kept only
// the first branch would leave this row green.
try {
  honestyAtClose(c, { terminalStates: ['Done', 'Promoted'], report: 'return' })
  console.error('bad-ledger-vocabulary: terminalStates without states was accepted')
  process.exit(0)
} catch (err) {
  if (!(err instanceof Error) || !isArchConfigError(err)) {
    console.error(`bad-ledger-vocabulary: unexpected error on the mirror run — ${String(err)}`)
    process.exit(2)
  }
}

// The clean direction, so a gate that refused everything cannot pass for a working one:
// the remedy the refusal names — both options — must classify the victim done and report it.
let reconciled
try {
  reconciled = honestyAtClose(c, {
    states: STATES,
    terminalStates: ['Done', "Won't-do", 'Promoted'],
    report: 'return',
  })
} catch (err) {
  console.error(`bad-ledger-vocabulary: unexpected error on the remedy run — ${String(err)}`)
  process.exit(2)
}
const boxReported = reconciled.some(
  (v) => v.rule === 'ledger/silent-open-box' && v.file.endsWith('0001-p.md'),
)
if (!boxReported) {
  console.error(
    `bad-ledger-vocabulary: with both options passed the victim's open box is still not ` +
      `reported — the refusal's remedy is not corrective (fired: ` +
      `${reconciled.map((v) => v.rule).join(', ') || 'none'})`,
  )
  process.exit(2)
}

console.error(`bad-ledger-vocabulary: refused — ${refusal}`)
console.error('bad-ledger-vocabulary: the remedy reports the box — as expected')
process.exit(1)
