#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the ADR↔test gate must reject a citation whose test does
 * not exist. `adrCitationsResolve` is run over the committed fixture ADR
 * `0005-renamed.md`, which cites ``it('catches `GONE` in a deleted test')``,
 * against the single-test `orphan/` project. Expected: it throws ArchRuleError
 * carrying `crossval/adr-citations-resolve`.
 *
 * Why this fixture and not a simpler dangling citation: the orphan project holds
 * exactly one test, ``it('catches `TODO` in a comment')``, which shares
 * everything up to its first backtick with the cited ghost. So the gate goes red
 * here under **both** sabotage directions — empty the citation extractor (no
 * citations, nothing to fail) and reintroduce bug 0104's truncation (both sides
 * key on `catches ` and the ghost resolves against the survivor). Either way
 * this exits 0 and the harness reports the gate vacuous.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = dangling citation detected (gate correctly failed on violating input) — OK
 *   0 = NO violation (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { adrCitationsResolve } from '@nielspeter/eess-crossvalidate/md-ts'
import { calls, project } from '@nielspeter/eess-ts'

const ROOT = 'packages/crossvalidate/tests/fixtures/citations'
const RULE = 'crossval/adr-citations-resolve'

const c = (doc) => corpus({ roots: [doc], cwd: ROOT })
const orphan = () => project(`${ROOT}/orphan/tsconfig.json`)

// The fixture's own denominator. A citation dangles trivially against a project
// that loaded no tests at all, so a drifted tsconfig would leave this gate
// exiting 1 forever while proving nothing (bug 0110's class). Count first.
let tests
try {
  tests = calls(orphan())
    .select({ label: 'call', identify: (x) => ({ name: x.getName() ?? '' }) })
    .elements.filter((x) => x.getName() === 'it').length
} catch (err) {
  console.error(`bad-md-ts: unexpected error loading the orphan project — ${String(err)}`)
  process.exit(2)
}
if (tests !== 1) {
  console.error(
    `bad-md-ts: the orphan project holds ${tests} test(s), expected exactly 1 — this fixture ` +
      `proves nothing (a citation dangles trivially against an empty project); check ${ROOT}/orphan`,
  )
  process.exit(2)
}

// The clean direction, so a gate stuck permanently red cannot pass for a working
// one: a citation naming a test that DOES exist must resolve. `0003-backticked.md`
// cites one of two tests identical up to their first backtick — it is exactly the
// citation bug 0104 reported as ambiguous.
try {
  adrCitationsResolve(c('docs/adr/0003-backticked.md'), project(`${ROOT}/tsconfig.json`), {
    dir: 'docs/adr/**',
  })
} catch (err) {
  console.error(
    `bad-md-ts: a citation naming a real test failed to resolve — the fixture's premise is ` +
      `broken, not the gate proven — ${String(err)}`,
  )
  process.exit(2)
}

try {
  adrCitationsResolve(c('docs/adr/0005-renamed.md'), orphan(), { dir: 'docs/adr/**' })
} catch (err) {
  if (!(err instanceof ArchRuleError)) {
    console.error(`bad-md-ts: unexpected error (not ArchRuleError) — ${String(err)}`)
    process.exit(2)
  }
  // Assert WHICH rule fired, not that something did (bug 0110). `adrCitationsResolve`
  // returns void (bug 0097), so the violations are read off the thrown error.
  const dangling = err.violations.filter(
    (v) => v.ruleId === RULE && /has no matching test/.test(v.message),
  )
  if (dangling.length === 0) {
    const seen = [...new Set(err.violations.map((v) => v.ruleId))].join(', ') || 'none'
    console.error(`bad-md-ts: threw, but no ${RULE} violation — gate is vacuous (ruleIds: ${seen})`)
    process.exit(0)
  }
  console.error(
    `bad-md-ts: dangling citation detected as expected — ${RULE}, ` +
      `${dangling.length} violation(s) against ${tests} test(s) in the project`,
  )
  for (const v of dangling) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

console.error(
  `bad-md-ts: NO ${RULE} violation detected — a citation naming a test that exists nowhere ` +
    `resolved against the ${tests}-test project; gate is vacuous`,
)
process.exit(0)
