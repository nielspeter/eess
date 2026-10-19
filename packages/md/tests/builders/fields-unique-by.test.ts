/**
 * Plan 0459's addendum (proposal 017, block 13 at value level): `fields(...).should().beUniqueBy(key,
 * what)`, no two occurrences of a labelled value share `key`'s value. Each occurrence is reported at
 * its own line. Driven through `corpus()` and the public builder.
 */
import { describe, it, expect } from 'vitest'
import { corpus, fields, terms, type MdTerm } from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const ids = (files: Readonly<Record<string, string>>) =>
  fields(corpus({ cwd: tree(files), roots: ['records/**'] }), { label: 'Id', forms: ['bold'] })

const page = (id: string, before = 0): string =>
  ['# R', '', ...Array.from({ length: before }, () => 'Text.'), `**Id:** ${id}`, ''].join('\n')

const asWritten = (f: MdTerm): string => f.value
/** The caller's normaliser: leading zeros carry no meaning in this corpus. */
const asNumber = (f: MdTerm): string => f.value.replace(/^0+(?=\d)/, '')

describe('fields().beUniqueBy() (plan 0459 addendum)', () => {
  it('two documents with one value are both reported, each at its own line', () => {
    const found = ids({ 'records/a.md': page('A-7'), 'records/b.md': page('A-7', 2) })
      .should()
      .beUniqueBy(asWritten, 'Id')
      .rule({ id: 'records/unique-id' })
      .violations()
    expect(found.map((v) => [v.element, v.line, v.ruleId, v.message])).toEqual([
      [
        'records/a.md:3',
        3,
        'records/unique-id',
        'records/a.md:3 has the same Id as 1 other: records/b.md:5',
      ],
      [
        'records/b.md:5',
        5,
        'records/unique-id',
        'records/b.md:5 has the same Id as 1 other: records/a.md:3',
      ],
    ])
  })

  it('066 and 0066 are distinct when the key keeps the value as written', () => {
    const found = ids({ 'records/a.md': page('066'), 'records/b.md': page('0066') })
      .should()
      .beUniqueBy(asWritten, 'Id')
      .violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(2)
  })

  it('066 and 0066 collide when the caller normalises leading zeros away', () => {
    const found = ids({ 'records/a.md': page('066'), 'records/b.md': page('0066') })
      .should()
      .beUniqueBy(asNumber, 'Id')
      .violations()
    expect(found.map((v) => v.message)).toEqual([
      'records/a.md:3 has the same Id as 1 other: records/b.md:3',
      'records/b.md:3 has the same Id as 1 other: records/a.md:3',
    ])
  })

  it('a value the rule cannot read is reported, not grouped with another', () => {
    const found = ids({ 'records/a.md': page('✅'), 'records/b.md': page('✅') })
      .should()
      .beUniqueBy(asWritten, 'Id')
      .violations()
    expect(found.map((v) => `${v.element}: ${v.message}`)).toEqual([
      "records/a.md:3: (Id, line 3) has no value this rule can read in '✅'",
      "records/b.md:3: (Id, line 3) has no value this rule can read in '✅'",
    ])
  })

  it('no occurrence at all is the zero-examined finding, not a pass', () => {
    const found = ids({ 'records/a.md': '# R\n\nNo id here.\n' })
      .should()
      .beUniqueBy(asWritten, 'Id')
      .violations()
    expect(found.map((v) => [v.bypassFilters, v.message])).toEqual([
      [true, expect.stringContaining('examined zero units')],
    ])
  })

  it('terms() has it too, on the same elements', () => {
    const c = corpus({
      cwd: tree({ 'records/a.md': 'Owner: Ana\n', 'records/b.md': 'Owner: Ana\n' }),
      roots: ['records/**'],
    })
    const found = terms(c, { label: /Owner:/ })
      .should()
      .beUniqueBy((t) => t.value, 'owner')
      .violations()
    expect(found.map((v) => v.element)).toEqual(['records/a.md:1', 'records/b.md:1'])
  })
})
