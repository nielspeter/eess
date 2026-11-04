import { describe, expect, it } from 'vitest'
import { corpus, fields, vocabulary } from '../../src/index.js'
import { findState, honestyAtClose } from '../../src/rules/ledger.js'
import { tree } from '../helpers/tree.js'

// Bug 0604: the label shapes read a label's letters as ASCII only, so `## Größe: F7` ended a record's
// header (a value rule over the header silently skipped the record) and `Größe: F7` was read as part
// of the value above it. A label's letters are Unicode letters now.

const docs = (files: Record<string, readonly string[]>) =>
  corpus({
    cwd: tree(
      Object.fromEntries(Object.entries(files).map(([p, l]) => [p, [...l, ''].join('\n')])),
    ),
    roots: ['**/*.md'],
  })
const read = (
  c: ReturnType<typeof corpus>,
  label: string,
  forms: ('bold' | 'heading' | 'plain')[],
  header = false,
) =>
  fields(c, { label, forms, ...(header ? { region: 'header' as const } : {}) })
    .select({ label: 'field', identify: (t) => ({ name: `${t.label}:${t.value}` }) })
    .elements.map((t) => `${t.label}=${t.value} @${String(t.line)}`)

describe('a field heading in a non-ASCII label continues the header (bug 0604)', () => {
  it('## Größe: F7 continues the header, its own value and the bold field below are read', () => {
    const c = docs({ 'b.md': ['# T', '', '## Größe: F7', '', '**Owner:** Ann', '', '## Body'] })
    expect(read(c, 'Owner', ['bold'], true)).toEqual(['Owner=Ann @5'])
    expect(read(c, 'Größe', ['heading'], true)).toEqual(['Größe=F7 @3'])
  })

  it('a value rule over the header judges every record', () => {
    const c = docs({
      'a.md': ['# A', '', '**Owner:** Bob', '', '## Body'],
      'b.md': ['# B', '', '## Größe: F7', '', '**Owner:** Zed', '', '## Body'],
    })
    const v = fields(c, { label: 'Owner', forms: ['bold'], region: 'header' })
      .should()
      .resolveAgainst(vocabulary(c, { terms: ['Ann', 'Bob'] }))
      .violations()
    expect(v.examined).toBe(2)
    expect(v.map((x) => x.element)).toEqual(['b.md:5'])
    expect(v[0]?.message).toContain('Zed')
  })

  it('a continued value ends at a non-ASCII plain label', () => {
    const c = docs({ 'b.md': ['# T', '', '**Owner:** Ann', 'Größe: F7'] })
    expect(read(c, 'Owner', ['bold'])).toEqual(['Owner=Ann @3'])
  })

  it('ASCII labels read as before, and a heading that is no label still ends the header', () => {
    const c = docs({
      'b.md': [
        '# T',
        '',
        '## Area: F7',
        '',
        '**Owner:** Ann',
        '',
        '## Background',
        '',
        '**Late:** x',
      ],
    })
    expect(read(c, 'Owner', ['bold'], true)).toEqual(['Owner=Ann @5'])
    expect(read(c, 'Area', ['heading'], true)).toEqual(['Area=F7 @3'])
    expect(read(c, 'Late', ['bold'], true)).toEqual([])
    expect(
      read(docs({ 'b.md': ['# T', '', '**Owner:** Ann', 'Area: F7'] }), 'Owner', ['bold']),
    ).toEqual(['Owner=Ann @3'])
  })

  it('a label with combining marks is a label: NFD Latin and Devanagari', () => {
    for (const label of ['Gro\u0308ße', 'स्थिति']) {
      const c = docs({
        'b.md': ['# T', '', `## ${label}: F7`, '', '**Owner:** Ann', '', '## Body'],
      })
      expect([label, read(c, 'Owner', ['bold'], true)]).toEqual([label, ['Owner=Ann @5']])
      const v = docs({ 'b.md': ['# T', '', '**Owner:** Ann', `${label}: F7`] })
      expect([label, read(v, 'Owner', ['bold'])]).toEqual([label, ['Owner=Ann @3']])
    }
  })

  it('honestyAtClose reads a state below a non-ASCII field heading, so a misplaced close reds', () => {
    const c = docs({
      'work/plans/a.md': ['# A', '', '- **State:** Open', '', '- [ ] x'],
      'work/plans/b.md': [
        '# B',
        '',
        '## Größe: F7',
        '',
        '## Status',
        '',
        '- **State:** Done',
        '',
        '- [x] x',
      ],
    })
    const found = honestyAtClose(c, { report: 'return' })
    expect(
      found.map((v) => `${v.rule}@${String(v.line)} ${v.file.endsWith('b.md') ? 'b' : 'a'}`),
    ).toContain('ledger/state-folder-mismatch@7 b')
  })

  // Not a pin of bug 0604: these two forms read through the ledger's own label matcher and the
  // wrapped form, which never used the ASCII shapes. They were green before the fix too.
  it('the ledger reads a state under a non-ASCII heading label', () => {
    expect(findState('# T\n\n## Zustände: Done\n', ['Done'], undefined, ['Zustände'])?.state).toBe(
      'Done',
    )
    expect(findState('# T\n\n**Zustände:** Done\n', ['Done'], undefined, ['Zustände'])?.state).toBe(
      'Done',
    )
  })
})
