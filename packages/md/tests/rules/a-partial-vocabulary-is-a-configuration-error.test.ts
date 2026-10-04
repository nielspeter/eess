import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isArchConfigError } from '@nielspeter/eess'
import { corpus } from '../../src/index.js'
import { honestyAtClose, ledgerStats } from '../../src/rules/ledger.js'

/**
 * Bug 0284 — `states` and `terminalStates` defaulted independently, so passing one without
 * the other left a token the author treats as closing outside the terminal set. The record
 * was never classified done and every close check selected nothing — a green build on a
 * record with an undisposed box.
 *
 * The corpus is the record's mixed one: a victim closed by a token its author declared, with
 * an open box, BESIDE an ordinary correctly closed record. That second record is what makes a
 * lane-wide "zero done-items" guard silent, so a fix that only shipped that guard would not
 * pass here.
 */
function mixedCorpus() {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-0284-'))
  mkdirSync(join(dir, 'work/proposals/promoted'), { recursive: true })
  mkdirSync(join(dir, 'work/proposals/completed'), { recursive: true })
  writeFileSync(
    join(dir, 'work/proposals/promoted/0001-p.md'),
    '# 0001\n\n- **State:** Promoted — owned by plan 0002\n\n## Verify\n\n- [ ] undisposed box on a closed record\n',
  )
  writeFileSync(
    join(dir, 'work/proposals/completed/0002-q.md'),
    '# 0002\n\n- **State:** Done — closed\n\n## Verify\n\n- [x] ticked\n\nDeferred: none.\n',
  )
  return corpus({ roots: ['work/**/*.md'], cwd: dir })
}

const DEFAULTS_PLUS_PROMOTED = ['Draft', 'Ready', 'Open', 'Done', "Won't-do", 'Promoted']

function configErrorOf(run: () => unknown): Error {
  try {
    run()
  } catch (err) {
    if (err instanceof Error && isArchConfigError(err)) return err
    throw err
  }
  throw new Error('expected an ArchConfigError, and the call returned normally')
}

describe('bug 0284: states and terminalStates are declared together or not at all', () => {
  it('states without terminalStates is a configuration error naming both options', () => {
    const err = configErrorOf(() =>
      honestyAtClose(mixedCorpus(), { states: DEFAULTS_PLUS_PROMOTED, report: 'return' }),
    )
    expect(err.message).toContain('`states`')
    expect(err.message).toContain('`terminalStates`')
  })

  it('terminalStates without states is a configuration error too', () => {
    // The mirror: with the default states, Done stays a known state that no longer closes.
    const err = configErrorOf(() =>
      honestyAtClose(mixedCorpus(), { terminalStates: ['Promoted'], report: 'return' }),
    )
    expect(err.message).toContain('`states`')
    expect(err.message).toContain('`terminalStates`')
  })

  it('ledgerStats refuses the same partial pair, so the denominator cannot disagree', () => {
    configErrorOf(() => ledgerStats(mixedCorpus(), { states: DEFAULTS_PLUS_PROMOTED }))
  })

  it('the remedy the error names is corrective: the victim is classified done and its box reports', () => {
    const c = mixedCorpus()
    const findings = honestyAtClose(c, {
      states: DEFAULTS_PLUS_PROMOTED,
      terminalStates: ['Done', "Won't-do", 'Promoted'],
      report: 'return',
    })
    expect(
      findings
        .filter((v) => v.rule === 'ledger/silent-open-box')
        .map((v) => v.file.replace(/^.*work\//, 'work/')),
    ).toEqual(['work/proposals/promoted/0001-p.md'])
    expect(
      ledgerStats(c, {
        states: DEFAULTS_PLUS_PROMOTED,
        terminalStates: ['Done', "Won't-do", 'Promoted'],
      }).doneItems,
    ).toBe(2)
  })

  it('neither option, both options, and an empty terminal set stay accepted', () => {
    const c = mixedCorpus()
    expect(() => honestyAtClose(c, { report: 'return' })).not.toThrow()
    expect(() =>
      honestyAtClose(c, { states: ['Draft'], terminalStates: ['Done'], report: 'return' }),
    ).not.toThrow()
    // A lane where nothing is ledger-closed by design (bug 0121) declares both, one empty.
    expect(() =>
      honestyAtClose(c, { states: DEFAULTS_PLUS_PROMOTED, terminalStates: [], report: 'return' }),
    ).not.toThrow()
  })
})
