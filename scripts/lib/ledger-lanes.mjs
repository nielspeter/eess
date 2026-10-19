/**
 * The ledger's lanes and their state vocabularies: one list, read by `check:ledger` and by
 * `check:corpus`'s State rule (plan 0468), so the two gates cannot disagree about a lane's words.
 */
import { PROPOSAL_DONE_FOLDERS } from './proposal-ruling.mjs'

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
export const LANES = [
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
    // Plan 0454: this lane writes `[~]` for a box that is half done; it blocks a close like `[ ]`.
    // Declared per lane, since each lane builds its own corpus: merging lanes must carry it.
    marks: { '~': 'open' },
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

/**
 * The documents under `work/` that no lane reads, on purpose (plan 0481): the spike lane, whose
 * dated reports carry no `State:` (`findUncoveredLanes` checks that they still carry none), and
 * the notes at `work/`'s top level. With `LANES`, these are every selection a document under
 * `work/` may belong to; `check:ledger` requires each document in exactly one.
 */
export const UNLANED = [
  { name: 'spikes', glob: 'work/spikes/**' },
  { name: 'work notes', glob: 'work/*.md' },
]
