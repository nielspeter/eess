/**
 * The reverse of honesty-at-close: a record whose ledger is fully ticked but
 * whose State is still open.
 *
 * `honestyAtClose` enforces one direction — a DONE item carries no silently-open
 * box. Nothing enforced the other, and the asymmetry is where finished work goes
 * to sit. Measured when this was written: `work/bugs/0171-*.md` had six ticked
 * boxes, zero open, `State: Draft — fix built and measured; ready to close`, and
 * the named tests and symbols all present in the code — open since 2026-08-19,
 * with `check:ledger` green on it every day since. Three more (0156, 0157, 0161)
 * were found by hand the same week.
 *
 * That matters beyond tidiness. The board is what a reader — increasingly an
 * agent — uses to decide what is left, and a backlog that counts finished work
 * as outstanding is a measurement nobody can act on. It is the same missing
 * direction the non-vacuity harness had between `validate` and CI: one way swept,
 * the other way is where things hid.
 *
 * Deliberately narrow, because the false-positive costs more than the miss here:
 * a record with NO boxes claims nothing and is skipped, and a record with any
 * open box is in progress. Only "every box ticked, still open" fires.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const FINISHED_NOT_CLOSED_RULE = 'ledger/finished-not-closed'

const TICKED = /^\s*[-*]\s+\[x\]/gim
const OPEN = /^\s*[-*]\s+\[ \]/gim
const STATE = /\*\*State:\*\*\s*([A-Za-z'-]+)/

function mdFilesIn(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) continue // done-folders are the point; do not recurse
    if (e.isFile() && /^\d{3,4}-.*\.md$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * @param {Array<{dir: string, terminalStates: readonly string[]}>} lanes
 * @returns {Array<object>} violations, one per finished-but-open record
 */
export function findFinishedNotClosed(lanes) {
  const violations = []
  for (const lane of lanes) {
    for (const file of mdFilesIn(lane.dir)) {
      let text
      try {
        text = readFileSync(file, 'utf8')
        statSync(file)
      } catch {
        continue
      }
      const state = STATE.exec(text)?.[1]
      if (state === undefined) continue // unreadable state is another rule's finding
      if (lane.terminalStates.includes(state)) continue // already closed
      const ticked = (text.match(TICKED) ?? []).length
      const open = (text.match(OPEN) ?? []).length
      if (ticked === 0 || open > 0) continue
      violations.push({
        rule: FINISHED_NOT_CLOSED_RULE,
        element: file,
        file: resolve(file),
        line: 1,
        message:
          `every one of this record's ${ticked} ledger box(es) is ticked and none is open, ` +
          `but State is "${state}" — so the board counts finished work as outstanding.`,
        because:
          'the board is what a reader uses to decide what is left, and a record that is ' +
          'done but open makes the backlog larger than the work',
        suggestion:
          `Close it — set a terminal State (${lane.terminalStates.join(' / ')}) and move it ` +
          `to the lane's done-folder — or, if something IS still owed, write that box down. ` +
          `A ledger with nothing open is a claim that nothing is.`,
      })
    }
  }
  return violations
}
