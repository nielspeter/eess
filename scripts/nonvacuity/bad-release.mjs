#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the release gate must reject a changed package with no
 * changeset, a changeset naming a package that does not exist, and a changeset
 * the parser cannot read (bug 0106).
 *
 * Drives the pure core in `scripts/release-gate.mjs` with synthetic data — no
 * git, no fake repository. That is half the gate; the impure shell is covered by
 * its sibling `bad-release-e2e.mjs`, which runs the real script against real
 * repositories. The split exists because the first version of this gate proved
 * only the half that was easy to prove: a mutation matrix found the pure core
 * caught 11 of 11 mutations and the shell **0 of 7**, including deleting the
 * `process.exit(1)` that makes it a gate rather than a report — while the bug
 * record claimed the uncovered surface was a single line.
 *
 * Expected: all three rules, each on the expected element.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every rule fired as expected (gate correctly failed) — OK
 *   0 = a rule stayed quiet, or fired on the wrong thing (the gate is vacuous)
 *   2 = unexpected THROW only — never a behavioural result. Review found the
 *       first version reported `packagesTouchedBy` being gutted as "the fixture's
 *       premise is broken", which invites the next agent to edit the fixture and
 *       so completes the sabotage. A gate regression must never read as fixture
 *       breakage.
 */
import { packagesTouchedBy, declarationsIn, releaseViolations } from '../release-gate.mjs'

const RULES = [
  'release/changed-package-needs-changeset',
  'release/changeset-names-real-package',
  'release/unparseable-changeset',
]

/** A behavioural expectation failed → the gate is vacuous (exit 0), never "premise broken". */
function vacuous(msg) {
  console.error(`bad-release: ${msg}`)
  process.exit(0)
}
/** Only a genuine throw is exit 2. */
function threw(where, err) {
  console.error(`bad-release: unexpected error ${where} — ${String(err)}`)
  process.exit(2)
}

const workspacePackages = [
  { name: '@fixture/core', dir: 'packages/core' },
  { name: '@fixture/core-extra', dir: 'packages/core-extra' },
  { name: '@fixture/quiet', dir: 'packages/quiet' },
  { name: '@fixture/untouched', dir: 'packages/untouched' },
]

// --- A. the path→package mapping the diff side depends on -------------------

let touched
try {
  touched = packagesTouchedBy(
    ['packages/core/src/index.ts', 'packages/core-extra/README.md', 'docs/m.md', 'package.json'],
    workspacePackages,
  )
} catch (err) {
  threw('in packagesTouchedBy', err)
}
if (touched.map((p) => p.name).join(', ') !== '@fixture/core, @fixture/core-extra')
  vacuous(
    `packagesTouchedBy returned "${touched.map((p) => p.name).join(', ')}", expected ` +
      `"@fixture/core, @fixture/core-extra" — the diff side is mis-attributing files`,
  )

// A missing separator (`startsWith(dir)`) matches BOTH packages for a sibling's
// file, and the mixed list above cannot see it because the set is unchanged.
const siblingOnly = packagesTouchedBy(['packages/core-extra/README.md'], workspacePackages)
if (siblingOnly.map((p) => p.name).join(', ') !== '@fixture/core-extra')
  vacuous(
    `a file under packages/core-extra/ mapped to "${siblingOnly.map((p) => p.name).join(', ')}" ` +
      `— prefix matching is bleeding across package boundaries`,
  )

// --- B. the parser: every shape that used to become a silent blanket waiver --

