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
 * An example in an HTML block is read the same way (bug 0293's State half).
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
      preBlock: ['<pre>', EXAMPLE_STATE, '</pre>'],
      htmlComment: ['<!--', EXAMPLE_STATE, '-->'],
      preInAListItem: ['- note:', '  <pre>', `  ${EXAMPLE_STATE}`, '  </pre>'],
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
    // Inline HTML and inline code sit on a line that may be the claim itself, so they are prose; only an
    // HTML block or a code block is set aside.
    const record = (stateLine: string): string =>
      ['# 0001 x', '', '## Status', '', stateLine, '', '## Tasks', '', '- [ ] box', ''].join('\n')

    expect(findings(record('- **State:** Done — closed <!-- a note -->'))).toEqual([
      ['ledger/silent-open-box', 9],
    ])
    expect(findings(record('- **State:** Done — closed in `ledger.ts`'))).toEqual([
      ['ledger/silent-open-box', 9],
    ])
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
