/**
 * A labelled value read inside a named section (plan 0505): every record states its State under
 * `## Status`. Read over the whole record, the feedback register's `**Status:**` items would conflict
 * with it; read in the section, they are not part of the question. A record without the section,
 * or with its State written elsewhere, is reported with that cause, not as "no field".
 */
import { corpus, docs } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-record-states-its-status-in-a-section'

const rule = (cwd: string) =>
  docs(corpus({ cwd, roots: ['records/**'] }))
    .should()
    .haveField({
      label: 'State',
      aliases: ['Status'],
      forms: ['bold'],
      region: { section: 'Status' },
    })
    .because('a record states where it stands, in one place')

describe('a record states its status in a section', () => {
  it('clean: each record has one State under Status, and the register is not read', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(2)
  })

  it('violating-no-status-section: the missing section is the cause', () => {
    const v = rule(fixture(NAME, 'violating-no-status-section')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/login.md')
    expect(finding?.file).toContain('violating-no-status-section')
    expect(finding?.message).toBe('no section "Status" to read State from (region)')
  })

  it('violating-state-outside-status: a State outside the section is reported at its line', () => {
    const v = rule(fixture(NAME, 'violating-state-outside-status')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/login.md:9')
    expect(finding?.message).toBe(
      'State at line 9 is outside the "Status" section (region); move it into the section, or change the region',
    )
  })
})