// Each of these is a real changeset `changeset version` acts on. The first
// implementation hand-rolled a regex and read all of them as `--empty`, i.e. as
// an intentional repo-wide waiver. `'@t/a': none` is the sharpest: a valid bump
// type meaning "no release, recorded" — the most honest changeset a contributor
// can write, and it switched the gate off.
const PARSE_CASES = [
  ['plain', "---\n'@t/a': minor\n---\n\nb\n", 1, false],
  ['trailing comment', "---\n'@t/a': minor # note\n---\n\nb\n", 1, false],
  ['bump none', "---\n'@t/a': none\n---\n\nb\n", 1, false],
  ['multi-line value', "---\n'@t/a':\n  minor\n---\n\nb\n", 1, false],
  ['flow mapping', '---\n{ "@t/a": patch }\n---\n\nb\n', 1, false],
  ['two packages', "---\n'@t/a': minor\n'@t/b': patch\n---\n\nb\n", 2, false],
  ['CRLF', "---\r\n'@t/a': minor\r\n---\r\n\r\nb\r\n", 1, false],
  ['genuinely empty', '---\n---\n', 0, true],
]
for (const [name, text, count, empty] of PARSE_CASES) {
  let r
  try {
    r = declarationsIn(text, '.changeset/x.md')
  } catch (err) {
    threw(`in declarationsIn (${name})`, err)
  }
  if (r.error !== undefined)
    vacuous(`declarationsIn rejected the "${name}" changeset (${r.error}) — it is valid upstream`)
  if (r.declarations.length !== count)
    vacuous(
      `declarationsIn read ${r.declarations.length} declaration(s) from the "${name}" changeset, ` +
        `expected ${count} — a declaration read as nothing becomes a blanket waiver`,
    )
  if (r.empty !== empty)
    vacuous(
      `declarationsIn reported empty=${r.empty} for the "${name}" changeset, expected ${empty} — ` +
        `only a genuinely empty changeset may waive`,
    )
}
// A file the parser rejects must be a finding, never a waiver.
let broken
try {
  broken = declarationsIn('not frontmatter at all\n', '.changeset/bad.md')
} catch (err) {
  threw('in declarationsIn (garbage)', err)
}
if (broken.error === undefined || broken.empty)
  vacuous('an unparseable changeset was not reported as an error — it would waive the gate')

// --- C. the clean direction is quiet ----------------------------------------

let clean
try {
  clean = releaseViolations({
    declarations: [{ pkg: '@fixture/quiet', bump: 'minor', file: '.changeset/ok.md', line: 2 }],
    changedPackages: [{ name: '@fixture/quiet', dir: 'packages/quiet' }],
    workspacePackages,
    waivers: [],
    unparseable: [],
  })
} catch (err) {
  threw('on the clean input', err)
}
if (clean.violations.length > 0)
  vacuous(
    `the declared-and-changed input produced ${clean.violations.length} violation(s) — the gate ` +
      `is red for everything: ${clean.violations.map((v) => v.ruleId).join(', ')}`,
  )

// --- D. a waiver waives one rule, not the gate ------------------------------

let waived
try {
  waived = releaseViolations({
    declarations: [{ pkg: '@fixture/ghost', bump: 'patch', file: '.changeset/ghost.md', line: 2 }],
    changedPackages: [{ name: '@fixture/core', dir: 'packages/core' }],
    workspacePackages,
    waivers: ['.changeset/empty.md'],
    unparseable: [{ file: '.changeset/bad.md', error: 'invalid YAML' }],
  })
} catch (err) {
  threw('on the waived input', err)
}
const waivedRules = new Set(waived.violations.map((v) => v.ruleId))
if (waivedRules.has('release/changed-package-needs-changeset'))
  vacuous('a waiver in the diff did not waive the changed-package rule')
if (!waivedRules.has('release/changeset-names-real-package'))
  vacuous('an empty changeset silenced release/changeset-names-real-package — `--empty` must not disable the gate')
if (!waivedRules.has('release/unparseable-changeset'))
  vacuous('an empty changeset silenced release/unparseable-changeset — `--empty` must not disable the gate')
// The waived run has to name what it did not check, or the summary can print a ✓
// over an unchecked package (the shape of bug 0119, inside the waiver).
if (waived.stats.unchecked.join(',') !== '@fixture/core')
  vacuous(
    `a waived run reported unchecked=[${waived.stats.unchecked.join(',')}], expected ` +
      `[@fixture/core] — the output cannot say which packages went unchecked`,
  )

