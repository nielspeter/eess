#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the vacuity matrix's sibling-dialect half (bug 0403) must fail the build.
 *
 * Runs a mutated COPY of the real scripts/vacuity-matrix.mjs, as bad-vacuity-matrix.mjs does:
 *
 *   sibling-fail-open  eess-md's `docs` probe is replaced by one that passes silently → the matrix
 *                      names `@nielspeter/eess-md::docs (sibling) is fail-open`.
 *   unaccounted        eess-md's `vocabulary` is removed from SIBLING_NOT_CONSTRUCTORS → the matrix
 *                      names it as exported and neither probed nor listed.
 *   stale-entry        a listed name that is not exported → the matrix names it as stale.
 *   probe-crash        eess-md's `docs` probe throws an unrelated TypeError → the matrix names it as a
 *                      probe that no longer reaches its check.
 *
 * Exit codes: 1 = the mutated matrix failed, naming the export; 0 = it did not (the sibling half is
 * vacuous); 2 = the mutation did not apply, or an unexpected error.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const realScript = join(repoRoot, 'scripts', 'vacuity-matrix.mjs')
const mutatedScript = join(__dirname, '.bad-vacuity-matrix-sibling-mutated.mjs')

const SCENARIOS = {
  'sibling-fail-open': {
    from: "'@nielspeter/eess-md::docs': () => md.docs(emptyCorpus).check(),",
    to: "'@nielspeter/eess-md::docs': () => {},",
    mustSay: '@nielspeter/eess-md::docs (sibling) is fail-open with no KNOWN_FAIL_OPEN entry',
  },
  'stale-entry': {
    from: "  '@nielspeter/eess-md::vocabulary': 'data builder, returns a term set',\n",
    to: "  '@nielspeter/eess-md::vocabulary': 'data builder, returns a term set',\n  '@nielspeter/eess-md::noSuchExport': 'a stale entry',\n",
    mustSay: '@nielspeter/eess-md::noSuchExport is listed but not exported',
  },
  'probe-crash': {
    from: "'@nielspeter/eess-md::docs': () => md.docs(emptyCorpus).check(),",
    to: "'@nielspeter/eess-md::docs': () => { throw new TypeError('a renamed option') },",
    mustSay: '@nielspeter/eess-md::docs (sibling) threw for a reason other than a configuration finding',
  },
  unaccounted: {
    from: "  '@nielspeter/eess-md::vocabulary': 'data builder, returns a term set',\n",
    to: '',
    mustSay: '@nielspeter/eess-md::vocabulary is exported and neither probed nor listed',
  },
}
const scenario = SCENARIOS[process.argv[2] ?? '']
if (scenario === undefined) {
  console.error(`bad-vacuity-matrix-sibling: unknown scenario ${String(process.argv[2])}`)
  process.exit(2)
}
const source = readFileSync(realScript, 'utf8')
if (!source.includes(scenario.from)) {
  console.error('bad-vacuity-matrix-sibling: the mutation did not apply — refusing to report a verdict')
  process.exit(2)
}

let exitCode
try {
  writeFileSync(mutatedScript, source.replace(scenario.from, scenario.to))
  const r = spawnSync(process.execPath, [mutatedScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      VACUITY_TSCONFIG_OVERRIDE: join(repoRoot, 'packages/ts/tests/fixtures/vacuity/tsconfig.json'),
      VACUITY_NONEMPTY_TSCONFIG_OVERRIDE: join(
        repoRoot,
        'packages/ts/tests/fixtures/vacuity-nonempty/tsconfig.json',
      ),
    },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.error !== undefined || !out.includes('vacuity-matrix:')) {
    console.error(`bad-vacuity-matrix-sibling: unexpected error — ${r.error?.message ?? out.slice(0, 300)}`)
    exitCode = 2
  } else if (r.status !== 1 || !out.includes(scenario.mustSay)) {
    console.error(`bad-vacuity-matrix-sibling: the matrix did not name it (exit ${String(r.status)})`)
    exitCode = 0
  } else {
    console.error(`bad-vacuity-matrix-sibling: OK — ${scenario.mustSay}`)
    exitCode = 1
  }
} finally {
  if (existsSync(mutatedScript)) rmSync(mutatedScript)
}
process.exit(exitCode)
