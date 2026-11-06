import { describe, it, expect } from 'vitest'
import { corpusFromText } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'

// Bug 0623: the ledger judged a record by the first of two `State:` lines, so a live plan holding
// `State: Draft` then `State: Done` and an open box passed, while the reverse order reddened.

const record = (...states: readonly string[]): string =>
  [
    '# Plan 9',
    '',
    ...states.map((s) => `**State:** ${s}`),
    '',
    '## Tasks',
    '',
    '- [ ] an open box',
    '',
  ].join('\n')

const found = (text: string): string[] =>
  honestyAtClose(corpusFromText({ 'work/plans/0009-x.md': text }), { report: 'return' })
    .map((v) => `${v.rule}@${String(v.line)}: ${v.message}`)
    .sort()

const DISAGREE = 'ledger/states-disagree'

describe('two states that disagree are a finding, never the first of them (bug 0623)', () => {
  it('Draft then Done: the record says it is done too, so it is reported', () => {
    expect(found(record('Draft', 'Done'))).toEqual([
      `${DISAGREE}@4: State is given twice (line 3 'Draft', line 4 'Done'); keep one. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it('Done then Draft: reported the same way, whichever comes first', () => {
    expect(found(record('Done', 'Draft')).filter((f) => f.startsWith(DISAGREE))).toEqual([
      `${DISAGREE}@4: State is given twice (line 3 'Done', line 4 'Draft'); keep one. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it('three lines name each, at the first that disagrees', () => {
    expect(found(record('Draft', 'Draft', 'Done')).filter((f) => f.startsWith(DISAGREE))).toEqual([
      `${DISAGREE}@5: State is given 3 times (line 3 'Draft', line 4 'Draft', line 5 'Done'); keep one. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it('Done twice agrees, so it reads as Done, as before', () => {
    expect(found(record('Done', 'Done')).map((f) => f.split('@')[0])).toEqual([
      'ledger/silent-open-box',
      'ledger/state-folder-mismatch',
    ])
  })

  it('control: one Draft and an open box is not a finding', () => {
    expect(found(record('Draft'))).toEqual([])
  })
})