// --- E. the measurement: every rule fires, on the expected element ------------

let result
try {
  result = releaseViolations({
    declarations: [
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/ok.md', line: 2 },
      // A real package that did NOT change: this is what distinguishes "names a
      // real package" from "names a CHANGED package". Without it, binding the
      // rule's right side to the changed set instead of the workspace survives
      // the fixture — measured, and the normal state of a release train.
      { pkg: '@fixture/untouched', bump: 'patch', file: '.changeset/earlier.md', line: 2 },
      { pkg: '@fixture/ghost', bump: 'minor', file: '.changeset/ghost.md', line: 2 },
    ],
    changedPackages: [
      { name: '@fixture/core', dir: 'packages/core' },
      { name: '@fixture/quiet', dir: 'packages/quiet' },
    ],
    workspacePackages,
    waivers: [],
    unparseable: [{ file: '.changeset/bad.md', error: 'invalid YAML in frontmatter' }],
  })
} catch (err) {
  threw('running releaseViolations', err)
}

// Rule AND element, as an exact set. Asserting rule names alone is not enough,
// and this fixture proved it on itself: flipping the changed-package
// correspondence to `left-to-right` neuters the check entirely, yet still emits
// `release/changed-package-needs-changeset` — against the ghost DECLARATION
// rather than the undeclared package. Same rule id, opposite meaning. This is
// bug 0110's lesson (name the rule, don't just count) taken one level further:
// name what the rule fired ON.
const EXPECTED = [
  'release/changed-package-needs-changeset :: @fixture/core',
  'release/changeset-names-real-package :: @fixture/ghost',
  'release/unparseable-changeset :: .changeset/bad.md',
]
const actual = result.violations.map((v) => `${v.ruleId} :: ${v.element}`).sort()
if (actual.join(' | ') !== [...EXPECTED].sort().join(' | ')) {
  const fired = new Set(result.violations.map((v) => v.ruleId))
  const missing = RULES.filter((r) => !fired.has(r))
  vacuous(
    missing.length > 0
      ? `${missing.length} of ${RULES.length} rules did not fire — gate is vacuous for ` +
          `${missing.join(', ')} (fired: ${[...fired].join(', ') || 'none'})`
      : `every rule fired, but not on the expected elements — the gate is red for the wrong ` +
          `reason.\n  expected: ${[...EXPECTED].sort().join(' | ')}\n  actual:   ${actual.join(' | ')}`,
  )
}

// Every violation must carry its rationale. The gate used to stamp this itself,
// because the kernel's `.violations()` path dropped `ctx.reason`; bug 0122 moved
// the stamp into `applyFilters` and the local helper was deleted. The assertion
// stays and is now a gate-level break class for that kernel fix — removing the
// stamp reddens this fixture, not just the unit tests.
const unexplained = result.violations.filter((v) => !v.because)
if (unexplained.length > 0)
  vacuous(
    `${unexplained.length} violation(s) carry no \`because\` — ${unexplained.map((v) => v.ruleId).join(', ')}`,
  )

// --- F. the denominator itself ----------------------------------------------

// stats drives every number the gate prints. Zeroing any of them left the first
// fixture green while the summary reported a run that had scanned nothing —
// exactly the shrinking-denominator failure this harness exists to catch.
const EXPECTED_STATS = { changed: 2, changedDeclared: 1, declarations: 3, workspace: 4, unparseable: 1 }
for (const [k, want] of Object.entries(EXPECTED_STATS)) {
  if (result.stats[k] !== want)
    vacuous(`stats.${k} is ${result.stats[k]}, expected ${want} — the reported denominator is wrong`)
}

console.error(
  `bad-release: all ${RULES.length} rules fired on the expected elements and ${PARSE_CASES.length} parser shapes read correctly — ${RULES.join(', ')}`,
)
for (const v of result.violations) console.error(`  x ${v.ruleId} · ${v.message.split('\n')[0]}`)
process.exit(1)
