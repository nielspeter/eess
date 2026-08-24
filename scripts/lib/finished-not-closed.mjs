/**
 * The reverse of honesty-at-close: a record whose ledger is fully ticked but
 * whose State is still open.
 *
 * `honestyAtClose` enforces one direction — a DONE item carries no silently-open
 * box. Nothing enforced the other, and the asymmetry is where finished work goes
 * to sit. Measured when this was written: `work/bugs/0170` and `0171` each had
 * every box ticked, none open, `State: Draft — fix built and measured; ready to
 * close`, and the named symbols present in the code — open since 2026-08-19 with
 * `check:ledger` green over them every day since.
 *
 * **This file re-derived the scan in its first version, and review took it apart.**
 * Hand-rolled regexes over `readFileSync` text got four shapes wrong that the
 * shipped preset gets right, and the neighbouring `lane-coverage.mjs` already
 * said why not to: *"Re-deriving the scan (fenced-code stripping, the
 * preamble+first-section boundary bug 0119 fixed) is exactly what put a wrong
 * denominator in this gate's own summary before … This calls the one correct
 * implementation instead of copying it."* The measured cost of ignoring that:
 *
 *   - `- **State**: Draft` (label form)      → silently skipped
 *   - `Won’t-do` (typographic apostrophe)    → fired, reporting `State is "Won"`
 *   - `- [x]` inside a ```` ``` ```` fence   → counted as a real ledger box, so a
 *                                              record with no ledger at all could
 *                                              red the build and be told to close
 *                                              work that had not started
 *   - a fenced `**State:**` example above the real header → read the example
 *
 * So it reads the corpus now: `collectTaskItems` (mdast, so fenced and
 * blockquoted boxes are excluded for free) and the preset's own `findState` (the
 * preamble+first-section region, fences stripped, apostrophe glyphs canonical).
 * One reader, so the gate cannot assert a record has a readable State in its
 * summary and skip it in this rule — which is exactly what it did.
 *
 * Returns `{ violations, examined }` rather than a bare array. The first version
 * returned only violations, and review demonstrated the consequence: break the
 * scan root and it examined nothing, found nothing, and `check:ledger` printed a
 * confident green quoting 170 records — a denominator from `ledgerStats`, a
 * different derivation this rule never touches. A pass constructed from a default
 * (ADR-010), inside the gate family written to refuse them.
 *
 * Deliberately narrow, because the false positive costs more than the miss: a
 * record with NO boxes claims nothing and is skipped, a record with any open box
 * is in progress, and only "has a ledger, every box ticked, still open" fires.
 *
 * ## Why this lives here, and what would move it
 *
 * `scripts/lib/` is step 1 of [ADR-006]'s graduation path — *"write rules in the
 * consuming project"* — and this repo is that project. `lane-coverage.mjs` next
 * door is the same shape. Step 2 is *"if a rule is general enough → extract to
 * the framework package"*, which here means a fifth finding inside
 * `honestyAtClose` (`packages/md/src/rules/ledger.ts`). That costs no new export:
 * every input it needs — `terminalStates`, `doneFolders`, `states` — is already
 * on `HonestyAtCloseOptions`, and a rule id is not an exported symbol. The
 * portable kit ships `honestyAtClose`, so a working-method property enforced only
 * here is a property the kit does not ship. The argument for promotion is good.
 *
 * **It is not promoted yet, on purpose, and step 3 is the reason:** *"never add a
 * rule to a framework package without real-world validation."* As of 2026-08-24
 * this rule is hours old, its first implementation was wrong in four ways that
 * review had to find, and its evidence is two records in one repo on one day —
 * both of which were already known before it existed. Promoting it into a preset
 * adopters already run, where it would newly red their builds, is exactly what
 * step 3 forbids. Citing ADR-006 to justify skipping ADR-006 is the shape to
 * avoid.
 *
 * **Promote when either is true**, and not before:
 *
 *   1. it catches a finished-but-open record nobody had already noticed — i.e. it
 *      finds something it was not written for; or
 *   2. it survives a release cycle in this repo with no false positive.
 *
 * Neither needs tracking overhead. Whoever meets one of them should move it, and
 * should also reconsider whether it belongs as a finding inside `honestyAtClose`
 * or as its own preset — a new finding from an existing preset changes behaviour
 * silently for everyone who runs it, which is a changeset-worthy decision either
 * way.
 *
 * [ADR-006]: ../../adr/006-framework-rules-architecture.md
 */
