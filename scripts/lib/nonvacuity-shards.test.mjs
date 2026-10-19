import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkNonvacuityJobs, duplicateNames } from './nonvacuity-shards.mjs'

// Plan 0509. These drive the harness itself — its shard, merge and plan modes —
// not the helpers, so a harness that stops calling the helpers goes red here.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HARNESS = join(repoRoot, 'scripts', 'check-nonvacuity.mjs')
const CI = readFileSync(join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8')

function harness(env = {}, args = []) {
  // CI runs this file from inside a shard, so the shard variables are inherited
  // unless they are scrubbed.
  const base = { ...process.env }
  for (const k of Object.keys(base))
    if (k.startsWith('EESS_NONVACUITY_') || k === 'QA_ONLY') delete base[k]
  const r = spawnSync(process.execPath, [HARNESS, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...base, ...env },
  })
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

function plan(n) {
  const r = harness({}, ['--plan', String(n)])
  assert.equal(r.code, 0, r.out)
  return JSON.parse(r.out)
}

// The ids `check-corpus.mjs` can emit, read the way the harness's audit reads them,
// so a complete set of fake reports can claim every one.
const CORPUS_IDS = [
  ...new Set(
    [
      ...readFileSync(join(repoRoot, 'scripts', 'check-corpus.mjs'), 'utf8').matchAll(
        /'(corpus\/[a-z0-9-]+)'/g,
      ),
    ].map((m) => m[1]),
  ),
]

/** Reports as four honest shards would write them; `edit` breaks them per test. */
function merge(edit = (reports) => reports) {
  const p = plan(4)
  const reports = p.shards.map((s) => ({
    shard: s.shard,
    of: 4,
    digest: p.digest,
    selected: [...s.selected],
    ran: [...s.selected],
    failed: [],
    // Spread across the shards, so only their union covers every id.
    assertedRuleIds: CORPUS_IDS.filter((_, k) => k % 4 === s.shard - 1),
  }))
  const dir = mkdtempSync(join(tmpdir(), 'nonvacuity-merge-'))
  try {
    for (const r of edit(reports)) {
      writeFileSync(join(dir, `shard-${r.shard}-${Math.random()}.json`), JSON.stringify(r))
    }
    return harness({ EESS_NONVACUITY_MERGE: dir })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a shard that selects no fixture fails', () => {
  const r = harness({ EESS_NONVACUITY_SHARD: '9999/9999' })
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /shard 9999\/9999 — FAILED · selected 0 of \d+ fixtures/)
})

test('a malformed shard spec fails rather than running everything', () => {
  for (const spec of ['0/4', '5/4', '4', 'all']) {
    const r = harness({ EESS_NONVACUITY_SHARD: spec })
    assert.equal(r.code, 1, `${spec}: ${r.out}`)
    assert.match(r.out, /shard — FAILED/)
  }
})

test('a shard refuses to run beside QA_ONLY', () => {
  const r = harness({ EESS_NONVACUITY_SHARD: '1/4', QA_ONLY: 'arch (root rules)' })
  assert.equal(r.code, 2, r.out)
})

test('the plan puts every fixture in exactly one shard', () => {
  for (const n of [1, 4, 7]) {
    const p = plan(n)
    const all = p.shards.flatMap((s) => s.selected)
    assert.equal(p.shards.length, n)
    assert.equal(all.length, p.fixtures)
    assert.equal(new Set(all).size, p.fixtures)
    for (const s of p.shards) assert.ok(s.selected.length > 0, `shard ${s.shard} of ${n} is empty`)
  }
})

test('a complete set of shard reports merges green', () => {
  const r = merge()
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /harness self-check — OK/)
  assert.match(r.out, /gate coverage — OK/)
  const fixtures = plan(4).fixtures
  assert.ok(
    r.out.includes(`shard partition — OK · ${fixtures} fixtures ran across 4 shards`),
    r.out,
  )
  assert.ok(r.out.includes(`${fixtures} fixtures each fired`), r.out)
  assert.match(r.out, /rule-id coverage — OK/)
})

