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
const expectedViolation = status === 1 && /foreign-project token/.test((r.stdout ?? '') + (r.stderr ?? ''))
process.exit(expectedViolation ? 1 : 0)