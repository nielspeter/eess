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
import { corpus } from '@nielspeter/eess-md'
import { honestyAtClose, ledgerStats } from '@nielspeter/eess-md/rules/ledger'
import { reportViolations } from '@nielspeter/eess'

// Two lanes, two vocabularies. A plan closes on `Done`/`Won't-do`; a bug closes
// on `Fixed`/`Rejected` (work/bugs/BUGS.md). They are scanned separately because
// a union would let a plan marked `Fixed` pass as a known state — the precision
// this gate exists for. Before bug 0118 only the plan lane was read at all, and
// an unrecognised token silently disabled half the check rather than reporting.
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
  }
  // The denominator comes from the preset, not from a copy of its logic here.
  // The previous version re-derived it with the pre-0119 region expression, so it
  // found a State line in 0 of 59 records while this section claimed to prove the
  // green non-vacuous. A denominator that can disagree with the gate is not one.
  const stats = ledgerStats(c, opts)
  const violations = honestyAtClose(c, { ...opts, report: 'return' })
  return { lane, stats, violations }
})

const violations = scans.flatMap((s) => s.violations)
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
for (const sc of scans)
  line(
    sc.lane.name,
    `${sc.stats.scanned} scanned · ${sc.stats.withReadableState} with a readable State · ` +
      `${sc.stats.doneItems} done (ledger-checked)`,
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
