import { describe, it, expect } from 'vitest'
import { corpusFromText } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'

// Bug 0627: a record whose state line was read was never checked for a state word written under
// another label, so a live plan holding `**State:** Draft` and `## Status: Done` with an open box
// passed. Without the `State:` line the heading is reported (bug 0444, bug 0476); beside one, a
// state word that disagrees is now a disagreement, as two `State:` lines are since bug 0623.

const record = (...header: readonly string[]): string =>
  ['# Plan 9', '', ...header, '', '## Tasks', '', '- [ ] an open box', ''].join('\n')

const found = (text: string, path = 'work/plans/0009-x.md'): string[] =>
  honestyAtClose(corpusFromText({ [path]: text }), { report: 'return' })
    .map((v) => `${v.rule}@${String(v.line)}: ${v.message}`)
    .sort()

const DISAGREE = 'ledger/states-disagree'

describe('a state word under another label beside the read state (bug 0627)', () => {
  it('State: Draft beside ## Status: Done is reported, naming both lines', () => {
    expect(found(record('**State:** Draft', '', '## Status: Done'))).toEqual([
      `${DISAGREE}@5: State is 'Draft' (line 3), but the header's \`Status:\` holds 'Done' (line 5), a state from the vocabulary. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it('the wrapped form under another label is reported the same way', () => {
    expect(found(record('**State:** Draft', '**Status:** Done'))).toEqual([
      `${DISAGREE}@4: State is 'Draft' (line 3), but the header's \`Status:\` holds 'Done' (line 4), a state from the vocabulary. A record whose state disagrees with itself cannot be placed.`,
    ])
  })

  it('the remedy says how to keep each meaning', () => {
    const [v] = honestyAtClose(
      corpusFromText({ 'work/plans/0009-x.md': record('**State:** Draft', '**Status:** Done') }),
      { report: 'return' },
    )
    expect(v?.suggestion).toBe(
      "If `Status:` is this record's state, keep one of the two lines (pass aliases: ['Status'] to read it); if it is not, reword line 4 so its value is not a state word.",
    )
  })

  it('a later disagreeing line is found past an agreeing one', () => {
    expect(
      found(record('**State:** Draft', '**Status:** Draft', '**Phase:** Done')).map(
        (f) => f.split(': ')[0],
      ),
    ).toEqual([`${DISAGREE}@5`])
  })

  it('State: Done beside ## Status: Done agrees, so it reads as Done, as before', () => {
    expect(
      found(record('**State:** Done', '', '## Status: Done')).map((f) => f.split('@')[0]),
    ).toEqual(['ledger/silent-open-box', 'ledger/state-folder-mismatch'])
  })

  it('a case variant agrees: done beside Done', () => {
    expect(
      found(record('**State:** Done', '**Status:** done')).map((f) => f.split('@')[0]),
    ).toEqual(['ledger/silent-open-box', 'ledger/state-folder-mismatch'])
  })

  it('a Status: value that is no state word is not a state, so nothing is reported', () => {
    expect(found(record('**State:** Draft', '**Status:** waiting on review'))).toEqual([])
    expect(found(record('**State:** Draft', '', '## Status: Open questions'))).toEqual([])
  })

  it('a state word under another label after the header is prose, as before', () => {
    const text = [
      '# Plan 9',
      '',
      '**State:** Draft',
      '',
      '## Tasks',
      '',
      '- [ ] an open box',
      '',
      '## Notes',
      '',
      '**Status:** Done',
      '',
    ].join('\n')
    expect(found(text)).toEqual([])
  })

  it('an unreadable read state is reported as unknown, not compared', () => {
    expect(
      found(record('**State:** Shipped', '**Status:** Done')).map((f) => f.split('@')[0]),
    ).toEqual(['ledger/unknown-state'])
  })

  it('a closed record agreeing with itself in a done folder passes', () => {
    const text = ['# Plan 9', '', '**State:** Done', '**Status:** Done', '', '- [x] done', ''].join(
      '\n',
    )
    expect(found(text, 'work/plans/completed/0009-x.md')).toEqual([])
  })
})

describe('history inside the state bullet is prose, not a second field (bug 0627)', () => {
  const bullet = (...rest: readonly string[]): string =>
    [
      '# Plan 9',
      '',
      '## Status',
      '',
      '- **State:** Done — built and closed.',
      ...rest,
      '',
      '- [x] done',
      '',
    ].join('\n')

  it('an indented "Previously read: Ready" continuing the State bullet is not compared', () => {
    expect(
      found(
        bullet('  Previously read: Ready — frozen 2026-09-05.'),
        'work/plans/completed/0009-x.md',
      ),
    ).toEqual([])
  })

  it('a plain label opening its own list item is a field, and is compared', () => {
    expect(
      found(bullet('- Status: Draft'), 'work/plans/completed/0009-x.md').map(
        (f) => f.split(': ')[0],
      ),
    ).toEqual([`${DISAGREE}@6`])
  })

  it('a plain label at the start of a line is a field, and is compared', () => {
    expect(found(record('**State:** Draft', 'Status: Done')).map((f) => f.split(': ')[0])).toEqual([
      `${DISAGREE}@4`,
    ])
  })
})
