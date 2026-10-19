/**
 * A rule inside each matching section (proposal 017, block 11): every `Phase N` section of a plan
 * has a `Files changed` subsection. `sections()` makes each heading an element with the lines it
 * governs, so the requirement is stated per phase, not per plan. A phase heading or a `Files changed`
 * heading written inside a list item does not start a section; the rule names it rather than reading
 * past it.
 *
 * A plan with no `Phase` section at all is not a finding of this rule: pair it with
 * `docs(c).that().resideInFolder('plans/**').should().haveSection(/^Phase \d+/)`.
 */
import { corpus, inDocuments, resideInFolder, sections } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'each-phase-lists-its-files'

const rule = (cwd: string) =>
  sections(corpus({ cwd, roots: ['**/*.md'] }))
    .that()
    .areNamed(/^Phase \d+/)
    .and()
    .satisfy(inDocuments(resideInFolder('plans/**')))
    .should()
    .haveSubsection('Files changed')
    .because('a phase says which files it touches')

describe('each phase lists its files', () => {
  it('clean: every phase of every plan has the subsection, at any depth below it', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // Three phases across two plans; notes.md is not a plan, so its Phase 1 is not selected.
    expect(v.examined).toBe(3)
  })

  it('violating-missing-subsection: the subsection under the next phase does not count', () => {
    const v = rule(fixture(NAME, 'violating-missing-subsection')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('plans/0001-parser.md:3')
    expect(finding?.file).toContain('violating-missing-subsection')
    expect(finding?.message).toBe('section "Phase 1: tokens" has no subsection "Files changed"')
    expect(finding?.bypassFilters).toBeUndefined()
  })

  it('violating-heading-in-a-list: a heading in a list item is named, once', () => {
    const v = rule(fixture(NAME, 'violating-heading-in-a-list')).violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toBe(
      'section "Phase 1: tokens" has no subsection "Files changed"; the heading "Files changed" ' +
        'at line 5 is inside a list item, which does not start a section',
    )
  })

  it('violating-phase-heading-in-a-list: a phase the rule cannot read is named', () => {
    const v = rule(fixture(NAME, 'violating-phase-heading-in-a-list')).violations()
    // The listed phase, and the subsection inside the same list item: each a heading the rule
    // cannot read, each named once.
    expect(v.map((x) => `${x.element}: ${x.message}`)).toEqual([
      'plans/0001-parser.md → section "Phase 2: the tree" (in a list item): the heading ' +
        '"Phase 2: the tree" at line 9 is inside a list item, which does not start a section, so ' +
        'this rule does not read it',
      'plans/0001-parser.md → section "Files changed" (in a list item): the heading ' +
        '"Files changed" at line 11 is inside a list item, which does not start a section, so ' +
        'this rule does not read it',
    ])
  })
})
