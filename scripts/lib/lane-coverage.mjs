/**
 * Bug 0121 — `check-ledger.mjs`'s `LANES` table is hand-maintained, and the gate
 * reports what it *did* scan without reporting what it did **not** open. A new
 * `work/` subdirectory can carry `**State:**`-shaped records and go unscanned
 * silently, the same class of blindness bug 0118 fixed one lane over.
 *
 * `findUncoveredLanes` is the reverse check: every top-level directory under
 * `workRoot` not named in `claimedTopSegments` is fine **if** it carries no
 * `State:`-shaped records (e.g. `work/spikes/`, records-free today) and a
 * violation if it does.
 *
 * Reuses `ledgerStats`'s own label/region scanning rather than re-deriving it —
 * passing an empty `states` vocabulary means nothing is recognised, so every
 * genuine `State:`-shaped line falls into `unreadableState` (never
 * `withReadableState`, since bug 0121's `ledger.ts` fix made `stateMatcher([])`
 * a guaranteed non-match rather than an accidental zero-width one), and
 * `withReadableState + unreadableState > 0` means "this directory has
 * state-shaped records," independent of what value they carry. Re-deriving the
 * scan (fenced-code stripping, the preamble+first-section boundary bug 0119
 * fixed) is exactly what put a wrong denominator in this gate's own summary
 * before — `ledgerStats`'s own docstring names that lesson. This calls the one
 * correct implementation instead of copying it.
 *
 * Uses `ledgerStats`'s default `boardFiles` (README.md and friends), not each
 * candidate directory's own — deliberately: the safe failure direction for an
 * unknown directory is to over-trigger this human-judgment finding on an
 * illustrative `**State:**` example in some board doc, not to stay silently
 * blind the way the bug itself was.
 *
 * Known limitation, inherited rather than introduced: a symlinked `work/`
 * subdirectory is invisible to this check. Not fixable here — `corpus()`'s own
 * `walk()` (`packages/md/src/corpus.ts`) treats a symlink Dirent as neither a
 * directory nor a file and never descends into it, so even a `readdirSync`
 * check here that correctly identified the symlink couldn't make its contents
 * visible; the fix belongs in `corpus()` itself (symlink-following needs cycle
 * protection and is a bigger, cross-cutting change than this bug's scope).
 */
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { corpus } from '@nielspeter/eess-md'
import { ledgerStats } from '@nielspeter/eess-md/rules/ledger'

export const UNCOVERED_LANE_RULE = 'ledger/uncovered-lane'

/**
 * @param {string} workRoot - repo-relative root to enumerate subdirectories of
 * @param {ReadonlySet<string>} claimedTopSegments - directory names already
 *   scanned by a declared `LANES` entry
 * @returns {import('@nielspeter/eess').ArchViolation[]}
 */
export function findUncoveredLanes(workRoot, claimedTopSegments) {
  let entries
  try {
    entries = readdirSync(workRoot, { withFileTypes: true })
  } catch {
    return [] // workRoot doesn't exist — nothing to enumerate
  }

  const violations = []
  for (const entry of entries) {
    if (!entry.isDirectory() || claimedTopSegments.has(entry.name)) continue
    const dirRel = `${workRoot}/${entry.name}`
    const c = corpus({ roots: [`${dirRel}/**`] })
    const stats = ledgerStats(c, { states: [], terminalStates: [] })
    const records = stats.withReadableState + stats.unreadableState
    if (records === 0) continue
    violations.push({
      rule: UNCOVERED_LANE_RULE,
      element: dirRel,
      file: resolve(dirRel),
      line: 1,
      message:
        `${dirRel}/** carries ${records} State:-shaped record(s) but no LANES entry in ` +
        `check-ledger.mjs scans it — the per-lane summary would omit it silently.`,
      because:
        'a lane the gate does not know about is unread, and the per-lane summary looks ' +
        'exhaustive precisely because it is itemised (bug 0121)',
    })
  }
  return violations
}

export const LANE_DONE_VACUOUS_RULE = 'ledger/lane-done-vacuous'

/**
 * Bug 0131 round 3 — every peek and every real selection `honestyAtClose`
 * runs for a lane shares that lane's own `isDoneItem` determination. A
 * corruption scoped to one lane (a `doneFolders`/`terminalStates` config
 * typo, a selector break) zeroes every finding that lane could ever produce,
 * with no other trace — and the first version of this check summed
 * done-items across ALL declared lanes before comparing to zero, so a lane
 * this narrow stayed completely invisible as long as some OTHER lane still
 * had a nonzero count. This checks each lane independently instead.
 *
 * A lane with `terminalStates: []` and no done-folders is structurally exempt
 * — `isDoneItem` reduces to `[].includes(x)`, always `false`, by design, not
 * corruption. `expectEmptyDone: true` is the caller-declared, non-inferrable
 * escape hatch for a lane that may legitimately have zero done-items right
 * now — a freshly-bootstrapped `kit/`-seeded lane before its first item
 * closes — mirroring `honestyAtClose`'s own `expectEmptyHeaders`. Neither of
 * this repo's own three lanes needs it today — `proposals` was the standing
 * example until plan 0216 gave it `Promoted`/`Rejected`; a lane copying this file into a
 * new project should set it until its own history exists.
 *
 * @param {ReadonlyArray<{name: string, terminalStates: readonly string[], doneItems: number, expectEmptyDone?: boolean}>} lanes
 * @returns {import('@nielspeter/eess').ArchViolation[]}
 */
export function findLaneDoneVacuity(lanes) {
  const violations = []
  for (const lane of lanes) {
    if (lane.terminalStates.length === 0) continue
    if (lane.doneItems > 0) continue
    if (lane.expectEmptyDone === true) continue
    violations.push({
      rule: LANE_DONE_VACUOUS_RULE,
      element: lane.name,
      file: '',
      line: 0,
      message:
        `lane "${lane.name}" scanned zero done-items, but declares a real terminalStates ` +
        `vocabulary (${lane.terminalStates.join(', ')}) — every predicate and peek ` +
        `honestyAtClose runs for this lane shares the same done/state determination, so this ` +
        `is either a genuinely fresh lane (declare it with expectEmptyDone: true in its LANES ` +
        `entry, and remove that once it has real content) or a corrupted selector/` +
        `doneFolders/terminalStates config silently excluding every item in this lane.`,
      because:
        'a corruption of the shared done/state determination scoped to one lane produces zero ' +
        'violations from every rule in that lane, with no other trace',
      bypassFilters: true,
    })
  }
  return violations
}
