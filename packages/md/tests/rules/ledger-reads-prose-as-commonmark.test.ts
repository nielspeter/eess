import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { corpus } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'

/**
 * Bug 0286 — the ledger read a document's own `State:` and `Deferred:` lines with a hand-rolled fence
 * regex, while the task-box pass beside it read the same document with the markdown parser, and the two
 * disagreed. An example of a State line in a four-backtick fence or an indented block was read as the
 * document's own, and a closed record showing an open one lost every silent box (route A). A State line
 * after an unclosed fence was read as prose although CommonMark reads it as code, and the record passed
 * with nothing to check (route B). The ledger now reads prose through the parser, and reports an
 * unclosed fence.
 *
 * Code blocks only: an HTML block is read as it was, since it can hold a record's real claim as well as
 * an example of one — bug 0293's question.
 */
function findings(text: string): [string, number][] {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-prose-'))
  writeFileSync(join(dir, '0001-x.md'), text)
  const c = corpus({ roots: ['0001-x.md'], cwd: dir })
  return honestyAtClose(c, {
    closeInPlace: true,
    states: ['Draft', 'Done'],
    terminalStates: ['Done'],
    report: 'return',
  }).map((v) => [v.rule, v.line])
}

/** A closed-in-place record with one silent box, and an example placed before its own State line. */
function closedRecord(example: readonly string[]): { text: string; boxLine: number } {
  const lines = [
    '# 0001 x',
    '',
    ...example,
    '',
    '## Status',
    '',
    '- **State:** Done — closed',
    '',
    '## Tasks',
    '',
    '- [ ] box',
  ]
  return { text: [...lines, ''].join('\n'), boxLine: lines.length }
}

// The house template's line, which leads with a non-terminal token.
const EXAMPLE_STATE = '- **State:** Draft — an example'

