import { describe, expect, it } from 'vitest'
import { corpus, docs, fields, vocabulary } from '../../src/index.js'
import { tree } from '../helpers/tree.js'

// Bug 0622: `fields()`' header ended at an indented `    ## Notes`, which CommonMark reads as code (or
// a paragraph's lazy continuation), never a heading. A value rule over `region: 'header'` then passed
// without judging the record's field, while `haveField` read the same field as present in the header.

const docsOf = (files: Record<string, readonly string[]>) =>
  corpus({
    cwd: tree(
      Object.fromEntries(Object.entries(files).map(([p, l]) => [p, [...l, ''].join('\n')])),
    ),
    roots: ['**/*.md'],
  })

const HEADER = { label: 'Status', forms: ['bold' as const], region: 'header' as const }

/** The value rule over the header, and `haveField` with the same options, over `a.md` and `b.md`. */
const judge = (b: readonly string[]) => {
  const c = docsOf({ 'a.md': ['# A', '', '**Status:** open'], 'b.md': b })
  const value = fields(c, HEADER)
    .should()
    .resolveAgainst(vocabulary(c, { terms: ['open'] }))
    .violations()
  const gate = docs(c).should().haveField(HEADER).violations()
  return {
    examined: value.examined,
    value: value.map((v) => v.element),
    gate: gate.map((v) => `${v.element}: ${v.message}`),
  }
}

describe('an indented line like a heading does not end the field header (bug 0622)', () => {
  it('a value below an indented "## Notes" is judged by a header value rule', () => {
    expect(judge(['# B', '', '    ## Notes', '', '**Status:** bogus'])).toEqual({
      examined: 2,
      value: ['b.md:5'],
      gate: [],
    })
  })

  it('a value below a tab-indented "## Notes" is judged too', () => {
    expect(judge(['# B', '', '\t## Notes', '', '**Status:** bogus'])).toEqual({
      examined: 2,
      value: ['b.md:5'],
      gate: [],
    })
  })

  it('a heading indented by three spaces still ends the header, as CommonMark reads it', () => {
    const got = judge(['# B', '', '   ## Notes', '', '**Status:** bogus'])
    expect([got.examined, got.value]).toEqual([1, []])
    expect(got.gate).toEqual([
      expect.stringMatching(/^b\.md:5: Status at line 5 is outside the header/),
    ])
  })

  it('control: a real "## Notes" heading still ends the header, and haveField says so', () => {
    const got = judge(['# B', '', '## Notes', '', '**Status:** bogus'])
    expect([got.examined, got.value]).toEqual([1, []])
    expect(got.gate).toEqual([
      expect.stringMatching(/^b\.md:5: Status at line 5 is outside the header/),
    ])
  })
})
