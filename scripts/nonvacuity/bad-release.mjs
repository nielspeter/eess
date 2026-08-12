#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the release gate must reject both a changed package with
 * no changeset and a changeset naming a package that does not exist (bug 0106).
 *
 * Drives `scripts/release-gate.mjs` — the gate's pure core — with synthetic
 * inputs. No git, no fake repository: "which packages changed" is the impure
 * half and lives in `check-release.mjs`, so everything worth proving here is a
 * function of plain data. That split is deliberate (bug 0119's lesson: a
 * denominator that can disagree with the gate is not one), and it is also the
 * fixture's boundary — the single `git diff` shell-out is not exercised here.
 * Its failure mode is a hard error on an unresolvable base ref, not a silent
 * green, which is why that is a stated limit rather than a hidden one.
 *
 * Expected: `release/changed-package-needs-changeset` AND
 * `release/changeset-names-real-package`, both from one run.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = both rules fired (gate correctly failed) — OK
 *   0 = a rule stayed quiet (the gate is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or the fixture's own premise broke — treated as fail
 */
import { packagesTouchedBy, releaseViolations } from '../release-gate.mjs'

const RULES = ['release/changed-package-needs-changeset', 'release/changeset-names-real-package']

// A synthetic three-package workspace. Names deliberately share a prefix — the
// ownership test is `dir === f || f.startsWith(dir + '/')`, and a fixture whose
// packages cannot collide would not notice `startsWith(dir)` matching
// `packages/core-extra/x.ts` as a change to `packages/core`.
const workspacePackages = [
  { name: '@fixture/core', dir: 'packages/core' },
  { name: '@fixture/core-extra', dir: 'packages/core-extra' },
  { name: '@fixture/quiet', dir: 'packages/quiet' },
]

// --- premise 1: the path→package mapping the diff side depends on -----------

let touched
try {
  touched = packagesTouchedBy(
    [
      'packages/core/src/index.ts', // owned by core
      'packages/core-extra/README.md', // owned by core-extra, NOT by core
      'docs/manifesto.md', // owned by nobody
      'package.json', // owned by nobody
    ],
    workspacePackages,
  )
} catch (err) {
  console.error(`bad-release: unexpected error in packagesTouchedBy — ${String(err)}`)
  process.exit(2)
}
const touchedNames = touched.map((p) => p.name).join(', ')
if (touchedNames !== '@fixture/core, @fixture/core-extra') {
  console.error(
    `bad-release: packagesTouchedBy returned "${touchedNames}", expected ` +
      `"@fixture/core, @fixture/core-extra" — the fixture's premise is broken, not the gate proven`,
  )
  process.exit(2)
}

// The mixed list above cannot catch a missing separator: with `startsWith(dir)`
// instead of `startsWith(dir + '/')`, `packages/core-extra/…` matches BOTH
// packages and the set is unchanged. So the sibling is also asserted alone —
// mis-attributing one package's file to another is how a changed package gets
// counted as declared by its neighbour's changeset.
const siblingOnly = packagesTouchedBy(['packages/core-extra/README.md'], workspacePackages)
  .map((p) => p.name)
  .join(', ')
if (siblingOnly !== '@fixture/core-extra') {
  console.error(
    `bad-release: a file under packages/core-extra/ mapped to "${siblingOnly}", expected ` +
      `"@fixture/core-extra" alone — prefix matching is bleeding across package boundaries`,
  )
  process.exit(0)
}

// --- premise 2: the clean direction is quiet --------------------------------

// A changed package that IS declared must contribute nothing. Without this a
// permanently-red gate would read as a working one.
let clean
try {
  clean = releaseViolations({
    declarations: [{ pkg: '@fixture/quiet', bump: 'minor', file: '.changeset/ok.md', line: 2 }],
    changedPackages: [{ name: '@fixture/quiet', dir: 'packages/quiet' }],
    workspacePackages,
    blanketWaivers: [],
  })
} catch (err) {
  console.error(`bad-release: unexpected error on the clean input — ${String(err)}`)
  process.exit(2)
}
if (clean.violations.length > 0) {
  console.error(
    `bad-release: the declared-and-changed input produced ${clean.violations.length} violation(s) — ` +
      `the fixture's premise is broken: ${clean.violations.map((v) => v.ruleId).join(', ')}`,
  )
  process.exit(2)
}

// --- premise 3: a blanket waiver must not silence the OTHER rule ------------

// An empty changeset declares "this ships nothing" and waives the changed-package
// rule. It says nothing about whether the other pending changesets name real
// packages — if it silenced that too, `--empty` would become a way to turn the
// whole gate off in one commit.
let waived
try {
  waived = releaseViolations({
    declarations: [{ pkg: '@fixture/ghost', bump: 'patch', file: '.changeset/ghost.md', line: 2 }],
    changedPackages: [{ name: '@fixture/core', dir: 'packages/core' }],
    workspacePackages,
    blanketWaivers: ['.changeset/empty.md'],
  })
} catch (err) {
  console.error(`bad-release: unexpected error on the waived input — ${String(err)}`)
  process.exit(2)
}
const waivedRules = new Set(waived.violations.map((v) => v.ruleId))
if (waivedRules.has('release/changed-package-needs-changeset')) {
  console.error(
    'bad-release: the blanket waiver did not waive release/changed-package-needs-changeset — ' +
      "the fixture's premise is broken",
  )
  process.exit(2)
}
if (!waivedRules.has('release/changeset-names-real-package')) {
  console.error(
    'bad-release: an empty changeset silenced release/changeset-names-real-package — ' +
      '`changeset add --empty` must not be a way to disable the whole gate',
  )
  process.exit(0)
}

// --- the measurement: both rules fire on violating input --------------------

let result
try {
  result = releaseViolations({
    // one real declaration (so the gate is not trivially empty) + one ghost
    declarations: [
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/ok.md', line: 2 },
      { pkg: '@fixture/ghost', bump: 'minor', file: '.changeset/ghost.md', line: 2 },
    ],
    // core changed and is undeclared; quiet changed and is declared
    changedPackages: [
      { name: '@fixture/core', dir: 'packages/core' },
      { name: '@fixture/quiet', dir: 'packages/quiet' },
    ],
    workspacePackages,
    blanketWaivers: [],
  })
} catch (err) {
  console.error(`bad-release: unexpected error running releaseViolations — ${String(err)}`)
  process.exit(2)
}

// Assert rule AND element, as an exact set. Asserting only the rule names is not
// enough, and this fixture proved it on itself: flipping the changed-package
// correspondence to `left-to-right` neuters the check entirely, yet it still
// emits `release/changed-package-needs-changeset` — now reporting the ghost
// DECLARATION rather than the undeclared package. Same rule id, opposite
// meaning, and a rule-name assertion calls that a pass. This is bug 0110's
// lesson (name the rule, don't just count) taken one level further: name what
// the rule fired ON. The set is exact in both directions, so a gate that goes
// red for everything fails here too.
const EXPECTED = [
  'release/changed-package-needs-changeset :: @fixture/core',
  'release/changeset-names-real-package :: @fixture/ghost',
]
const actual = result.violations.map((v) => `${v.ruleId} :: ${v.element}`).sort()
const expected = [...EXPECTED].sort()
if (actual.join(' | ') !== expected.join(' | ')) {
  const fired = new Set(result.violations.map((v) => v.ruleId))
  const missing = RULES.filter((r) => !fired.has(r))
  console.error(
    missing.length > 0
      ? `bad-release: ${missing.length} of ${RULES.length} rules did not fire — gate is vacuous ` +
          `for ${missing.join(', ')} (fired: ${[...fired].join(', ') || 'none'})`
      : `bad-release: both rules fired, but not on the expected elements — the gate is red for ` +
          `the wrong reason.\n  expected: ${expected.join(' | ')}\n  actual:   ${actual.join(' | ') || 'none'}`,
  )
  process.exit(0)
}

console.error(
  `bad-release: all ${RULES.length} rules fired on the expected elements — ` +
    `${expected.join(' | ')} (${result.stats.changed} changed, ${result.stats.changedDeclared} declared)`,
)
for (const v of result.violations) console.error(`  x ${v.ruleId} · ${v.message.split('\n')[0]}`)
process.exit(1)