import { corpus } from '@nielspeter/eess-md'
import { collectTaskItems } from '@nielspeter/eess-md'
import { findState } from '@nielspeter/eess-md/rules/ledger'

export const FINISHED_NOT_CLOSED_RULE = 'ledger/finished-not-closed'
export const FINISHED_NOT_CLOSED_VACUOUS_RULE = 'ledger/finished-not-closed-examined-nothing'

/**
 * @param {Array<{roots: readonly string[], doneFolders?: readonly string[], states?: readonly string[], terminalStates: readonly string[], cwd?: string}>} lanes
 * @returns {{violations: object[], examined: number}}
 */
export function findFinishedNotClosed(lanes) {
  const violations = []
  let examined = 0

  for (const lane of lanes) {
    const vocabulary = [...(lane.states ?? []), ...lane.terminalStates]
    const c = corpus({ roots: [...lane.roots], ...(lane.cwd ? { cwd: lane.cwd } : {}) })
    const docs = c.documents()
    let laneExamined = 0

    for (const doc of docs) {
      // A record in a done-folder is closed by placement, whatever its header
      // says — `honestyAtClose`'s `state-folder-mismatch` owns that disagreement.
      const inDoneFolder = (lane.doneFolders ?? []).some((f) => doc.relPath.includes(`/${f}/`))
      if (inDoneFolder) continue

      const found = findState(doc.text, vocabulary)
      // No State at all, or one outside the vocabulary: `ledger/unknown-state`
      // owns that, and guessing here would be a second opinion on the same text.
      if (found?.state === undefined) continue
      if (lane.terminalStates.includes(found.state)) continue

      laneExamined += 1
      const boxes = collectTaskItems(doc.root)
      if (boxes.length === 0) continue
      const open = boxes.filter((b) => !b.checked)
      if (open.length > 0) continue

      violations.push({
        rule: FINISHED_NOT_CLOSED_RULE,
        element: doc.relPath,
        file: doc.file,
        line: found.line,
        message:
          `every one of this record's ${boxes.length} ledger box(es) is ticked and none is ` +
          `open, but State is "${found.state}" — so the board counts finished work as outstanding.`,
        because:
          'the board is what a reader uses to decide what is left, and a record that is ' +
          'done but open makes the backlog larger than the work',
        suggestion:
          `Close it — set a terminal State (${lane.terminalStates.join(' / ')}) and move it ` +
          `to the lane's done-folder — or, if something IS still owed, write that box down. ` +
          `A ledger with nothing open is a claim that nothing is.`,
      })
    }

    // The vacuity guard the first version lacked. A lane that declares a real
    // state vocabulary and yields no open records has either finished everything
    // or lost its selector, and those must not print the same line.
    // `docs.length === 0` is NOT excused. A lane whose corpus loaded nothing is a
    // broken selector, and it was the first thing to go wrong when this probe was
    // pointed at an absolute path — it examined nothing and said nothing, which is
    // the silent zero this guard exists for.
    if (laneExamined === 0) {
      violations.push({
        rule: FINISHED_NOT_CLOSED_VACUOUS_RULE,
        element: lane.roots[0] ?? '(no root)',
        file: lane.roots[0] ?? '(no root)',
        line: 1,
        message:
          docs.length === 0
            ? `${lane.roots[0]} loaded NO documents at all, so ledger/finished-not-closed ` +
              `examined nothing in this lane — the selector is wrong, not the corpus empty.`
            : `${lane.roots[0]} loaded ${docs.length} document(s) and none of them was an ` +
              `OPEN record, so ledger/finished-not-closed examined nothing in this lane.`,
        because:
          'a rule that examined nothing cannot fail, and reporting that as a pass is a ' +
          'verdict built from a default rather than from evidence (ADR-010)',
        suggestion:
          'If the lane really has no open records, say so. Otherwise the selector or the ' +
          'state vocabulary is wrong — check `roots`, `doneFolders` and `states`.',
        bypassFilters: true,
      })
    }
    examined += laneExamined
  }
  return { violations, examined }
}
