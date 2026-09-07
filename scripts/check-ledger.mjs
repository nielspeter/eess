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
import {
  collectResult,
  finishPreset,
  mergeCollectResults,
  reportViolations,
} from '@nielspeter/eess'
import { findUncoveredLanes, findLaneDoneVacuity, laneDirectories } from './lib/lane-coverage.mjs'
import { PROPOSAL_DONE_FOLDERS } from './lib/proposal-ruling.mjs'
import { findFinishedNotClosed } from './lib/finished-not-closed.mjs'

// Two closing lanes, two vocabularies. A plan closes on `Done`/`Won't-do`; a bug
// closes on `Fixed`/`Rejected` (work/bugs/BUGS.md). They are scanned separately
// because a union would let a plan marked `Fixed` pass as a known state — the
// precision this gate exists for. Before bug 0118 only the plan lane was read at
// all, and an unrecognised token silently disabled half the check rather than
// reporting.
//
// `proposals` closes on its own vocabulary (plan 0216). Review does not close a
// proposal — the `Ruling` records the verdict, and a proposal reviewed
// `Rewrite needed` stays live. What closes it is the ask being *dispatched*:
// `Promoted` when plans or bugs own it (the header names them), `Rejected` when
// it will not be done — the bugs lane's word, not a third synonym for it.
//
// The terminal token names its successor, which is the whole reason promotion is
// safe here. Until 0216 this lane ran `terminalStates: []`, and the comment that
// stood here argued a terminal state was impossible: a proposal's checkboxes are
// Acceptance Criteria / Open Questions — a design checklist, not a deferral
// ledger — so box-disposition would be a false-positive machine. That half is
// still true, and it is not the objection it looked like. Measured 2026-08-23:
// 001 carries 29 open boxes and 002 carries 6, the other four carry none, and
// BOTH are ruled `Rewrite needed`. They stay live, never promote, and their boxes
// never reach the check. A proposal's boxes travel with it into the plan it
// promotes to — that is what promotion means. (The old comment said "001 alone
// carries 31"; it carries 29. The count was never re-measured after it was
// written.)
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
    doneFolders: PROPOSAL_DONE_FOLDERS,
    boardFiles: ['PROPOSALS.md', 'README.md'],
    states: ['Draft', 'Promoted', 'Rejected'],
    terminalStates: ['Promoted', 'Rejected'],
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
// Purely for the summary's denominator. The judgment (does a directory carry
// records) stays inside findUncoveredLanes; this only counts what's on disk,
// through the same shared enumeration both gates now use.
const workDirCount = laneDirectories('work').length

// This repo's own corpus has carried done-items in every lane with a real
// terminalStates vocabulary for its entire history — a lane reporting 0 is
// never a legitimate Day 0 here (unlike a fresh `kit/`-bootstrapped project,
// which is why `expectEmptyDone` exists per-lane rather than this being a
// blanket assumption, and why this check lives here, in this repo's own
// wiring, not inside `honestyAtClose` itself). Checked **per lane**, not
// summed across all of them: bug 0131's round-2 review sabotaged `isDoneItem`
// globally and found the sum the only signal that would have caught it, but
// round 3's review found the sum itself has a hole — a corruption scoped to
// ONE lane (a `doneFolders`/`terminalStates` typo, a selector break) stays
// completely invisible as long as some OTHER lane still has a nonzero count.
// `findLaneDoneVacuity` produces real `ArchViolation`s (not a side boolean),
// so it flows through `reportViolations` the same as every other finding —
// silence is not "nothing deferred," and it is not "nothing done" either.
const laneDoneVacuousViolations = findLaneDoneVacuity(
  scans.map((s) => ({
    name: s.lane.name,
    terminalStates: s.lane.terminalStates,
    doneItems: s.stats.doneItems,
    expectEmptyDone: s.lane.expectEmptyDone,
  })),
)

// The reverse of honesty-at-close. `honestyAtClose` proves a DONE item hides no
// open box; this proves an OPEN item is not secretly finished. The missing
// direction is where completed work sat: 0170 and 0171 were both fully ticked,
// zero open, "ready to close", and open since 2026-08-19 with this gate green
// over them the whole time.
const finishedNotClosed = findFinishedNotClosed(
  scans.map((s) => ({
    roots: s.lane.roots,
    doneFolders: s.lane.doneFolders,
    states: s.lane.states,
    terminalStates: s.lane.terminalStates,
  })),
)
const finishedNotClosedViolations = finishedNotClosed.violations

// **One receipt, built once, used by BOTH exits** — the shape
// `scripts/check-corpus.mjs` has carried since plan 0235, arriving here because
// ADR-014's row asks for a break-the-loop fixture on this gate's DEFAULT path
// and there was nothing on that path to fire: this script hand-printed its
// verdict and reached no emitter at all.
//
// **Every member is the receipt its own check returned.** Nothing here supplies
// a denominator from outside, and that is the correction plan 0263's first
// attempt at this phase needed after review. That attempt stamped
// `ledgerStats(...).scanned` onto `honestyAtClose`'s findings and a disk count
// onto `findUncoveredLanes`'s. Measured on it: severing `honestyAtClose` — the
// preset this gate exists to run, over all 216 records — left the gate printing
// `✓ every done-item reconciled` at exit 0 while the receipt attested 216
// examined. Of the nine checks the two rewritten gates covered, one reddened
// when its own check died. `scripts/release-gate.mjs` states the rule that
// broke, in this repo's own words: a denominator sourced from anywhere but the
// rule attests a check that may not have run, which is worse than no
// denominator at all.
//
// So each member below carries the count the check itself reached its assertion
// over: `honestyAtClose` already returns a `CollectResult` (it ends in
// `finishPreset(mergeCollectResults([…]))`), and `findUncoveredLanes`,
// `findLaneDoneVacuity` and `findFinishedNotClosed` each report their own.
// `mergeCollectResults` is fail-closed per member, so a check that goes quiet is
// named rather than absorbed by the others.
const receipt = mergeCollectResults([
  // One member per lane, not one for all three: a corruption scoped to a single
  // lane is invisible in a sum as long as another lane still scans — bug 0131's
  // round-3 finding, applied to the evidence rather than to the done-count.
  ...scans.map((s) => s.violations),
  uncoveredLaneViolations,
  laneDoneVacuousViolations,
  collectResult(finishedNotClosedViolations, { examined: finishedNotClosed.examined }),
])

