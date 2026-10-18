/**
 * A document's shape, from public blocks only: every page under `guides/` has a `Prerequisites`
 * section. One rule, written in the caller's own words, with no predicate or condition built by hand.
 */
import { corpus, docs } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-page-has-a-required-section'

const rule = (cwd: string): ReturnType<typeof docs> =>
  docs(corpus({ cwd, roots: ['**/*.md'] }))
    .that()
    .resideInFolder('guides/**')
    .should()
    .haveSection('Prerequisites')
    .because('a guide states what it assumes')

describe('a page has a required section', () => {
  it('clean: every guide has the section', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // Two guides are examined; the home page is not a guide, so the selector leaves it out.
    expect(v.examined).toBe(2)
  })

  it('violating-missing-section: a guide without the section is reported', () => {
    const v = rule(fixture(NAME, 'violating-missing-section')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    // The violating guide, by its path in the corpus and on disk.
    expect(finding?.element).toBe('guides/install.md')
    expect(finding?.file).toContain('violating-missing-section')
    expect(finding?.message).toBe('missing section "Prerequisites"')
    // A finding about the document, not a configuration finding about the rule.
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
