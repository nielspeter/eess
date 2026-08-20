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
import {
  packagesTouchedBy,
  declarationsIn,
  declaresBreaking,
  releaseViolations,
} from '../release-gate.mjs'

const RULES = [
  'release/changed-package-needs-changeset',
  'release/changeset-names-real-package',
  'release/unparseable-changeset',
  'release/breaking-needs-minor',
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
// `declarationsIn` must also REPORT the marker, or the chain from a real file to
// the rule is unexercised. Measured: deleting that field left this fixture green
// while the real gate missed a genuine break declared as a patch.
const withBreak = declarationsIn("---\n'@t/a': patch\n---\n\n**Breaking:** gone\n", '.changeset/b.md')
if (withBreak.breakingMarker !== '**Breaking:**')
  vacuous(
    `declarationsIn reported breakingMarker=${JSON.stringify(withBreak.breakingMarker)} for a body ` +
      `with a bolded lead, expected "**Breaking:**" — the shell cannot build breakingFiles`,
  )
const withoutBreak = declarationsIn("---\n'@t/a': patch\n---\n\nplain\n", '.changeset/p.md')
if (withoutBreak.breakingMarker !== undefined)
  vacuous('declarationsIn marked an ordinary changeset as breaking — the rule would fire on everything')

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
// --- B2. the breaking detector: what counts, and what must NOT ---------------

// The keyword set is a measured decision, not a guess (bug 0184). This repo
// writes a bolded `**Breaking…**` lead — 4 of 9 pending changesets do. It also
// writes `**Migration:**` sections, in 5 — but those two sets DIFFER, so keying
// on Migration would fire on changesets describing no break at all. A gate that
// reddens correct work gets suppressed, which is ADR-009 rule 1.
const BREAKING_CASES = [
  ['bolded lead', '**Breaking for subclasses of `SmellBuilder`:** renamed.', true],
  ['bolded with parenthetical', '**Breaking (0.x — minor signals it):** a rule now fails.', true],
  ['conventional marker', 'BREAKING CHANGE: the terminal throws.', true],
  ['hyphenated marker', 'BREAKING-CHANGE: the terminal throws.', true],
  // The negation that a naive /breaking/i would flag. This is the false positive
  // the record warned about, and it is why the bold/all-caps form is required.
  ['negated prose', 'This is not a breaking change for existing callers.', false],
  ['incidental prose', 'Avoids breaking the baseline when a unit changes.', false],
  // `**Migration:**` alone is guidance, not a break — measured on this repo.
  ['migration only', '**Migration:** re-run your baseline.', false],
  ['lowercase mid-sentence', 'the breaking case is handled', false],
  // Review found the first regex matched a bolded span ANYWHERE, so this
  // returned true — a false POSITIVE, the direction that gets a gate suppressed.
  ['bolded mid-sentence negation', 'We considered a **Breaking** change but did not make one.', false],
  // Line-anchored, so a lead behind a list marker still counts.
  ['bullet lead', '- **Breaking:** the export is gone.', true],
  ['bullet negation', '- We considered a **Breaking** change.', false],
  // The keep-a-changelog heading spelling, which a contributor arriving from
  // another repo writes. Missed by the first version.
  ['h2 heading', '## Breaking changes\n\nremoved foo()', true],
  ['h3 heading', '### Breaking\n\nremoved foo()', true],
  // Measured as misses by an adopter review: the plural is commoner in the wild
  // than the conventional-commits singular, and `__bold__` is CommonMark's other
  // strong emphasis. Neither can be matched by a negation, so both are free.
  ['plural CHANGES', 'BREAKING CHANGES: the method is renamed', true],
  ['underscore bold', '__Breaking:__ renamed', true],
]
for (const [name, body, want] of BREAKING_CASES) {
  let got
  try {
    got = declaresBreaking(body)
  } catch (err) {
    threw(`in declaresBreaking (${name})`, err)
  }
  if (got !== want)
    vacuous(
      `declaresBreaking("${name}") returned ${got}, expected ${want} — ` +
        (want
          ? 'a declared break would go unchecked'
          : 'the detector fires on prose, and a gate that reddens correct changesets gets suppressed'),
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
    declarations: [
      { pkg: '@fixture/ghost', bump: 'patch', file: '.changeset/ghost.md', line: 2 },
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/breaks.md', line: 2 },
    ],
    changedPackages: [{ name: '@fixture/core', dir: 'packages/core' }],
    workspacePackages,
    waivers: ['.changeset/empty.md'],
    unparseable: [{ file: '.changeset/bad.md', error: 'invalid YAML' }],
    breakingFiles: [{ file: '.changeset/breaks.md', marker: '**Breaking:**' }],
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
if (!waivedRules.has('release/breaking-needs-minor'))
  vacuous('an empty changeset silenced release/breaking-needs-minor — `--empty` must not disable the gate')
// The waived run has to name what it did not check, or the summary can print a ✓
// over an unchecked package (the shape of bug 0119, inside the waiver).
if (waived.stats.unchecked.join(',') !== '@fixture/core')
  vacuous(
    `a waived run reported unchecked=[${waived.stats.unchecked.join(',')}], expected ` +
      `[@fixture/core] — the output cannot say which packages went unchecked`,
  )

// --- D2. an empty changeset declaring a break is a FINDING, never a waiver ---

// `--empty` sets `waived`, which suppresses release/changed-package-needs-changeset
// for every changed package. So a file carrying the loudest marker the detector
// knows would otherwise turn off the strongest rule in the gate — measured at
// zero violations before this was closed. A declared break with no declared bump
// is a self-contradiction; fail closed.
let emptyBreak
try {
  emptyBreak = releaseViolations({
    declarations: [],
    changedPackages: [{ name: '@fixture/core', dir: 'packages/core' }],
    workspacePackages,
    waivers: ['.changeset/empty-but-breaking.md'],
    breakingFiles: [{ file: '.changeset/empty-but-breaking.md', marker: '**Breaking:**' }],
  })
} catch (err) {
  threw('on the empty-but-breaking input', err)
}
if (!emptyBreak.violations.some((v) => v.ruleId === 'release/breaking-needs-minor'))
  vacuous(
    'an empty changeset whose body declares a break produced no finding — `--empty` waives the ' +
      'changed-package rule for every package, so this shape silences more than itself',
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
      // Breaking body, patch bump: the irreversible case. `changeset publish`
      // ships with provenance and npm refuses a re-publish, so a contract break
      // released as a patch cannot be taken back.
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/breaks-on-patch.md', line: 2 },
      // Breaking body, minor bump on ONE of several packages: must stay quiet.
      // Siblings legitimately take a dependency patch while the owner declares
      // the break — `assertion-less-rules-fail.md` is exactly this shape.
      // NOT @fixture/core — that one must stay undeclared so the changed-package
      // rule keeps firing. Choosing it here silently disabled that rule and the
      // fixture caught it, which is the reason this file asserts an exact SET.
      { pkg: '@fixture/untouched', bump: 'minor', file: '.changeset/breaks-on-minor.md', line: 2 },
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/breaks-on-minor.md', line: 3 },
      { pkg: '@fixture/quiet', bump: 'none', file: '.changeset/breaks-on-none.md', line: 2 },
      { pkg: '@fixture/untouched', bump: 'minor', file: '.changeset/breaks-owned.md', line: 2 },
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/breaks-owned.md', line: 3 },
      { pkg: '@fixture/untouched', bump: 'minor', file: '.changeset/breaks-owned-ok.md', line: 2 },
      { pkg: '@fixture/quiet', bump: 'patch', file: '.changeset/breaks-owned-ok.md', line: 3 },
    ],
    breakingFiles: [
      { file: '.changeset/breaks-on-patch.md', marker: '**Breaking:**' },
      { file: '.changeset/breaks-on-minor.md', marker: '**Breaking:**' },
      // `none` is not an escape hatch here. It means "no release, recorded", and
      // a body declaring a break alongside it is still wrong — review measured an
      // earlier message ADVISING that exact state while firing on it.
      { file: '.changeset/breaks-on-none.md', marker: '**Breaking:**' },
      // OWNER NAMED, and the owner is the one on patch. The weak form accepts
      // this — a sibling took minor — and it is the shape that actually ships a
      // break as a patch. Naming the owner is what closes it.
      { file: '.changeset/breaks-owned.md', marker: '**Breaking (@fixture/quiet):**' },
      // Owner named and the owner IS past patch: must stay quiet, or naming the
      // owner would be a worse deal than not naming one.
      { file: '.changeset/breaks-owned-ok.md', marker: '**Breaking (@fixture/untouched):**' },
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
  'release/breaking-needs-minor :: .changeset/breaks-on-patch.md',
  'release/breaking-needs-minor :: .changeset/breaks-on-none.md',
  'release/breaking-needs-minor :: .changeset/breaks-owned.md',
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
const EXPECTED_STATS = {
  changed: 2,
  changedDeclared: 1,
  declarations: 11,
  workspace: 4,
  unparseable: 1,
  // The summary prints this. Sourced from the caller's own variable instead, it
  // once printed a ✓ over a rule that examined nothing — see release-gate.mjs.
  breakingExamined: 5,
  // Several packages, no owner named — only "at least one" could be asked.
  breakingLoose: 1,
}
for (const [k, want] of Object.entries(EXPECTED_STATS)) {
  if (result.stats[k] !== want)
    vacuous(`stats.${k} is ${result.stats[k]}, expected ${want} — the reported denominator is wrong`)
}

console.error(
  `bad-release: all ${RULES.length} rules fired on the expected elements and ${PARSE_CASES.length} parser shapes read correctly — ${RULES.join(', ')}`,
)
for (const v of result.violations) console.error(`  x ${v.ruleId} · ${v.message.split('\n')[0]}`)
process.exit(1)