test('a fixture that ran in no shard fails the merge', () => {
  let dropped
  const r = merge((reports) => {
    // A selector that drops it: the shard neither selects nor runs it.
    dropped = reports[2].selected.pop()
    reports[2].ran.pop()
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.ok(r.out.includes(`fixture "${dropped}" ran in no shard`), r.out)
})

test('a fixture that ran in two shards fails the merge', () => {
  let twice
  const r = merge((reports) => {
    twice = reports[0].selected[0]
    reports[1].selected.push(twice)
    reports[1].ran.push(twice)
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.ok(r.out.includes(`fixture "${twice}" ran in shards 1, 2`), r.out)
})

test('a missing shard report fails the merge', () => {
  const r = merge((reports) => reports.filter((x) => x.shard !== 3))
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /shard 3 of 4 sent no report/)
})

test('a shard reported twice fails the merge', () => {
  const r = merge((reports) => [...reports, reports[1]])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /shard 2 reported twice/)
})

test('a fixture that failed in its shard fails the merge', () => {
  const r = merge((reports) => {
    reports[0].failed.push(reports[0].selected[0])
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /shard 1: fixture ".+" did not fire/)
})

test('a report made from another fixture list fails the merge', () => {
  const r = merge((reports) => {
    reports[3].digest = '0000000000000000'
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /made from a different fixture list/)
})

test('an empty report directory fails the merge', () => {
  const r = merge(() => [])
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /no shard report found/)
  assert.match(r.out, /the merge FAILED/)
  assert.doesNotMatch(r.out, /did NOT fire/)
})

test('a rule id no shard asserted fails the merge', () => {
  const missing = CORPUS_IDS[0]
  const r = merge((reports) => {
    for (const x of reports) x.assertedRuleIds = x.assertedRuleIds.filter((id) => id !== missing)
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /rule-id coverage — FAILED/)
  assert.ok(r.out.includes(missing), r.out)
})

test('the shipped workflow runs the shards and the merge', () => {
  assert.deepEqual(checkNonvacuityJobs(CI), [])
})

test('a workflow without the merge job is refused', () => {
  const noMerge = CI.replace(/\n {2}nonvacuity:\s*\n[\s\S]*?(?=\n {2}\S|$)/, '\n')
  assert.notEqual(noMerge, CI)
  assert.match(checkNonvacuityJobs(noMerge).join('\n'), /no `nonvacuity` merge job/)
})

test('a merge job that a failed shard would skip is refused', () => {
  const skipped = CI.replace(/^ {4}if: \$\{\{ !cancelled\(\) \}\}$/m, '    if: success()')
  assert.notEqual(skipped, CI)
  assert.match(checkNonvacuityJobs(skipped).join('\n'), /a failed shard skips the merge/)
})

test('a merge job whose failure need not fail the run is refused', () => {
  const soft = CI.replace(
    /^ {4}needs: nonvacuity-shard$/m,
    '    needs: nonvacuity-shard\n    continue-on-error: true',
  )
  assert.notEqual(soft, CI)
  assert.match(checkNonvacuityJobs(soft).join('\n'), /continue-on-error/)
})

test('a merge job that does not wait for the shards is refused', () => {
  const early = CI.replace(/^ {4}needs: nonvacuity-shard\n/m, '')
  assert.notEqual(early, CI)
  assert.match(checkNonvacuityJobs(early).join('\n'), /does not wait for `nonvacuity-shard`/)
})

// C1 of PR #250's enforcement review: the partition was checked against what each
// shard SELECTED, so a shard whose loop ran nothing still read green. These two
// pin the evidence: a real shard reports what it ran, and the merge refuses a
// report whose `ran` falls short of its `selected`.
test('a report whose ran omits a selected fixture fails the merge', () => {
  let skipped
  const r = merge((reports) => {
    skipped = reports[1].ran.pop()
    return reports
  })
  assert.equal(r.code, 1, r.out)
  assert.ok(r.out.includes(`selected but not run: ${skipped}`), r.out)
  // And the partition is built from what ran, so the same fixture ran nowhere.
  assert.ok(r.out.includes(`fixture "${skipped}" ran in no shard`), r.out)
})

// One real fixture, chosen for being fast (about 35 ms) and needing no build:
// shard k+1 of T, with T the number of fixtures, selects exactly position k.
const FAST_FIXTURE = 'bun-load/ci-needs'
test('a shard runs and reports the fixture it selected', () => {
  const all = plan(1).shards[0].selected
  const k = all.indexOf(FAST_FIXTURE)
  assert.notEqual(k, -1, `${FAST_FIXTURE} is no longer a fixture; pick another fast one`)
  const dir = mkdtempSync(join(tmpdir(), 'nonvacuity-shard-'))
  try {
    const reportPath = join(dir, 'report.json')
    const r = harness({
      EESS_NONVACUITY_SHARD: `${k + 1}/${all.length}`,
      EESS_NONVACUITY_REPORT: reportPath,
    })
    assert.equal(r.code, 0, r.out)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert.deepEqual(report.selected, [FAST_FIXTURE])
    assert.deepEqual(report.ran, [FAST_FIXTURE])
    assert.deepEqual(report.failed, [])
    assert.match(r.out, /shard \d+\/\d+ — 1 fixtures each fired/)
    // The fixture's own line, which only `runGate` prints after running it: the
    // report and the summary are both written from `ran`, so they cannot answer
    // whether the fixture executed.
    assert.ok(r.out.includes(`nonvacuity: ${FAST_FIXTURE} — OK (fails on violating input)`), r.out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('duplicate fixture names are found', () => {
  assert.deepEqual(duplicateNames(['a', 'b', 'a', 'c', 'b']), ['a', 'b'])
  assert.deepEqual(duplicateNames(['a', 'b']), [])
})

test('a shard job that writes no report is refused', () => {
  const noReport = CI.replace(/^ +EESS_NONVACUITY_REPORT:.*\n/m, '')
  assert.notEqual(noReport, CI)
  assert.match(checkNonvacuityJobs(noReport).join('\n'), /does not set EESS_NONVACUITY_REPORT/)
})
