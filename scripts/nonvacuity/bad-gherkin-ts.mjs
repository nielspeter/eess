#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the scenario↔test gate must reject a test that cites a
 * scenario the feature set does not contain. scenarioTestsResolve() is run with
 * the committed gherkin-ts `red` fixture project (whose it() titles cite a
 * missing feature, an ambiguous suffix, and an absent scenario title) against
 * the `features/**` set. Expected: it throws ArchRuleError.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = expected dangling citation detected (gate correctly failed) — OK
 *   0 = NO drift detected (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error (module load, etc.) — the harness treats this as fail
 */
import { scenarioTestsResolve } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'

const root = 'packages/crossvalidate/tests/fixtures/gherkin-ts'
const RULE = 'crossval/scenario-tests-resolve'

// `report: 'return'` hands back the violations with their ruleIds instead of
// throwing (ADR-008 — the caller owns reporting). That removes the need to
// type-check a thrown error, and lets this fixture assert WHICH rule fired
// rather than that something did (bug 0110).
let set
let violations
try {
  set = features({ cwd: root, roots: ['features/**'] })
  violations = scenarioTestsResolve(project(`${root}/red/tsconfig.json`), set, {
    report: 'return',
  })
} catch (err) {
  console.error(`bad-gherkin-ts: unexpected error — ${String(err)}`)
  process.exit(2)
}

// The fixture's own denominator. With zero features loaded EVERY citation
// dangles, so "some citation is dangling" is trivially true and proves nothing
// about the rule — a drifted feature root would leave this gate green forever
// (bug 0110). The gate must be non-vacuous on its own input before its result
// means anything.
const featureCount = set.features().length
if (featureCount === 0) {
  console.error(
    `bad-gherkin-ts: the feature set loaded 0 features — this fixture proves nothing ` +
      `(every citation dangles against an empty set); check roots under ${root}`,
  )
  process.exit(2)
}

const fired = violations.filter((v) => v.ruleId === RULE)

// **Each CLASS the fixture plants, not just the rule id (bug 0257's review).**
// This used to assert `fired.length > 0` alone. The fixture plants three
// distinct faults — a dangling path, an ambiguous suffix, and a missing
// scenario title — and they all carry the same rule id, so a regression
// confined to ONE of them left the gate green: the other two kept the count
// non-zero. Measured, on the change that shared the suffix resolver between
// dialects — collapsing an ambiguity to its first candidate reddened
// `corpus/pointers/ambiguous` on the md side and left this row OK.
//
// The md side's own `gateCorpusPointerAmbiguous` had this discipline already
// ("classed ambiguous, named both candidates"); this row did not, so the two
// callers of one resolver had unequal proof.
const CLASSES = [
  ['dangling', /no such feature file/],
  ['ambiguous', /ambiguous, matches \d+ feature files/],
  ['missing scenario', /no such scenario in that feature file/],
]
const missing = CLASSES.filter(([, re]) => !fired.some((v) => re.test(v.message))).map(([n]) => n)

if (fired.length > 0 && missing.length === 0) {
  console.error(
    `bad-gherkin-ts: all ${String(CLASSES.length)} citation faults detected as expected — ${RULE}, ` +
      `${fired.length} of ${violations.length} violation(s) across ${featureCount} feature file(s)`,
  )
  for (const v of fired) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

if (fired.length > 0) {
  console.error(
    `bad-gherkin-ts: ${RULE} fired, but not for ${missing.join(' / ')} — a regression ` +
      `confined to that class would hide behind the classes that still fire`,
  )
  for (const v of fired) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(0)
}

const seen = [...new Set(violations.map((v) => v.ruleId))].join(', ') || 'none'
console.error(
  `bad-gherkin-ts: no ${RULE} violation detected — gate is vacuous (ruleIds seen: ${seen})`,
)
process.exit(0)
