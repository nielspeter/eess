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
import { collectResult, finishPreset, mergeCollectResults } from '@nielspeter/eess'
import { EMITTER_IDS } from '@nielspeter/eess/internal'

const NAME = 'bad-emitter-remedies'
const gate = (receipt) => [...finishPreset(receipt, { report: 'return' })]
const idsOf = (violations) => violations.map((v) => v.ruleId)

/**
 * Each case: the corrupt receipt that must produce `id`, and the remedies its
 * message names — every one of which must clear it.
 *
 * **Two kinds of remedy, kept apart deliberately.** A `corrective` remedy makes
 * the verdict real evidence: the loop now examines something. A `declaring`
 * remedy asserts the emptiness instead, and is legitimate precisely because it
 * EXPIRES — the day the subject appears it becomes a finding again. Counting the
 * two alike is how a check-deleting instruction gets recorded as a working
 * remedy, which is what `checkAll([])` shipped ("guard the array before calling"
 * — true, and it removes the check). So every declaring remedy is additionally
 * required to expire, and a cause whose ONLY remedy is declaring is reported: it
 * would be a finding an author can always talk their way out of.
 */
const CASES = [
  {
    id: 'emitter/no-receipt',
    corrupt: () => [],
    corrective: { 'return a receipt': () => collectResult([], { examined: 7 }) },
    declaring: {},
  },
  {
    id: 'emitter/pass-without-evidence',
    corrupt: () => collectResult([], { examined: 0 }),
    corrective: { 'widen the selection': () => collectResult([], { examined: 12 }) },
    declaring: {
      'declare it on the receipt': () => collectResult([], { examined: 0, declaredEmpty: true }),
    },
  },
  {
    id: 'emitter/source-empty',
    corrupt: () => collectResult([], { examined: 0, sourceEmpty: true }),
    // No declaring remedy exists, and that IS §4's point: an empty source
    // outranks any declaration, so there is nothing to talk your way out with.
    corrective: { 'fix the source': () => collectResult([], { examined: 4 }) },
    declaring: {},
  },
  {
    id: 'emitter/expired-declaration',
    corrupt: () => collectResult([], { examined: 3, declaredEmpty: true }),
    corrective: { 'remove the declaration': () => collectResult([], { examined: 3 }) },
    declaring: {},
  },
  {
    id: 'emitter/contradictory-evidence',
    corrupt: () => collectResult([], { examined: 5, notRun: true }),
    corrective: { 'drop the flag': () => collectResult([], { examined: 5 }) },
    // Dropping the evidence leaves the rule off, examining nothing. Legitimate —
    // `notRun` is for a rule turned off — but a declaration, not a repair.
    declaring: { 'drop the evidence': () => collectResult([], { examined: 0, notRun: true }) },
  },
]

// **The denominator is asserted, not printed.** An enforcement review emptied
// `CASES`, changed nothing else, and the harness still said OK — the summary
// read `0 causes, 0 remedies` and `mustSay` matched a banner printed
// unconditionally. That is this harness's own defect class, inside a fixture
// written to hold it. So the case list is checked against the kernel's own id
// set: a new emitter id with no case here reds, and an emptied `CASES` cannot
// print the ids the registration now keys on.
const covered = new Set(CASES.map((c) => c.id))
const uncovered = [...EMITTER_IDS].filter((id) => !covered.has(id))

const failures = []
if (uncovered.length > 0) {
  failures.push(`no case for emitter id(s): ${uncovered.join(', ')} — the case list is not the id set`)
}

try {
  for (const { id, corrupt, corrective, declaring } of CASES) {
    const fired = gate(corrupt())
    if (!idsOf(fired).includes(id)) {
      failures.push(
        `${id} did NOT fire on its own cause (got: ${idsOf(fired).join(',') || 'nothing'})`,
      )
      continue
    }
    for (const [label, remedy] of [...Object.entries(corrective), ...Object.entries(declaring)]) {
      const after = gate(remedy())
      if (after.length > 0) {
        failures.push(
          `${id}: applying "${label}" did NOT clear it (still: ${idsOf(after).join(',')})`,
        )
      }
    }
    // Every cause must offer at least one remedy that makes the verdict real
    // evidence. A cause offering only a declaration is one an author can always
    // talk their way out of.
    if (Object.keys(corrective).length === 0) {
      failures.push(`${id} offers no corrective remedy — only ways to declare the emptiness away`)
    }
  }

  // **A declaring remedy must expire.** That is what separates it from deleting
  // the check: the declaration is an assertion, and the day the subject appears
  // it becomes a finding again. Asserted, not assumed.
  if (!idsOf(gate(collectResult([], { examined: 4, declaredEmpty: true })))
      .includes('emitter/expired-declaration')) {
    failures.push('a declaredEmpty receipt that later examined units did NOT expire')
  }
  if (!idsOf(gate(collectResult([], { examined: 4, notRun: true })))
      .includes('emitter/contradictory-evidence')) {
    failures.push('a notRun receipt that later examined units was NOT contradicted')
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

  // **The MERGE holds the same precedence as the gate.** Fixing the gate alone
  // left the two doors disagreeing about one receipt, and nothing caught it:
  // `mergeCollectResults` exempts a `sourceEmpty` member from its dead filter,
  // so a healthy sibling's `examined` carried the merged receipt straight past
  // the gate's own check. Measured before the merge fix: green. Driven here
  // because a fixture that only exercises `finishPreset` cannot see it — which
  // is how the gap survived the first cut of this phase.
  const mergedWithHealthy = mergeCollectResults([
    collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }),
    collectResult([], { examined: 5 }),
  ])
  if (!idsOf(gate(mergedWithHealthy)).includes('emitter/source-empty')) {
    failures.push('an empty-source member merged with a healthy one did NOT red — the merge and the gate disagree')
  }
  // CONTROL for that: two healthy members must still merge green, or the check
  // above is satisfied by a merge that reds on everything.
  const mergedHealthy = mergeCollectResults([
    collectResult([], { examined: 5 }),
    collectResult([], { examined: 2 }),
  ])
  if (gate(mergedHealthy).length > 0) {
    failures.push(`CONTROL: two healthy members merged to ${idsOf(gate(mergedHealthy)).join(',')}`)
  }

  // **Every flag that can quiet a zero can be contradicted.** `sourceEmpty` was
  // the one that could not: `notRun` beside evidence reds, `declaredEmpty`
  // beside evidence reds, and `{ examined: 900, sourceEmpty: true }` was silent
  // until the change that gave `sourceEmpty` its own id put it in scope.
  if (!idsOf(gate(collectResult([], { examined: 900, sourceEmpty: true })))
      .includes('emitter/contradictory-evidence')) {
    failures.push('a sourceEmpty receipt claiming 900 examined units was NOT contradicted')
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
      // The ids themselves, so the registration can key on one and an emptied
      // case list cannot print it.
      `${[...covered].sort().join(' ')} — ` +
      `${CASES.length} causes, ` +
      `${CASES.reduce((n, c) => n + Object.keys(c.corrective).length, 0)} corrective and ` +
      `${CASES.reduce((n, c) => n + Object.keys(c.declaring).length, 0)} declaring remedies ` +
      `(each declaring one proven to expire), plus §4's source precedence and the ` +
      `no-preset-option rule`,
  )
  process.exit(1)
}

console.error(`${NAME}: ${failures.length} failure(s) — the gate or a remedy is vacuous`)
for (const f of failures) console.error(`  x ${f}`)
process.exit(0)
