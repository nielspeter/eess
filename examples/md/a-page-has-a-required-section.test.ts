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
    expect(v.examined).toBeGreaterThan(0)
  })

  it('violating-missing-section: a guide without the section is reported', () => {
    const v = rule(fixture(NAME, 'violating-missing-section')).violations()
    expect(
      v.map((x) => [x.file.endsWith('guides/install.md'), x.message, x.bypassFilters]),
    ).toEqual([[true, 'missing section "Prerequisites"', undefined]])
  })
})