const violations = [
  ...scans.flatMap((s) => s.violations),
  ...uncoveredLaneViolations,
  ...laneDoneVacuousViolations,
  ...finishedNotClosedViolations,
]
const scanned = scans.reduce((n, s) => n + s.stats.scanned, 0)
const doneCount = scans.reduce((n, s) => n + s.stats.doneItems, 0)
const readable = scans.reduce((n, s) => n + s.stats.withReadableState, 0)

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  // ADR-008: the machine-readable path emits, because that is what it is for.
  // The gate runs first, so an evidence-free member reaches the consumer as a
  // finding rather than as a silent zero. `reportViolations` escalates an
  // unsuppressable emitter finding to a throw, so the exit below is reached only
  // when there is nothing to escalate — caught here rather than left to surface
  // as a bare stack trace in a CI log.
  const emitted = finishPreset(receipt, { report: 'return' })
  try {
    reportViolations(emitted, { format })
  } catch {
    process.exit(1)
  }
  process.exit(emitted.length > 0 ? 1 : 0)
}

const repoRoot = process.cwd()
const relTo = (file) =>
  file.startsWith(repoRoot) ? file.slice(repoRoot.length).replace(/^[/\\]/, '') : file
const line = (label, detail) => console.error(`  ${label.padEnd(11)}${detail}`)

console.error('')
console.error('check:ledger · honesty at close')
for (const sc of scans) {
  // A lane with no terminalStates AND no done-folders can never have a done-item —
  // as of plan 0216 no lane here is that shape, so this branch is dead in this
  // repo and kept for the kit's copiers, who may still declare one.
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

// The same receipt the machine-readable path used, so the two exits cannot
// disagree about what was examined. ADR-008: this script owns its reporting on
// the terminal path, so the gate runs under `report: 'return'` here.
const verdict = finishPreset(receipt, { report: 'return' })
// `verdict` carries every member's violations as well as the gate's own, so an
// `emitter/*` id arriving from INSIDE a member (honestyAtClose runs its own
// emitter) would be counted twice — once in `violations`, once here. Subtract
// what the gate already knows about rather than filtering the whole verdict.
const known = new Set(violations)
const emitterFindings = verdict.filter(
  (v) => !known.has(v) && typeof v.ruleId === 'string' && v.ruleId.startsWith('emitter/'),
)
// A per-check ✓ above a red verdict is the summary contradicting itself, which
// is the same argument this file already applies to the count below. When
// evidence is missing, no line may claim its check passed.
const evidenceOk = emitterFindings.length === 0

if (violations.length > 0) {
  line('findings', `✗ ${violations.length}`)
  console.error('')
  for (const vv of violations)
    console.error(
      `    ${relTo(vv.file)}:${vv.line}  ${vv.rule}\n      ${vv.message.split('\n')[0]}`,
    )
} else if (evidenceOk) {
  line('findings', '✓ every done-item reconciled')
} else {
  line('findings', '— no findings, but this run carries no evidence (see below)')
}

if (emitterFindings.length > 0) {
  console.error('')
  console.error('  evidence:')
  for (const v of emitterFindings) console.error(`    ${v.ruleId ?? ''}  ${v.message}`)
  // The kernel's remedy names `expectEmpty: true` and `.expectEmpty()`, which
  // are a preset's and a builder's escapes. Neither exists on this path, so the
  // gate says what its own remedy is rather than sending a reader to look for a
  // preset that is not here (ADR-009 rule 2).
  console.error(
    '    → in this gate that means one of its evidence members examined nothing: ' +
      `fix the check that stopped examining, or pass declaredEmpty: true to that member's collectResult.`,
  )
}

console.error('')
if (violations.length === 0 && evidenceOk) {
  console.error(
    `  ✓ honesty at close — ${doneCount} done-items across ${scanned} records ` +
      `(${scans.map((sc) => `${sc.stats.scanned} ${sc.lane.name}`).join(' + ')}), ` +
      `${readable} with a readable State, ${finishedNotClosed.examined} of them still open ` +
      `(checked for finished-but-open), 0 findings (${elapsed()})`,
  )
} else {
  // Emitter findings count toward the number, or the line reads `0 finding(s)`
  // beside a red exit — the summary contradicting the verdict.
  const n = violations.length + emitterFindings.length
  console.error(
    `  ✗ honesty at close — ${n} finding(s) across ${doneCount} done-items (${elapsed()})`,
  )
}
console.error('')

if (violations.length > 0 || emitterFindings.length > 0) process.exit(1)
