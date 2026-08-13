#!/usr/bin/env node
/**
 * Dogfood: eess's own honesty-at-close gate over this repo's plans corpus.
 *
 * The working method's first firm principle (see docs/working-method.md and the
 * kit under kit/): when a plan is finished, every part of it ends disposed —
 * done / done-otherwise / deferred→<home> / dropped-on-purpose — and the deferral
 * count is said out loud. A *done*-item (a terminal `State:` token, or a plan in
 * `completed/` / `wont-do/`) that still carries a silently-open `- [ ]` has lost
 * scope. This runs the `eess-md` `honestyAtClose` preset — the same gate the
 * portable kit ships — against our own corpus.
 *
 * Reports the denominator (done-items scanned) so a green is provably non-vacuous.
 * Exits non-zero on any finding. Run: `npm run check:ledger`.
 */
import { readdirSync } from 'node:fs'
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose, ledgerStats } from '@nielspeter/eess-md/rules/ledger'
import { reportViolations } from '@nielspeter/eess'
import { findUncoveredLanes } from './lib/lane-coverage.mjs'

// Two closing lanes, two vocabularies. A plan closes on `Done`/`Won't-do`; a bug
// closes on `Fixed`/`Rejected` (work/bugs/BUGS.md). They are scanned separately
// because a union would let a plan marked `Fixed` pass as a known state — the
// precision this gate exists for. Before bug 0118 only the plan lane was read at
// all, and an unrecognised token silently disabled half the check rather than
// reporting.
//
// `proposals` closes differently (bug 0121) and is not a third instance of the
// same shape. A proposal's `**State:**` token stays `Draft` even after review —
// the review outcome is a separate `Ruling`, recorded in a `## Review` section
// and on PROPOSALS.md's board, not a second State value (verified against all
// four proposals filed so far: none ever writes `State: Reviewed`). So
// `terminalStates: []`: nothing here is "ledger-closed" the way a plan/bug is,
// and `isDoneItem` is always false for this lane, which is deliberate — a
// proposal's own checkboxes are Acceptance Criteria / Open Questions, a design
// checklist, not a deferral ledger, and running the box-disposition check
// against them would be a false-positive machine (001 alone carries 31 open
// boxes of that shape). `closeInPlace: true` and `doneFolders: []` because
// proposals never move — a declined one (002) sits where it is with its ruling
// in its header.
const LANES = [
  {
    name: 'plans',
    roots: ['work/plans/**'],
    doneFolders: ['/completed/', '/wont-do/', '/archived/'],
    boardFiles: ['ROADMAP.md', 'README.md'],
    states: ['Draft', 'Ready', 'Open', 'Done', "Won't-do"],
    terminalStates: ['Done', "Won't-do"],
  },
  {
    name: 'bugs',
    roots: ['work/bugs/**'],
    doneFolders: ['/fixed/', '/rejected/'],
    boardFiles: ['BUGS.md', 'README.md'],
    states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
    terminalStates: ['Fixed', 'Rejected'],
  },
  {
    name: 'proposals',
    roots: ['work/proposals/**'],
    doneFolders: [],
    boardFiles: ['PROPOSALS.md', 'README.md'],
    closeInPlace: true,
    states: ['Draft'],
    terminalStates: [],
  },
]

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

// Per-lane scan. `report: 'return'` — the preset emits nothing and this script
// owns reporting (no double render, ADR-008 / plan 0070).
const scans = LANES.map((lane) => {
  const c = corpus({ roots: lane.roots })
  const opts = {
    doneFolders: lane.doneFolders,
    boardFiles: lane.boardFiles,
    states: lane.states,
    terminalStates: lane.terminalStates,
    closeInPlace: lane.closeInPlace,
  }
  // The denominator comes from the preset, not from a copy of its logic here.
  // The previous version re-derived it with the pre-0119 region expression, so it
  // found a State line in 0 of 59 records while this section claimed to prove the
  // green non-vacuous. A denominator that can disagree with the gate is not one.
  const stats = ledgerStats(c, opts)
  const violations = honestyAtClose(c, { ...opts, report: 'return' })
  return { lane, stats, violations }
})

