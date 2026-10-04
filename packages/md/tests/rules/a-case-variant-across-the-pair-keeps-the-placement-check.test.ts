import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { corpus } from '../../src/index.js'
import { honestyAtClose, ledgerStats } from '../../src/rules/ledger.js'

/**
 * Bug 0379 — the placement check read a record's state against `states` + `terminalStates`
 * together, took the first spelling that matched (case-insensitively), and then asked whether
 * that spelling was terminal, case-sensitively. With `done` in `states` and `Done` in
 * `terminalStates`, a closed record read as `done`, was not terminal, and lost its finding —
 * while `isDoneItem`, which reads against the terminal set alone, disagreed. In a done-folder
 * the same pair gave a false red instead.
 */
function placement(folder: string, states: string[]): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-0379-'))
  mkdirSync(join(dir, folder), { recursive: true })
  writeFileSync(
    join(dir, folder, '0001-a.md'),
    '# 0001\n\n- **State:** Done — closed\n\n- [x] ok\n\nDeferred: none.\n',
  )
  const c = corpus({ roots: ['work/**/*.md'], cwd: dir })
  return honestyAtClose(c, { states, terminalStates: ['Done'], report: 'return' })
    .filter((v) => v.rule === 'ledger/state-folder-mismatch')
    .map((v) => v.message)
}

describe('bug 0379: a case variant across the vocabulary pair keeps the placement check', () => {
  it('a closed record outside a done-folder is reported, whichever list spells it in lower case', () => {
    // Control: the same spelling in both lists — the finding the variant used to lose.
    expect(placement('work/plans', ['Draft', 'Done'])).toHaveLength(1)
    expect(placement('work/plans', ['Draft', 'done'])).toHaveLength(1)
  })

  it('a closed record inside a done-folder is not a false red under the variant', () => {
    expect(placement('work/plans/completed', ['Draft', 'Done'])).toEqual([])
    expect(placement('work/plans/completed', ['Draft', 'done'])).toEqual([])
  })

  it('a declared multi-word state that begins with a terminal token is not read as that token', () => {
    // Found by review of the first fix, which read the state against `terminalStates` alone:
    // the matcher accepts prose after a token, so `Done pending review` read as `Done`. In a
    // done-folder the mismatch vanished; in an active lane it became a false orphaned close,
    // and the record's open box was checked as if it were closed.
    const run = (folder: string) => {
      const dir = mkdtempSync(join(tmpdir(), 'ledger-0379-multi-'))
      mkdirSync(join(dir, folder), { recursive: true })
      writeFileSync(
        join(dir, folder, '0001-a.md'),
        '# 0001\n\n- **State:** Done pending review — open\n\n- [ ] still to do\n',
      )
      const c = corpus({ roots: ['work/**/*.md'], cwd: dir })
      const vocabulary = { states: ['Draft', 'Done pending review'], terminalStates: ['Done'] }
      return {
        findings: honestyAtClose(c, { ...vocabulary, closeInPlace: false, report: 'return' }).map(
          (v) => `${v.rule}: ${v.message}`,
        ),
        // The denominator must agree with the checks: the active-lane record is not done.
        doneItems: ledgerStats(c, vocabulary).doneItems,
      }
    }
    // In a done-folder: an open record filed as done is reported.
    expect(
      run('work/plans/completed').findings.some((m) => m.includes('filed in a done-folder')),
    ).toBe(true)
    // In an active lane: no placement finding, and its open box is not a closed record's.
    expect(run('work/plans')).toEqual({ findings: [], doneItems: 0 })
  })
})