describe('bug 0286: the ledger reads a document’s prose as CommonMark does', () => {
  it('a closed record reports its silent box whatever example of a State line it shows', () => {
    const shapes: Record<string, readonly string[]> = {
      control: [],
      fourBacktickWrappingAFence: ['````md', '```md', EXAMPLE_STATE, '```', '````'],
      indentedBlock: ['An example:', '', `    ${EXAMPLE_STATE}`],
      tildeFenceWrappingAFence: ['~~~~md', '~~~md', EXAMPLE_STATE, '~~~', '~~~~'],
    }

    const reported = Object.fromEntries(
      Object.entries(shapes).map(([name, example]) => {
        const { text, boxLine } = closedRecord(example)
        return [name, findings(text).map(([rule, line]) => [rule, line === boxLine])]
      }),
    )

    expect(reported).toEqual(
      Object.fromEntries(
        Object.keys(shapes).map((name) => [name, [['ledger/silent-open-box', true]]]),
      ),
    )
  })

  it('a State line carrying inline HTML or inline code is still the record’s own', () => {
    // Inline HTML and inline code sit on a line that may be the claim itself, so they are prose; only a
    // code block is set aside.
    const record = (stateLine: string): string =>
      ['# 0001 x', '', '## Status', '', stateLine, '', '## Tasks', '', '- [ ] box', ''].join('\n')

    expect(findings(record('- **State:** Done — closed <!-- a note -->'))).toEqual([
      ['ledger/silent-open-box', 9],
    ])
    expect(findings(record('- **State:** Done — closed in `ledger.ts`'))).toEqual([
      ['ledger/silent-open-box', 9],
    ])
  })

  it('an HTML block is read as it was, so a real State line inside one is still the record’s own', () => {
    // Setting HTML blocks aside would silence these; 0.6.0 reads them, and so does the fix.
    const record = (open: string, close: string): string =>
      [
        '# 0001 x',
        '',
        '## Status',
        '',
        open,
        '- **State:** Done — closed',
        close,
        '',
        '## Tasks',
        '',
        '- [ ] box',
        '',
      ].join('\n')

    expect(findings(record('<div>', '</div>'))).toEqual([['ledger/silent-open-box', 11]])
    expect(findings(record('<details><summary>s</summary>', '</details>'))).toEqual([
      ['ledger/silent-open-box', 11],
    ])
  })

  it('a fence is closed only by a closer CommonMark accepts, at the end of the document too', () => {
    const endsWith = (fence: readonly string[]): [string, number][] =>
      findings(['# 0001 x', '', '- **State:** Draft — open', '', ...fence].join('\n'))

    // Not closers: a tab, four spaces, or a quote marker before the run.
    expect(endsWith(['```md', 'an example', '\t```'])).toEqual([['ledger/unterminated-fence', 5]])
    expect(endsWith(['```md', 'an example', '    ```'])).toEqual([['ledger/unterminated-fence', 5]])
    expect(endsWith(['```md', 'an example', '> ```'])).toEqual([['ledger/unterminated-fence', 5]])
    // Closed at the very end of the file, with and without a newline after the closer.
    expect(endsWith(['```md', 'an example', '```'])).toEqual([])
    expect(endsWith(['```md', 'an example', '```', ''])).toEqual([])
    // An empty fence closed at the end, and an indented block at the end: no fence is left open.
    expect(endsWith(['```', '```'])).toEqual([])
    expect(endsWith(['An example:', '', '    indented code'])).toEqual([])
    // A fence opened inside a list item or a quote, running to the end, is read from where it opens.
    expect(endsWith(['- note:', '  ```md', '  an example'])).toEqual([
      ['ledger/unterminated-fence', 6],
    ])
    expect(endsWith(['> ```md', '> an example'])).toEqual([['ledger/unterminated-fence', 5]])
  })

  it('a fence its list item closes does not hide the list item after it', () => {
    // The fence's end is exclusive: it ends at column 1 of the next item, which is not code.
    const text = [
      '# 0001 x',
      '',
      '## Status',
      '',
      '- note:',
      '  ```md',
      '  an example its list item ends',
      '- **State:** Done — closed',
      '',
      '## Tasks',
      '',
      '- [ ] box',
      '',
    ].join('\n')

    expect(findings(text)).toEqual([['ledger/silent-open-box', 12]])
  })

  it('a record whose only State line is inside a code block is reported, not passed', () => {
    const record = (status: readonly string[]): string =>
      ['# 0001 x', '', '## Status', '', ...status, '', '## Tasks', '', '- [ ] box', ''].join('\n')

    // Four spaces make an indented code block, and a fence is a fence: CommonMark reads neither as the
    // record's own State, so the record would pass with nothing checked.
    expect(findings(record(['    - **State:** Done — closed']))).toEqual([
      ['ledger/state-in-code', 5],
    ])
    expect(findings(record(['```', '- **State:** Done — closed', '```']))).toEqual([
      ['ledger/state-in-code', 6],
    ])
    // A `##` comment in a code block is not a heading, so it does not end the header above the line.
    expect(
      findings(record(['```sh', '## build first', '```', '', '    - **State:** Done — closed'])),
    ).toEqual([['ledger/state-in-code', 9]])
    // The control: the same line in prose is read, and its silent box reported.
    expect(findings(record(['- **State:** Done — closed']))).toEqual([
      ['ledger/silent-open-box', 9],
    ])
  })

  it('a document that shows a State line only in code is reported, and naming it a board file clears it', () => {
    // A guide showing the template, in a lane beside a record: it is not a record, but the gate cannot
    // tell it from one whose own line is in code, so the fix line's remedy for it is boardFiles.
    const dir = mkdtempSync(join(tmpdir(), 'ledger-prose-'))
    writeFileSync(
      join(dir, '0001-x.md'),
      ['# 0001 x', '', '- **State:** Draft — open', ''].join('\n'),
    )
    writeFileSync(
      join(dir, 'notes.md'),
      [
        '# How to write a record',
        '',
        '```md',
        '## Status',
        '',
        '- **State:** Draft',
        '```',
        '',
      ].join('\n'),
    )
    const lane = (boardFiles: string[]): [string, string, number][] =>
      honestyAtClose(corpus({ roots: ['*.md'], cwd: dir }), {
        states: ['Draft', 'Done'],
        terminalStates: ['Done'],
        boardFiles,
        report: 'return',
      }).map((v) => [v.element, v.rule, v.line])

    expect(lane([])).toEqual([['notes.md', 'ledger/state-in-code', 6]])
    expect(lane(['notes.md'])).toEqual([])
  })

  it('a fence that never closes is reported, since the State line and box after it are code', () => {
    const text = [
      '# 0001 x',
      '',
      '```md',
      'an example with no closer',
      '',
      '**State:** Done',
      '',
      '## Tasks',
      '',
      '- [ ] box',
      '',
    ].join('\n')

    expect(findings(text)).toEqual([['ledger/unterminated-fence', 3]])
  })

  it('a fence its list item closes is not reported, and the record after it is read', () => {
    const text = [
      '# 0001 x',
      '',
      '- note:',
      '  ```md',
      '  an example its list item ends',
      '- another note',
      '',
      '## Status',
      '',
      '- **State:** Done — closed',
      '',
      '## Tasks',
      '',
      '- [ ] box',
      '',
    ].join('\n')

    expect(findings(text)).toEqual([['ledger/silent-open-box', 14]])
  })

  it('an example of `Deferred: none` does not contradict a real deferral, and a real one still does', () => {
    const record = (summary: string, example: readonly string[]): string =>
      [
        '# 0001 x',
        '',
        ...example,
        '',
        '## Status',
        '',
        '- **State:** Done — closed',
        '',
        '## Tasks',
        '',
        '- [ ] deferred→0002 — moved',
        '',
        summary,
        '',
      ].join('\n')

    const honest = record('Deferred: 0002', ['````md', '```md', 'Deferred: none', '```', '````'])
    const lying = record('Deferred: none', [])

    expect(findings(honest)).toEqual([])
    expect(findings(lying).map(([rule]) => rule)).toEqual(['ledger/deferred-none-lie'])
  })
})