// The reverse check (bug 0121): a `work/` subdirectory no LANES entry claims,
// but which carries State:-shaped records, is exactly the blindness that let
// `work/proposals/**` go unscanned for two full proposal-review rounds. A
// records-free directory (work/spikes/, today) is not a finding.
const claimedTopSegments = new Set(LANES.flatMap((l) => l.roots.map((r) => r.split('/')[1])))
const uncoveredLaneViolations = findUncoveredLanes('work', claimedTopSegments)
// Second, cheap readdirSync — purely for the summary's denominator. The
// judgment (does a directory carry records) stays inside findUncoveredLanes;
// this does not re-derive it, it only counts what's already on disk.
const workDirCount = readdirSync('work', { withFileTypes: true }).filter((e) =>
  e.isDirectory(),
).length

const violations = [...scans.flatMap((s) => s.violations), ...uncoveredLaneViolations]
const scanned = scans.reduce((n, s) => n + s.stats.scanned, 0)
const doneCount = scans.reduce((n, s) => n + s.stats.doneItems, 0)
const readable = scans.reduce((n, s) => n + s.stats.withReadableState, 0)

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  reportViolations(violations, { format })
  process.exit(violations.length > 0 ? 1 : 0)
}

const repoRoot = process.cwd()
const relTo = (file) =>
  file.startsWith(repoRoot) ? file.slice(repoRoot.length).replace(/^[/\\]/, '') : file
const line = (label, detail) => console.error(`  ${label.padEnd(11)}${detail}`)

console.error('')
console.error('check:ledger · honesty at close')
for (const sc of scans) {
  // A lane with no terminalStates (proposals) can never have a done-item —
  // isDoneItem reduces to `[].includes(x)`, always false — so its box-disposition
  // check is dead code by construction, not "nothing happens to be closed yet."
  // Say so at the one place a reader actually looks, not just in a source
  // comment: an unqualified "0 done" here would read exactly like the other two
  // lanes' 0, which can become nonzero on the next commit and this can't.
  const doneNote =
    sc.lane.terminalStates.length === 0
      ? 'no terminal state — box-disposition check never runs on this lane'
      : 'ledger-checked'
  line(
    sc.lane.name,
    `${sc.stats.scanned} scanned · ${sc.stats.withReadableState} with a readable State · ` +
      `${sc.stats.doneItems} done (${doneNote})`,
  )
}
line(
  'lanes',
  `${LANES.length} declared · ${workDirCount} work/ director${workDirCount === 1 ? 'y' : 'ies'} · ` +
    `${uncoveredLaneViolations.length} uncovered`,
)

if (violations.length > 0) {
  line('findings', `✗ ${violations.length}`)
  console.error('')
  for (const vv of violations)
    console.error(
      `    ${relTo(vv.file)}:${vv.line}  ${vv.rule}\n      ${vv.message.split('\n')[0]}`,
    )
} else {
  line('findings', '✓ every done-item reconciled')
}

console.error('')
if (violations.length === 0) {
  console.error(
    `  ✓ honesty at close — ${doneCount} done-items across ${scanned} records ` +
      `(${scans.map((sc) => `${sc.stats.scanned} ${sc.lane.name}`).join(' + ')}), ` +
      `${readable} with a readable State, 0 findings (${elapsed()})`,
  )
} else {
  console.error(
    `  ✗ honesty at close — ${violations.length} finding(s) across ${doneCount} done-items (${elapsed()})`,
  )
}
console.error('')

if (doneCount === 0)
  console.error(
    '  ⚠ 0 done-items scanned — vacuous. Adopt the terminal State: token / completed/ folder.\n',
  )

if (violations.length > 0) process.exit(1)
