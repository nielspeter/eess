/**
 * No two records carry the same Id (proposal 017, block 13): the value under a label, read by
 * `fields()`, compared through the caller's own normaliser. In this corpus leading zeros carry no
 * meaning, so `066` and `0066` name one record. One `beUniqueBy()` rule, with nothing built by hand.
 */
import { corpus, fields, type MdTerm } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'unique-ids'

/** The caller's normaliser: an Id without its leading zeros. */
const id = (f: MdTerm): string => f.value.replace(/^0+(?=\d)/, '')

const rule = (cwd: string): ReturnType<typeof fields> =>
  fields(corpus({ cwd, roots: ['records/**'] }), { label: 'Id', forms: ['bold'] })
    .should()
    .beUniqueBy(id, 'Id')
    .because('an Id names one record')

describe('no two records carry the same Id', () => {
  it('clean: every record has its own Id', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(2)
  })

  it('violating-shared-id: two records whose Ids differ only in leading zeros are both reported', () => {
    const v = rule(fixture(NAME, 'violating-shared-id')).violations()
    expect(v.map((f) => f.message)).toEqual([
      'records/export.md:3 has the same Id as 1 other: records/login.md:3',
      'records/login.md:3 has the same Id as 1 other: records/export.md:3',
    ])
    for (const finding of v) {
      expect(finding.file).toContain('violating-shared-id')
      expect(finding.line).toBe(3)
      // A finding about a record, not a configuration finding about the rule.
      expect(finding.bypassFilters).toBeUndefined()
    }
  })
})
