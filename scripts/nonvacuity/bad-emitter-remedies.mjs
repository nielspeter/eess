#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — every emitter finding fires on its own cause, AND the
 * remedy its message names clears it (plan 0263 Phase 3, ADR-014 §4, ADR-009
 * rule 2's behavioural corollary).
 *
 * Both halves, deliberately. Asserting only that a corrupt receipt reds proves
 * the gate fires; it says nothing about whether the sentence the reader is
 * handed actually works. Both failure modes are on record in this repo —
 * `checkAll([])` told the reader to guard the array (which deletes the check),
 * and this gate's own zero-examined message named a preset option at a seam
 * that is frequently not a preset. Neither was caught by a test.
 *
 * Asserted **by rule id**, not by "something was returned": each cause has its
 * own id, and a gate that collapsed them all onto one would satisfy a weaker
 * check while losing the thing that makes a finding actionable.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every cause fired by id and every remedy cleared it — OK
 *   0 = a cause did not fire, or a remedy did not clear it (vacuous)
 *   2 = unexpected error, or the fixture's own premise broke
 */
import { collectResult, finishPreset } from '@nielspeter/eess'

const NAME = 'bad-emitter-remedies'
const gate = (receipt) => [...finishPreset(receipt, { report: 'return' })]
const idsOf = (violations) => violations.map((v) => v.ruleId)

/**
 * Each case: the corrupt receipt that must produce `id`, and the remedies the
 * message names — every one of which must clear it. A message offering two
 * remedies is wrong if either fails, so both are applied.
 */
const CASES = [
  {
    id: 'emitter/no-receipt',
    corrupt: () => [],
    remedies: { 'return a receipt': () => collectResult([], { examined: 7 }) },
  },
  {
    id: 'emitter/pass-without-evidence',
    corrupt: () => collectResult([], { examined: 0 }),
    remedies: {
      'widen the selection': () => collectResult([], { examined: 12 }),
      'declare it on the receipt': () => collectResult([], { examined: 0, declaredEmpty: true }),
    },
  },
  {
    id: 'emitter/source-empty',
    corrupt: () => collectResult([], { examined: 0, sourceEmpty: true }),
    remedies: { 'fix the source': () => collectResult([], { examined: 4 }) },
  },
  {
    id: 'emitter/expired-declaration',
    corrupt: () => collectResult([], { examined: 3, declaredEmpty: true }),
    remedies: { 'remove the declaration': () => collectResult([], { examined: 3 }) },
  },
  {
    id: 'emitter/contradictory-evidence',
    corrupt: () => collectResult([], { examined: 5, notRun: true }),
    remedies: {
      'drop the flag': () => collectResult([], { examined: 5 }),
      'drop the evidence': () => collectResult([], { examined: 0, notRun: true }),
    },
  },
]

const failures = []
try {
  for (const { id, corrupt, remedies } of CASES) {
    const fired = gate(corrupt())
    if (!idsOf(fired).includes(id)) {
      failures.push(`${id} did NOT fire on its own cause (got: ${idsOf(fired).join(',') || 'nothing'})`)
      continue
    }
    for (const [label, remedy] of Object.entries(remedies)) {
      const after = gate(remedy())
      if (after.length > 0) {
        failures.push(`${id}: applying "${label}" did NOT clear it (still: ${idsOf(after).join(',')})`)
      }
    }
  }

  // **An empty source outranks any declaration** — ADR-014 §4. Before Phase 3
  // the gate honoured `declaredEmpty` first and this receipt returned green.
  for (const [label, receipt] of [
    ['declaredEmpty', collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true })],
    ['notRun', collectResult([], { examined: 0, sourceEmpty: true, notRun: true })],
  ]) {
    if (!idsOf(gate(receipt)).includes('emitter/source-empty')) {
      failures.push(`an empty source was declared away by ${label} — §4's precedence is not held`)
    }
  }

  // **The kernel names no preset's options** — ADR-014 §4, "at a seam that may
  // not be a preset".
  const zeroExamined = gate(collectResult([], { examined: 0 }))[0]
  if (/preset/i.test(zeroExamined?.message ?? '')) {
    failures.push('the zero-examined message names a preset option at a seam that may not be one')
  }

  // CONTROL: an honest receipt reaches none of it. Without this, "every remedy
  // clears its finding" is satisfied by a gate that never fires at all.
  const control = gate(collectResult([], { examined: 9 }))
  if (control.length > 0) {
    failures.push(`CONTROL: an honest receipt produced ${idsOf(control).join(',')}`)
  }
} catch (err) {
  console.error(`${NAME}: unexpected error — ${String(err)}`)
  process.exit(2)
}

if (failures.length === 0) {
  console.error(
    `${NAME}: every emitter cause fired by id and every stated remedy cleared it — ` +
      `${CASES.length} causes, ${CASES.reduce((n, c) => n + Object.keys(c.remedies).length, 0)} remedies, ` +
      `plus §4's source precedence and the no-preset-option rule`,
  )
  process.exit(1)
}

console.error(`${NAME}: ${failures.length} failure(s) — the gate or a remedy is vacuous`)
for (const f of failures) console.error(`  x ${f}`)
process.exit(0)
