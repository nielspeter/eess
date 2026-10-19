/**
 * Plan 0459: `docs().beUniqueBy(key, what)`, eess-md's door onto the kernel's
 * `uniqueByCondition`. Driven through `corpus()` and the public builder.
 */
import { describe, it, expect } from 'vitest'
import { corpus, docs, type MdDocument } from '../src/index.js'
import { tree } from './helpers/tree.js'

/** The record number a file name starts with. */
const number = (d: MdDocument): string => /\/(\d+)-[^/]*\.md$/.exec(d.relPath)?.[1] ?? ''

const rule = (files: readonly string[]): ReturnType<typeof docs> =>
  docs(corpus({ cwd: tree(files), roots: ['records/**'] }))
    .should()
    .beUniqueBy(number, 'record number')

describe('docs().beUniqueBy() (plan 0459)', () => {
  it('a duplicate names both documents by relPath, each at its own line 1', () => {
    const found = rule(['records/0007-a.md', 'records/done/0007-b.md', 'records/0008-c.md'])
      .rule({ id: 'records/unique' })
      .violations()
    expect(found.map((v) => [v.element, v.line, v.ruleId, v.message])).toEqual([
      [
        'records/0007-a.md',
        1,
        'records/unique',
        'records/0007-a.md has the same record number as 1 other: records/done/0007-b.md:1',
      ],
      [
        'records/done/0007-b.md',
        1,
        'records/unique',
        'records/done/0007-b.md has the same record number as 1 other: records/0007-a.md:1',
      ],
    ])
    expect(found.map((v) => v.file)).toEqual([
      expect.stringMatching(/records\/0007-a\.md$/),
      expect.stringMatching(/records\/done\/0007-b\.md$/),
    ])
  })

  it('distinct values are green, every document examined', () => {
    const found = rule(['records/0007-a.md', 'records/0008-b.md']).violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(2)
  })
})
