/**
 * Bug 0507: a box's text is all of its own content, every paragraph and every sub-item that is not
 * itself a box, so a deferral written on a box's second line is seen. A nested box stays its own
 * box. Driven through `honestyAtClose` and `taskItems()`.
 */
import { describe, it, expect } from 'vitest'
import { corpus, taskItems, type ArchViolation } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'
import { tree } from '../helpers/tree.js'

const record = (box: readonly string[]): string =>
  [
    '# Plan 0001: x',
    '',
    '## Status',
    '',
    '- **State:** Done',
    '',
    '## Ledger',
    '',
    ...box,
    '',
    'Deferred: none',
    '',
  ].join('\n')

const ids = (found: readonly ArchViolation[]): string[] =>
  found.map((v) => `${v.ruleId ?? v.rule} @ ${String(v.line)}`).sort()

const ledger = (box: readonly string[]) =>
  honestyAtClose(
    corpus({
      cwd: tree({ 'plans/README.md': '# Plans\n', 'plans/completed/0001-x.md': record(box) }),
      roots: ['plans/**/*.md'],
    }),
    { report: 'return' },
  )

describe('a box reads all of its own text (bug 0507)', () => {
  it('a deferral on the box’s own line contradicts Deferred: none (the control)', () => {
    expect(ids(ledger(['- [ ] the parser change — done-otherwise, deferred→plan 0002']))).toEqual([
      'ledger/deferred-none-lie @ 11',
    ])
  })

  it('a deferral in a second paragraph contradicts it too', () => {
    expect(
      ids(ledger(['- [ ] the parser change — done-otherwise', '', '  deferred→plan 0002'])),
    ).toEqual(['ledger/deferred-none-lie @ 13'])
  })

  it('a deferral in a plain sub-bullet contradicts it too', () => {
    expect(
      ids(ledger(['- [ ] the parser change — done-otherwise', '  - deferred→plan 0002'])),
    ).toEqual(['ledger/deferred-none-lie @ 12'])
  })

  it('a disposition written only on a second line is read, not a false red', () => {
    expect(ids(ledger(['- [ ] the parser change', '', '  validation-owed: CI on the PR']))).toEqual(
      [],
    )
  })

  it('a nested box is still its own box, with its own text', () => {
    const c = corpus({
      cwd: tree({
        'a.md': [
          '# A',
          '',
          '- [ ] parent',
          '',
          '  more of the parent',
          '',
          '  - a plain note',
          '  - [x] child',
          '',
          '    the child’s second line',
          '',
        ].join('\n'),
      }),
      roots: ['**/*.md'],
    })
    const texts = taskItems(c)
      .select({ label: 'box', identify: (t) => ({ name: t.text }) })
      .elements.map((t) => `${String(t.line)}: ${t.text}`)
    expect(texts).toEqual([
      '3: parent more of the parent a plain note',
      '8: child the child’s second line',
    ])
  })

  it('a box with a declared mark reads its second paragraph too', () => {
    const c = corpus({
      cwd: tree({
        'a.md': ['# A', '', '- [~] half done', '', '  deferred→plan 0002', ''].join('\n'),
      }),
      roots: ['**/*.md'],
    })
    const texts = taskItems(c, { marks: { '~': 'open' } })
      .select({ label: 'box', identify: (t) => ({ name: t.text }) })
      .elements.map((t) => t.text)
    expect(texts).toEqual(['half done deferred→plan 0002'])
  })

  it('fenced code and HTML inside a box are not its text', () => {
    const c = corpus({
      cwd: tree({
        'a.md': [
          '# A',
          '',
          '- [ ] the box',
          '',
          '  ```',
          '  deferred→plan 0002',
          '  ```',
          '',
          '  <div>deferred→plan 0003</div>',
          '',
        ].join('\n'),
      }),
      roots: ['**/*.md'],
    })
    const texts = taskItems(c)
      .select({ label: 'box', identify: (t) => ({ name: t.text }) })
      .elements.map((t) => t.text)
    expect(texts).toEqual(['the box'])
  })

  it('a plain sub-item’s own sub-items are read, recursively', () => {
    const c = corpus({
      cwd: tree({
        'a.md': ['# A', '', '- [ ] top', '  - plain', '    - deeper deferred→x', ''].join('\n'),
      }),
      roots: ['**/*.md'],
    })
    const texts = taskItems(c)
      .select({ label: 'box', identify: (t) => ({ name: t.text }) })
      .elements.map((t) => t.text)
    expect(texts).toEqual(['top plain deeper deferred→x'])
  })
})
