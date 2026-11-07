/**
 * Proposal 026's rule (plan 0582): a record's `Relations` sections must include at least one that
 * cites code. A record may hold several, and one may only link other records. Two rules read one
 * const:
 *
 * - the conditional rule (records that have the section must have one that cites code), whose own
 *   selection is its guard: a misspelt const selects nothing, and the rule reds with the kernel's
 *   zero-examined finding;
 * - the strict rule (every record has such a section), which also reds a record with none.
 *
 * Written as an absence rule (`satisfy(not(predicateHaveSection(...))).should().notExist()`), the
 * conditional rule would be green over nothing and would need a guard rule beside it.
 */
import { corpus, docs, sectionsWithCodePointer } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-relations-section-cites-code'
const load = (cwd: string) => corpus({ cwd, roots: ['records/**/*.md'] })

const RELATIONS = 'Relations'
const CITES_CODE = { satisfying: sectionsWithCodePointer() }

const conditional = (cwd: string, name: string = RELATIONS) =>
  docs(load(cwd))
    .that()
    .haveSection(name)
    .should()
    .haveSection(name, CITES_CODE)
    .because('a record that relates to others says where the code is')

const strict = (cwd: string) =>
  docs(load(cwd))
    .should()
    .haveSection(RELATIONS, CITES_CODE)
    .because('every record says where its code is')

describe('a Relations section cites code', () => {
  it('clean: every record has a Relations section that cites code; one link-only section beside it is fine', () => {
    const cwd = fixture(NAME, 'clean')
    const v = conditional(cwd).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(3)
    expect(strict(cwd).violations()).toHaveLength(0)
  })

  it('clean: a misspelt const reds the conditional rule by itself', () => {
    const v = conditional(fixture(NAME, 'clean'), 'Relatons').violations()
    expect(v.map((x) => x.message)).toEqual([expect.stringMatching(/examined zero/)])
  })

  it('violating-links-only: a record whose only Relations section links but cites no code is reported at the section', () => {
    const cwd = fixture(NAME, 'violating-links-only')
    const v = conditional(cwd).violations()
    expect(v.map((x) => `${x.element}: ${x.message.split('\n')[0] ?? ''}`)).toEqual([
      'records/search.md:3: section "Relations" does not satisfy "hold a code pointer", and no section "Relations" in this document does',
    ])
    expect(strict(cwd).violations()).toHaveLength(1)
  })

  it('violating-no-section: a record with no Relations section is out of the conditional rule, and the strict rule reports it', () => {
    const cwd = fixture(NAME, 'violating-no-section')
    expect(conditional(cwd).violations()).toHaveLength(0)
    const v = strict(cwd).violations()
    expect(v.map((x) => `${x.element}: ${x.message.split('\n')[0] ?? ''}`)).toEqual([
      'records/search.md: missing section "Relations"',
    ])
  })
})
