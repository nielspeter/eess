#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the work-item number check must reject a number claimed
 * by two lanes. `kit/scripts/next-number.mjs --check` is run against
 * scripts/nonvacuity/bad-numbers/, whose corpus has both
 * `work/plans/0100-a-plan.md` and `work/bugs/0100-a-bug.md`. Expected: at least
 * one duplicate reported, exit 1.
 *
 * This is bug 0107's red test: eess runs one number sequence across lanes, and
 * before the fix nothing detected two items claiming the same number.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = duplicate found (gate correctly failed on violating input) — OK
 *   0 = no duplicate (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, missing checker, …) — treated as fail
 */
import { spawnSync } from 'node:child_process'

const r = spawnSync(
  process.execPath,
  ['kit/scripts/next-number.mjs', '--check', '--root', 'scripts/nonvacuity/bad-numbers'],
  { encoding: 'utf8' },
)

const out = `${r.stderr ?? ''}${r.stdout ?? ''}`

// Exit 1 alone is NOT proof the check ran: node also exits 1 on
// MODULE_NOT_FOUND, a syntax error, or an unhandled throw. Require the
// checker's own sentinel, so a crash can never read as a detected violation.
const SENTINEL = 'next-number:'

if (r.error !== undefined) {
  console.error(`bad-numbers: unexpected error — ${r.error.message}`)
  process.exit(2)
}
if (r.status === null || !out.includes(SENTINEL)) {
  console.error(`bad-numbers: checker did not run (exit ${String(r.status)}, no "${SENTINEL}" output)`)
  console.error(out.trim().split('\n').slice(0, 5).join('\n'))
  process.exit(2)
}

if (r.status === 1) {
  console.error('bad-numbers: detected as expected — duplicate number across lanes')
  for (const line of out.trim().split('\n')) console.error(`  x ${line}`)
  process.exit(1)
}

console.error('bad-numbers: NO duplicate detected — gate is vacuous')
process.exit(0)
