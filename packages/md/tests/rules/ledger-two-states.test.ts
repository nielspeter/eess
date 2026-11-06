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

  it('Done then Draft: reported the same way; the box check still reads the first line', () => {
    // The state/folder check reports the conflict before reading either line. The box check reads
    // the first (`isDoneItem`), so here, unlike Draft then Done, the open box is reported too.
    expect(found(record('Done', 'Draft'))).toEqual([
      'ledger/silent-open-box@8: unchecked box with no disposition (done-otherwise / deferred→<home> / dropped-on-purpose / validation-owed)',
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

  it("a case or apostrophe variant agrees: done and Done, Won’t-do and Won't-do", () => {
    expect(found(record('done', 'Done')).map((f) => f.split('@')[0])).toEqual([
      'ledger/silent-open-box',
      'ledger/state-folder-mismatch',
    ])
    const closed = [
      '# Plan 9',
      '',
      "**State:** Won't-do",
      '**State:** Won’t-do',
      '',
      '- [x] done',
      '',
    ]
    expect(
      honestyAtClose(corpusFromText({ 'work/plans/completed/0009-x.md': closed.join('\n') }), {
        report: 'return',
      }).map((v) => v.rule),
    ).toEqual([])
  })

  it('a second line outside the vocabulary is a disagreement, not an unknown state', () => {
    expect(found(record('Draft', 'Shipped'))).toEqual([
      `${DISAGREE}@4: State is given twice (line 3 'Draft', line 4 'Shipped'); keep one. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it("a heading-form state is compared too, under the caller's label", () => {
    const text = ['# Plan 9', '', '**Status:** Draft', '', '## Status: Done', '', '- [ ] a box', '']
    expect(
      honestyAtClose(corpusFromText({ 'work/plans/0009-x.md': text.join('\n') }), {
        report: 'return',
        label: 'Status',
      }).map((v) => `${v.rule}@${String(v.line)}`),
    ).toEqual([`${DISAGREE}@5`])
  })

  it('a prose line opening with the label is named in the remedy, and rewording it clears it', () => {
    const text = (line: string) =>
      ['# Plan 9', '', '**State:** Draft', '', '## Problem', '', line, '', '- [ ] a box', ''].join(
        '\n',
      )
    const [hit] = honestyAtClose(
      corpusFromText({ 'work/plans/0009-x.md': text('State: kept in Redis') }),
      {
        report: 'return',
      },
    )
    expect([hit?.rule, hit?.suggestion]).toEqual([
      DISAGREE,
      "If line 7 is not this record's state, reword it so it does not open with `State:`; otherwise keep the one state the record means.",
    ])
    expect(
      honestyAtClose(
        corpusFromText({ 'work/plans/0009-x.md': text('The state is kept in Redis') }),
        {
          report: 'return',
        },
      ).map((v) => v.rule),
    ).toEqual([])
  })

  it('control: one Draft and an open box is not a finding', () => {
    expect(found(record('Draft'))).toEqual([])
  })
})
