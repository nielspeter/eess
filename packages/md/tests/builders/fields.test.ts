/**
 * Plan 0468: `fields()` reads a labelled value in the forms the caller names. Each row drives the
 * public builder and asserts what was read, where, or which finding, at which line.
 */
import { describe, it, expect } from 'vitest'
import {
  cleanValue,
  corpus,
  fields,
  longestOf,
  terms,
  untilDelimiter,
  vocabulary,
  type FieldOptions,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const one = (lines: readonly string[], path = 'bugs/b.md') =>
  corpus({ cwd: tree({ [path]: [...lines, ''].join('\n') }), roots: ['**/*.md'] })

type Opts = Omit<FieldOptions, 'label'> & { readonly label?: string }
const read = (c: ReturnType<typeof corpus>, opts: Opts) =>
  fields(c, { label: 'Status', ...opts })
    .select({ label: 'field', identify: (t) => ({ name: `${t.label}:${t.value}` }) })
    .elements.map((t) => `${t.form} ${t.label}=${t.value} @${String(t.line)}`)

describe('each form is read, with its line (plan 0468)', () => {
  it('bold in all three spellings', () => {
    const c = one(['# B', '', '**Status:** open', '**Status**: closed', '__Status__: parked'])
    expect(read(c, { forms: ['bold'] })).toEqual([
      'bold Status=open @3',
      'bold Status=closed @4',
      'bold Status=parked @5',
    ])
  })

  it('bold after a list marker, and behind three spaces of indent', () => {
    const c = one(['# B', '', '- **Status:** open', '', '   **Status:** closed'])
    expect(read(c, { forms: ['bold'] })).toEqual(['bold Status=open @3', 'bold Status=closed @5'])
  })

  it('heading at depths 2 and 4', () => {
    const c = one(['# B', '', '## Status: open', '', '#### Status: closed'])
    expect(read(c, { forms: ['heading'] })).toEqual([
      'heading Status=open @3',
      'heading Status=closed @5',
    ])
  })

  it('bold-line, and a bold label with a bold value stays bold', () => {
    const c = one(['# B', '', '**Status: open**', '', '**Status:** **closed**'])
    expect(read(c, { forms: ['bold-line', 'bold'] })).toEqual([
      'bold-line Status=open @3',
      'bold Status=closed @5',
    ])
  })

  it('plain', () => {
    expect(read(one(['# B', '', 'Status: open']), { forms: ['plain'] })).toEqual([
      'plain Status=open @3',
    ])
  })

  it('the label ignores ASCII case and runs of whitespace; an alias keeps its own label', () => {
    const c = one(['# B', '', '**status:** open', '**Bug  State:** closed'])
    expect(read(c, { forms: ['bold'], aliases: ['Bug State'] })).toEqual([
      'bold status=open @3',
      'bold Bug State=closed @4',
    ])
  })
})

describe('the header region (plan 0468)', () => {
  const doc = [
    '# B',
    '',
    '## Status: open',
    '## Severity: High',
    '',
    '## Notes',
    '',
    '**Status:** phase one done',
  ]
  it('label headings stay one header; a plain section heading ends it', () => {
    expect(read(one(doc), { forms: ['heading', 'bold'], region: 'header' })).toEqual([
      'heading Status=open @3',
    ])
  })

  it('a per-phase bold Status after the header is neither read nor reported', () => {
    const c = one(doc)
    const found = fields(c, { label: 'Status', forms: ['heading'], region: 'header' })
      .should()
      .resolveAgainst(/open/)
      .violations()
    expect([...found]).toEqual([])
  })

  it('a Status section with a bold State under it is outside the header', () => {
    const c = one(['# B', '', '## Status', '', '- **State:** Done'])
    expect(read(c, { label: 'State', forms: ['bold'], region: 'header' })).toEqual([])
    expect(read(c, { label: 'State', forms: ['bold'] })).toEqual(['bold State=Done @5'])
  })
})

describe('what is not read (plan 0468)', () => {
  it('a fenced example, a label mid-paragraph, and a heading with no colon', () => {
    const c = one([
      '# B',
      '',
      '```md',
      '**Status:** fenced',
      '```',
      '',
      'The **Status:** here is mid-sentence.',
      '',
      '## Status at a glance',
    ])
    expect(read(c, { forms: ['bold', 'heading', 'plain'] })).toEqual([])
  })
})

describe('multi-line values (plan 0468)', () => {
  it('a value continues until a blank line, a heading, another label, or the end of its item', () => {
    const c = one([
      '# B',
      '',
      '**Status:** open',
      'and waiting',
      '',
      '**Owner:** team',
      'still team',
      '**Status:** parked',
      'for now',
      '## Next',
      '- **Status:** done',
      '- next item',
    ])
    expect(read(c, { forms: ['bold'] })).toEqual([
      'bold Status=open and waiting @3',
      'bold Status=parked for now @8',
      'bold Status=done @11',
    ])
  })

  it('a blank line ends a value even when prose follows it', () => {
    const c = one([
      '# B',
      '',
      '**Status:** open',
      'and waiting',
      '',
      'Prose that is not part of it.',
    ])
    expect(read(c, { forms: ['bold'] })).toEqual(['bold Status=open and waiting @3'])
  })

  it('a heading value is one line', () => {
    const c = one(['# B', '', '## Status: open', 'not part of it'])
    expect(read(c, { forms: ['heading'] })).toEqual(['heading Status=open @3'])
  })
})

describe('cleanValue and the helpers (plan 0468)', () => {
  it('cleanValue removes paired emphasis and a pictograph, and keeps in_progress and C++', () => {
    for (const raw of ['✅ Fixed', '**Fixed**', '~~Fixed~~', '`Fixed`', ' Fixed  ', '_Fixed_']) {
      expect(cleanValue(raw)).toBe('Fixed')
    }
    expect(cleanValue('in_progress')).toBe('in_progress')
    expect(cleanValue('C++')).toBe('C++')
    expect(cleanValue('won’t do')).toBe('won’t do')
    expect(cleanValue('High — the reason')).toBe('High — the reason')
  })

  it('untilDelimiter cuts at the first delimiter', () => {
    expect(untilDelimiter(['—'])('High — the reason')).toBe('High')
  })

  it('longestOf takes the longest allowed value as a whole word, after trimming', () => {
    const states = longestOf(['In progress', 'In', 'Draft'])
    expect(states('In progress (blocked)')).toBe('In progress')
    expect(states(' Draft — reason')).toBe('Draft')
    expect(states('Drafted')).toBe('Drafted')
    expect(states('Shipped')).toBe('Shipped')
  })

  it('split yields one element per value, each on the label line', () => {
    const c = one(['# B', '', '**Status:** a, b'])
    expect(read(c, { forms: ['bold'], split: (v) => v.split(',').map((s) => s.trim()) })).toEqual([
      'bold Status=a @3',
      'bold Status=b @3',
    ])
  })
})

describe('resolveAgainst (plan 0468)', () => {
  const states = (c: ReturnType<typeof corpus>) => vocabulary(c, { terms: ['open', 'fixed'] })

  it('a field finding names the value, the label and the line, never the set', () => {
    const c = one(['# B', '', '**Status:** Shipped'])
    const byVocab = fields(c, { label: 'Status', forms: ['bold'] })
      .should()
      .resolveAgainst(states(c))
      .violations()
    expect(byVocab.map((v) => v.message)).toEqual([
      "'Shipped' (Status, line 3) does not resolve against the vocabulary (2 terms)",
    ])
    const byPattern = fields(c, { label: 'Status', forms: ['bold'] })
      .should()
      .resolveAgainst(/(open|fixed)/)
      .violations()
    expect(byPattern.map((v) => v.message)).toEqual([
      "'Shipped' (Status, line 3) does not match /(open|fixed)/",
    ])
  })

  it('a terms() finding keeps its message', () => {
    const c = one(['# B', '', 'Owner: nobody'])
    const found = terms(c, { label: /Owner:/ })
      .should()
      .resolveAgainst(states(c))
      .violations()
    expect(found.map((v) => v.message)).toEqual([
      "'nobody' does not resolve against the vocabulary (2 terms)",
    ])
  })

  it('a pattern must match the whole value: /fixed/ rejects unfixed', () => {
    const c = one(['# B', '', '**Status:** unfixed'])
    const found = fields(c, { label: 'Status', forms: ['bold'] })
      .should()
      .resolveAgainst(/fixed/)
      .violations()
    expect(found.map((v) => v.line)).toEqual([3])
  })

  it('a /g pattern judges every document alike', () => {
    const c = corpus({
      cwd: tree({
        'bugs/a.md': '# A\n\n**Status:** fixed\n',
        'bugs/b.md': '# B\n\n**Status:** fixed\n',
      }),
      roots: ['**/*.md'],
    })
    const found = fields(c, { label: 'Status', forms: ['bold'] })
      .should()
      .resolveAgainst(/fixed/g)
      .violations()
    expect([...found]).toEqual([])
  })
})

describe('a form the rule does not read is a finding (plan 0468)', () => {
  const two = () =>
    corpus({
      cwd: tree({
        'bugs/b.md': '# B\n\n## Status: open\n',
        'README.md': '# Readme\n\n## Status: beta\n',
      }),
      roots: ['**/*.md'],
    })
  const inBugs = {
    description: 'in bugs',
    test: (t: { doc: { relPath: string } }) => t.doc.relPath.startsWith('bugs/'),
  }

  it('forms: [bold] over a selected heading document reports the heading, with the line quoted', () => {
    const found = fields(two(), { label: 'Status', forms: ['bold'] })
      .that()
      .satisfy(inBugs)
      .should()
      .resolveAgainst(/open/)
      .violations()
    // The rule reads no bold Status in bugs/, so the kernel also reports that it examined nothing.
    expect(found.filter((v) => v.line === 0).map((v) => v.message)).toEqual([
      expect.stringContaining('examined zero units'),
    ])
    expect(found.filter((v) => v.line !== 0).map((v) => [v.element, v.line, v.message])).toEqual([
      [
        'bugs/b.md:3',
        3,
        "found `## Status: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line",
      ],
    ])
  })

  it('the same document outside the selection gives no finding', () => {
    const found = fields(two(), { label: 'Status', forms: ['bold'] })
      .that()
      .satisfy({ description: 'in docs', test: (t) => t.doc.relPath.startsWith('docs/') })
      .should()
      .resolveAgainst(/open/)
      .violations()
    expect(found.some((v) => v.message.startsWith('found '))).toBe(false)
  })

  it('an unnamed plain line gives no finding', () => {
    const c = one(['# B', '', '**Status:** open', '', 'Status: and prose after it'])
    const found = fields(c, { label: 'Status', forms: ['bold'] })
      .should()
      .resolveAgainst(/open/)
      .violations()
    expect([...found]).toEqual([])
  })
})

describe('terms() is unchanged (plan 0468)', () => {
  it('a terms() element has form pattern and a label without the colon', () => {
    const c = one(['# B', '', '**Owner:** team'])
    const t = terms(c, { label: /\*\*Owner:\*\*/ })
      .select({ label: 'term', identify: (e) => ({ name: e.value }) })
      .elements.map((e) => `${e.form} ${e.label}=${e.value}`)
    expect(t).toEqual(['pattern Owner=team'])
  })
})
