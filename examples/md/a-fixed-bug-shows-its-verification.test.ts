/**
 * A rule that depends on a document's value (proposal 017, block 2): every bug whose Status is
 * `fixed` has a `Verification` section. `haveField` selects the fixed bugs; a bug whose Status cannot
 * be read (written in a form the rule does not read, given twice) is reported, never left out
 * silently. A misspelt Status is a different value, so pair this with `fields(...).resolveAgainst()`.
 */
import { corpus, docs, untilDelimiter } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-fixed-bug-shows-its-verification'

const rule = (cwd: string): ReturnType<typeof docs> =>
  docs(corpus({ cwd, roots: ['bugs/**'] }))
    .that()
    .haveField({
      label: 'Status',
      forms: ['bold', 'heading'],
      value: untilDelimiter(['—']),
      oneOf: /fixed/i,
    })
    .should()
    .haveSection('Verification')
    .because('a fixed bug says how the fix was checked')

describe('a fixed bug shows its verification', () => {
  it('clean: the fixed bug has a Verification section; the open one is not selected', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(1)
  })

  it('violating-missing-verification: a fixed bug without the section is reported', () => {
    const v = rule(fixture(NAME, 'violating-missing-verification')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('bugs/login.md')
    expect(finding?.file).toContain('violating-missing-verification')
    expect(finding?.message).toBe('missing section "Verification"')
    expect(finding?.bypassFilters).toBeUndefined()
  })

  it('violating-unread-status: a Status in a form the rule does not read is reported, not skipped', () => {
    const v = rule(fixture(NAME, 'violating-unread-status')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('bugs/export.md:3')
    expect(finding?.file).toContain('violating-unread-status')
    expect(finding?.message).toBe(
      "found `**Status: fixed**` at line 3, in a form this rule does not read (bold-line); add 'bold-line' to forms, or rewrite the line",
    )
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
