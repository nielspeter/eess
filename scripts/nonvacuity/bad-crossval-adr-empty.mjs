#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `check-crossval.mjs`'s ADR↔test gate over ADRs that cite no test must go
 * red (bug 0400). The REAL production script, run with `EESS_CROSSVAL_ADR_ROOT` pointing at a
 * throwaway `adr/` whose one ADR has an Enforcement table and no `it('…')` citation: the shape a
 * broken citation extractor or a drifted `dir` leaves behind.
 *
 * Before bug 0400 the gate passed here: a one-way correspondence counted the project's tests as
 * evidence, so the zero citations it checked were never seen. It now counts the side it checks,
 * and `check-crossval.mjs` declares `expectNonEmpty`, so zero citations is a finding. Deleting
 * either half (the count, or the declaration) turns this fixture vacuous.
 *
 * One bare terminal run, the invocation CI makes. Not `--format json`: `adrCitationsResolve` takes no
 * `format` option (bug 0097), so this gate prints its finding in the terminal format whatever is passed.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the empty citation side was reported — OK
 *   0 = it was not — the gate is vacuous
 *   2 = unexpected error
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-crossval.mjs')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RULE = 'crossval/adr-citations-resolve'

const ADR = [
  '# ADR-001: A decision',
  '',
  '## Enforcement',
  '',
  '| Clause | Tier | Mechanism | Status |',
  '| ------ | ---- | --------- | ------ |',
  '| It holds | 5 | a reviewer reads it | manual |',
  '',
].join('\n')

const dir = mkdtempSync(join(tmpdir(), 'bad-crossval-adr-empty-'))
let terminal
try {
  mkdirSync(join(dir, 'adr'), { recursive: true })
  writeFileSync(join(dir, 'adr', '001-a-decision.md'), ADR)
  const env = { ...process.env, EESS_CROSSVAL_ADR_ROOT: dir }
  terminal = spawnSync('node', [SCRIPT], { cwd: repoRoot, encoding: 'utf8', env })
} catch (err) {
  console.error(`bad-crossval-adr-empty: unexpected error — ${String(err)}`)
  process.exit(2)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

const out = `${terminal.stdout ?? ''}${terminal.stderr ?? ''}`
// The finding must be the declaration's, on this rule: a red for any other reason proves nothing.
const fired = new RegExp(`Rule: ${RULE}\\s+this rule declared \\.expectNonEmpty\\(\\)`).test(out)
if (!fired) {
  console.error(
    `bad-crossval-adr-empty: no ${RULE} .expectNonEmpty() finding over ADRs citing no test — ` +
      `the gate is vacuous`,
  )
  process.exit(0)
}
if (terminal.status !== 1) {
  console.error(
    `bad-crossval-adr-empty: the finding printed but the run exited ${terminal.status}, want 1 — ` +
      `the gate does not fail the build`,
  )
  process.exit(0)
}
console.error(
  `bad-crossval-adr-empty: ${RULE} reported zero citations against its .expectNonEmpty() ` +
    `declaration, and the run exited 1`,
)
process.exit(1)
