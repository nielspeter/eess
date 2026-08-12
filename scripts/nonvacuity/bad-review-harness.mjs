#!/usr/bin/env node
/**
 * Non-vacuity fixture for check:review-harness.
 *
 * Points the review-harness gate at scripts/nonvacuity/bad-review-harness/ — a
 * distilled copy of the UNadapted harness (foreign CMS vocabulary, no enforcement
 * persona, wrong plan path) — and exits 1 only if the gate fires. Proves the gate
 * FAILS on a drifting state (ADR-009: a green that cannot fail is a lie).
 */
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const r = spawnSync('node', ['scripts/check-review-harness.mjs', '--root', 'scripts/nonvacuity/bad-review-harness'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
const status = r.status ?? 2
const out = (r.stdout ?? '') + (r.stderr ?? '')
const expectedViolation = status === 1 && /foreign-project token/.test(out)

// Say so out loud. A fixture that reports only through its exit code cannot be
// distinguished from one that crashed (bug 0109), and the harness now requires
// this `bad-review-harness:` sentinel as proof the check actually ran.
if (expectedViolation) {
  console.error('bad-review-harness: foreign-project drift detected as expected')
  process.exit(1)
}
console.error(
  `bad-review-harness: NO foreign-project drift detected (child exit ${String(status)}) — gate is vacuous`,
)
process.exit(0)