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
import { honestyAtClose } from '@nielspeter/eess-md/rules/ledger'
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
  const boards = new Set(lane.boardFiles)
  const items = c.documents().filter((d) => !boards.has(d.relPath.split('/').pop() ?? d.relPath))
  // Denominator: the preset's own done-item test, per lane's vocabulary.
  const stateOf = (d) => {
    const header = d.text.split(/^##\s/m)[0] ?? ''
    for (const ln of header.split('\n')) {
      const m = /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?\s*(\S+)/i.exec(ln)
      if (m) return m[1]
    }
    return undefined
  }
  const doneItems = items.filter(
    (d) =>
      lane.doneFolders.some((seg) => `/${d.relPath}`.includes(seg)) ||
      lane.terminalStates.includes(stateOf(d)),
  )
  const violations = honestyAtClose(c, {
    doneFolders: lane.doneFolders,
    boardFiles: lane.boardFiles,
    states: lane.states,
    terminalStates: lane.terminalStates,
    report: 'return',
  })
  return { lane, c, items, doneItems, violations }
})

const violations = scans.flatMap((s) => s.violations)
const items = scans.flatMap((s) => s.items)
const doneItems = scans.flatMap((s) => s.doneItems)

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
  line(sc.lane.name, `${sc.items.length} scanned · ${sc.doneItems.length} done (ledger-checked)`)

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
    `  ✓ honesty at close — ${doneItems.length} done-items across ${items.length} records ` +
      `(${scans.map((sc) => `${sc.items.length} ${sc.lane.name}`).join(' + ')}), 0 findings (${elapsed()})`,
  )
} else {
  console.error(
    `  ✗ honesty at close — ${violations.length} finding(s) across ${doneItems.length} done-items (${elapsed()})`,
  )
}
console.error('')

if (doneItems.length === 0)
  console.error(
    '  ⚠ 0 done-items scanned — vacuous. Adopt the terminal State: token / completed/ folder.\n',
  )

if (violations.length > 0) process.exit(1)
