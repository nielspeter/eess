/**
 * A labelled value, read in the forms this corpus writes (proposal 017, block 1): every record's
 * Status is `open` or `closed`, written `**Status:** v` or `## Status: v` in the record's header.
 * A Status written in a form the rule does not read is reported, never skipped.
 */
import { corpus, fields, vocabulary } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-record-states-its-status'

const rule = (cwd: string): ReturnType<typeof fields> => {
  const c = corpus({ cwd, roots: ['records/**'] })
  return fields(c, { label: 'Status', forms: ['bold', 'heading'], region: 'header' })
    .should()
    .resolveAgainst(vocabulary(c, { terms: ['open', 'closed'] }))
    .because('a record is either open or closed')
}

describe('a record states its status', () => {
  it('clean: every record states open or closed, in a form the rule reads', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // Two records, one Status each; the export record's body `**Status:**` is past its header.
    expect(v.examined).toBe(2)
  })

  it('violating-unknown-status: a status outside the two is reported at its line', () => {
    const v = rule(fixture(NAME, 'violating-unknown-status')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/login.md:3')
    expect(finding?.file).toContain('violating-unknown-status')
    expect(finding?.message).toBe(
      "'Shipped' (Status, line 3) does not resolve against the vocabulary (2 terms)",
    )
    expect(finding?.bypassFilters).toBeUndefined()
  })

  it('violating-unread-form: a status in a form the rule does not read is reported', () => {
    const v = rule(fixture(NAME, 'violating-unread-form')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/login.md:3')
    expect(finding?.file).toContain('violating-unread-form')
    expect(finding?.message).toBe(
      "found `**Status: open**` at line 3, in a form this rule does not read (bold-line); add 'bold-line' to forms, or rewrite the line",
    )
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
