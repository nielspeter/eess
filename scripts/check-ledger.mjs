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

const ROOTS = ['work/plans/**']
const DONE_FOLDERS = ['/completed/', '/wont-do/', '/archived/']
const BOARD_FILES = ['ROADMAP.md', 'README.md']

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const c = corpus({ roots: ROOTS })

// Denominator: replicate the preset's done-item test for an honest scanned-count.
const DONE_STATE_RE = /^\s*(?:[-*]\s+)?(?:\*\*)?State:?(?:\*\*)?\s*(Done|Won't-do)\b/im
const docs = c.documents()
const boards = new Set(BOARD_FILES)
const items = docs.filter((d) => !boards.has(d.relPath.split('/').pop() ?? d.relPath))
const doneItems = items.filter(
  (d) =>
    DONE_FOLDERS.some((seg) => `/${d.relPath}`.includes(seg)) ||
    DONE_STATE_RE.test(d.text.split(/^##\s/m)[0] ?? ''),
)

// report: 'return' — the preset hands back violations and emits nothing, so we
// own reporting (no double render). --format json/github emits machine-readable
// output for the preset's violations (ADR-008 / plan 0070).
const violations = honestyAtClose(c, {
  doneFolders: DONE_FOLDERS,
  boardFiles: BOARD_FILES,
  report: 'return',
})
const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  reportViolations(violations, { format })
  process.exit(violations.length > 0 ? 1 : 0)
}

const relTo = (file) =>
  file.startsWith(c.root) ? file.slice(c.root.length).replace(/^[/\\]/, '') : file
const line = (label, detail) => console.error(`  ${label.padEnd(11)}${detail}`)

console.error('')
console.error('check:ledger · honesty at close')
line('roots', ROOTS.join(', '))
console.error('')
line('items', `${items.length} scanned · ${doneItems.length} done (ledger-checked)`)

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
    `  ✓ honesty at close — ${doneItems.length} done-items across ${items.length} plans, 0 findings (${elapsed()})`,
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
