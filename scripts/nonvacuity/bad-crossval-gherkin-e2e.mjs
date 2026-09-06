#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the gherkin-ts trio in `scripts/check-crossval.mjs`,
 * end to end (plan 0145 / proposal 005), in the strong tier this repo's own
 * `bad-release-e2e.mjs` established: the REAL production script, run against
 * a throwaway corpus via `EESS_CROSSVAL_GHERKIN_ROOT` (the same "input
 * override on the real script" shape as `EESS_RELEASE_BASE`), not a rebuilt
 * copy of the rule (bug 0127's lesson, applied from day one this time).
 *
 * Second-round branch review on this proposal found the design that would
 * have been built here could not work, four separate ways — cited as
 * precedent the tier `bad-gherkin-ts.mjs`/`bad-crossval.mjs` already use
 * (this repo's own harness docstring names them "one tier weaker," the exact
 * class bug 0127 fixed away from), and found `packages/crossvalidate/specs/
 * gate.tsconfig.json` scopes the citing side to one file by exact path, not
 * a glob, so an ephemeral probe file would have been invisible to it. Both
 * closed by NOT mutating the real corpus at all: this fixture builds its own
 * throwaway `specs/` directory per scenario, with its own `gate.tsconfig.json`
 * globbing everything in it (safe because nothing else is ever there).
 *
 * Three scenarios prove all three directions in one file (one shared
 * throwaway-directory builder, matching `bad-release-e2e.mjs`'s own
 * `scenario()`/`E2E` shape):
 *   1. a scenario tagged `@wip` with a real citing test — must fire
 *      `crossval/scenario-exemption-stale`.
 *   2. the same tag, no citing test — must stay silent (the negative
 *      control: proves direction 1 isn't a fixture that always fires).
 *   3. an untagged scenario with no citing test — must fire
 *      `crossval/scenarios-covered`, closing one of bug 0112's three named
 *      rows (the `include` change this plan makes is what puts that gate's
 *      own coverage on the line — see plan 0145, Non-vacuity).
 *
 * Two runs per scenario, per bug 0127's own two-run discipline: `--format
 * json` for `firedOn`-style rule+file identity, and a bare-terminal
 * invocation for the exit code CI actually depends on
 * (`"check:crossval": "node scripts/check-crossval.mjs"`, no flags).
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = all three scenarios behaved as expected — OK
 *   0 = at least one did not — the gate is vacuous somewhere
 *   2 = unexpected error, or the fixture's own premise broke
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-crossval.mjs')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function vacuous(msg) {
  console.error(`bad-crossval-gherkin-e2e: ${msg}`)
  process.exit(0)
}
function threw(where, err) {
  console.error(`bad-crossval-gherkin-e2e: unexpected error ${where} — ${String(err)}`)
  process.exit(2)
}

const GATE_TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2022', module: 'ES2022', strict: true },
  include: ['*.spec.ts'],
})

const tmpDirs = []
/** Build a throwaway `specs/` directory, run the real script twice
 * (--format json, then bare terminal) with the corpus pointed at it. */
function scenario({ feature, spec }) {
  const dir = mkdtempSync(join(tmpdir(), 'bad-crossval-gherkin-'))
  tmpDirs.push(dir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'probe.feature'), feature)
  writeFileSync(join(dir, 'probe.spec.ts'), spec)
  writeFileSync(join(dir, 'gate.tsconfig.json'), GATE_TSCONFIG)
  const env = { ...process.env, EESS_CROSSVAL_GHERKIN_ROOT: dir }
  const json = spawnSync('node', [SCRIPT, '--format', 'json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
  })
  const terminal = spawnSync('node', [SCRIPT], { cwd: repoRoot, encoding: 'utf8', env })
  return {
    jsonCode: json.status,
    jsonOut: `${json.stdout ?? ''}${json.stderr ?? ''}`,
    terminalCode: terminal.status,
  }
}

const FEATURE_WIP = 'Feature: Probe\n\n  @wip\n  Scenario: A stale exemption\n    Given something\n'
// The @wip scenario is the SUBJECT (exempt, uncited). The second, untagged and
// cited, exists so the corpus is not vacuous on the other two axes: with an
// empty spec this control had zero `it()` titles, so `scenarioTestsResolve`
// examined nothing and — correctly, under ADR-014 — reported a pass built from
// no evidence. A negative control whose corpus certifies nothing cannot show
// that a rule "stayed silent"; it shows that nothing ran.
const FEATURE_WIP_UNCITED =
  'Feature: Probe\n\n  @wip\n  Scenario: Not yet done\n    Given something\n\n' +
  '  Scenario: Proven by a test\n    Given something\n'
const FEATURE_UNTAGGED_UNCITED =
  'Feature: Probe\n\n  Scenario: Nobody proves this\n    Given something\n'
const SPEC_CITES = [
  'declare function it(name: string, fn?: () => void): void',
  "it('probe.feature › A stale exemption', () => {})",
  'export {}',
  '',
].join('\n')
// Cites the untagged sibling, so every rule in the chain examines a real unit.
const SPEC_COVERS_SIBLING = [
  'declare function it(name: string, fn?: () => void): void',
  "it('probe.feature › Proven by a test', () => {})",
  'export {}',
  '',
].join('\n')

const SCENARIOS = [
  [
    'exempt scenario, cited by a real test — must fire scenario-exemption-stale',
    { feature: FEATURE_WIP, spec: SPEC_CITES },
    'crossval/scenario-exemption-stale',
    true,
  ],
  [
    'exempt scenario, no citing test — must stay silent (negative control)',
    { feature: FEATURE_WIP_UNCITED, spec: SPEC_COVERS_SIBLING },
    'crossval/scenario-exemption-stale',
    false,
  ],
  [
    'untagged scenario, no citing test — must fire scenarios-covered (folds in bug 0112)',
    { feature: FEATURE_UNTAGGED_UNCITED, spec: SPEC_COVERS_SIBLING },
    'crossval/scenarios-covered',
    true,
  ],
]

try {
  for (const [name, files, ruleId, mustFire] of SCENARIOS) {
    const r = scenario(files)
    const fired = r.jsonOut.includes(`"ruleId": "${ruleId}"`)
    if (mustFire) {
      if (!fired) vacuous(`"${name}": expected "${ruleId}" in --format json output, not found`)
      if (r.jsonCode !== 1) vacuous(`"${name}": --format json exited ${r.jsonCode}, want 1`)
      if (r.terminalCode !== 1) vacuous(`"${name}": terminal run exited ${r.terminalCode}, want 1`)
    } else {
      if (fired) vacuous(`"${name}": "${ruleId}" fired when it should have stayed silent`)
      if (r.jsonCode !== 0) vacuous(`"${name}": --format json exited ${r.jsonCode}, want 0`)
      if (r.terminalCode !== 0) vacuous(`"${name}": terminal run exited ${r.terminalCode}, want 0`)
    }
  }
} catch (err) {
  threw('running a scenario', err)
} finally {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
}

console.error(
  `bad-crossval-gherkin-e2e: ${SCENARIOS.length} end-to-end runs of the real check-crossval.mjs ` +
    `exited as expected, json and terminal both — an exempt+cited scenario fires ` +
    `crossval/scenario-exemption-stale, an exempt+uncited one stays silent, and an untagged+uncited ` +
    `one fires crossval/scenarios-covered`,
)
process.exit(1)
