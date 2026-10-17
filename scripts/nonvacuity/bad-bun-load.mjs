#!/usr/bin/env node
/**
 * Non-vacuity for `check:bun-load` (plan 0448): the breaks that need no Bun.
 *
 * The guard's Bun half runs only in CI (ADR-001 keeps Bun out of the toolchain)
 * and proves its own breaks there with `--self-test`. Everything here runs
 * without Bun, so it runs in `check:nonvacuity`, locally and in CI:
 *
 * - the input half (`inspectWorkspace`) over scratch workspaces: a stale
 *   exclusion, a stale run-on-import entry, a workspace whose only package is
 *   `private` (which also proves the `private` filter), and an `exports` shape
 *   the guard cannot enumerate;
 * - the CI job check (`checkBunLoadJob`) over the real `ci.yml` with one
 *   sabotage each: the job deleted, an `if:`, `continue-on-error`, `needs:`, the
 *   self-test step removed, Bun not installed from `.bun-version`.
 *
 * Run one scenario by name (`node bad-bun-load.mjs bun-load/ci-if`) or all.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every chosen scenario was red as expected — OK
 *   0 = a scenario stayed green — the check is vacuous
 *   2 = unexpected THROW only, never a behavioural result
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkBunLoadJob, inspectWorkspace, runGuard } from '../check-bun-load.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NAME = 'bad-bun-load'

function vacuous(msg) {
  console.error(`${NAME}: ${msg}`)
  process.exit(0)
}

function workspace(packages, workspaces = ['packages/*']) {
  const root = mkdtempSync(join(tmpdir(), 'eess-bad-bun-load-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true, workspaces }))
  mkdirSync(join(root, 'node_modules', '@scratch'), { recursive: true })
  for (const p of packages) {
    const dir = join(root, 'packages', p.dir)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: p.name, version: '0.0.0', exports: p.exports, ...(p.private ? { private: true } : {}) }))
    // npm's workspace list (the guard's cross-check) reads the installed links.
    symlinkSync(dir, join(root, 'node_modules', p.name), 'dir')
  }
  return root
}

function inputsMustSay(ruleId, packages, opts, { workspaces, guard = false, versionPin = '1.4.3' } = {}) {
  const root = workspace(packages, workspaces)
  if (versionPin !== null) writeFileSync(join(root, '.bun-version'), `${versionPin}\n`)
  try {
    // `guard` runs the whole guard with no Bun on PATH: only its own checks that
    // need no Bun can answer, which is what these rows are for.
    const { findings } = guard
      ? runGuard({ root, excluded: {}, onImport: {}, env: { ...process.env, PATH: join(root, 'no-bin-here') } })
      : inspectWorkspace({ root, ...opts })
    if (!findings.some((f) => f.ruleId === ruleId)) {
      vacuous(`inspectWorkspace stayed green for ${ruleId} (got: ${findings.map((f) => f.ruleId).join(', ') || 'nothing'})`)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  console.error(`${NAME}: inputs — ${ruleId} reported`)
}

const ok = { name: '@scratch/a', dir: 'a', exports: { '.': './index.js' } }
const ci = readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')

function ciMustSay(phrase, sabotage) {
  if (checkBunLoadJob(ci).length > 0) {
    vacuous(`the real ci.yml already fails the job check (${checkBunLoadJob(ci).join('; ')}), so no sabotage can be told apart`)
  }
  const broken = sabotage(ci)
  if (broken === ci) vacuous(`the sabotage for "${phrase}" changed nothing: its anchor in ci.yml has moved`)
  const problems = checkBunLoadJob(broken)
  if (!problems.some((p) => p.includes(phrase))) {
    vacuous(`checkBunLoadJob stayed green for "${phrase}" (got: ${problems.join('; ') || 'nothing'})`)
  }
  console.error(`${NAME}: bun-load CI job — ${phrase}`)
}

const JOB = '  bun-load:\n    runs-on: ubuntu-latest\n'

const SCENARIOS = {
  'bun-load/stale-exclusion': () =>
    inputsMustSay('bun-load/stale-exclusion', [ok], { excluded: { '@scratch/gone': 'x' }, onImport: {} }),
  'bun-load/stale-on-import': () =>
    inputsMustSay('bun-load/stale-on-import', [ok], { excluded: {}, onImport: { '@scratch/a/cli': { message: 'x' } } }),
  'bun-load/empty-or-private': () =>
    inputsMustSay('bun-load/empty', [{ ...ok, private: true }], { excluded: {}, onImport: {} }),
  'bun-load/missing-workspace': () =>
    inputsMustSay('bun-load/missing-workspace', [ok], { excluded: {}, onImport: {} }, { workspaces: ['packages/*', 'gone/*'] }),
  'bun-load/npm-cross-check': () =>
    inputsMustSay('bun-load/npm-cross-check', [ok, { ...ok, name: '@scratch/b', dir: 'b' }], { excluded: {}, onImport: {}, hidePackageForSelfTest: '@scratch/b' }),
  'bun-load/no-bun': () => inputsMustSay('bun-load/no-bun', [ok], {}, { guard: true }),
  'bun-load/no-version-pin': () => inputsMustSay('bun-load/no-version-pin', [ok], {}, { guard: true, versionPin: null }),
  'bun-load/unreadable-exports': () =>
    inputsMustSay('bun-load/unreadable-exports', [{ ...ok, exports: { '.': './index.js', './*': './*.js' } }], { excluded: {}, onImport: {} }),
  'bun-load/ci-job-missing': () => ciMustSay('has no `bun-load` job', (t) => t.replace(JOB, '  bun-load-renamed:\n    runs-on: ubuntu-latest\n')),
  'bun-load/ci-if': () => ciMustSay('the `bun-load` job has an `if:`', (t) => t.replace(JOB, `${JOB}    if: false\n`)),
  'bun-load/ci-continue-on-error': () =>
    ciMustSay('sets `continue-on-error`', (t) => t.replace(JOB, `${JOB}    continue-on-error: true\n`)),
  'bun-load/ci-needs': () => ciMustSay('has `needs:`', (t) => t.replace(JOB, `${JOB}    needs: test\n`)),
  'bun-load/ci-guard-missing': () =>
    ciMustSay('does not run `npm run check:bun-load`', (t) => t.replace('      - run: npm run check:bun-load\n', '')),
  'bun-load/ci-step-if': () =>
    ciMustSay('a step of the `bun-load` job has an `if:`', (t) => t.replace('      - run: npm run check:bun-load\n', '      - run: npm run check:bun-load\n        if: false\n')),
  'bun-load/ci-self-test-missing': () =>
    ciMustSay('does not run `npm run check:bun-load -- --self-test`', (t) => t.replace('      - run: npm run check:bun-load -- --self-test\n', '')),
  'bun-load/ci-version-file': () =>
    ciMustSay('does not install Bun from `.bun-version`', (t) => t.replace('bun-version-file: .bun-version', 'bun-version: latest')),
}

const only = process.argv[2]
if (only !== undefined && SCENARIOS[only] === undefined) {
  console.error(`${NAME}: unknown scenario ${only} — known: ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(2)
}
try {
  for (const row of only === undefined ? Object.keys(SCENARIOS) : [only]) SCENARIOS[row]()
} catch (e) {
  console.error(`${NAME}: unexpected error: ${e instanceof Error ? e.stack : String(e)}`)
  process.exit(2)
}
console.error(`${NAME}: OK — ${only ?? 'every scenario'} red on its own subject`)
process.exit(1)
