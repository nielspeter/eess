/**
 * A corpus built from text, for testing a rule: every link resolves. The documents are handed to
 * `corpusFromText` as a map of path → text, so a test needs no directory on disk; here the map is
 * read from the fixture folders so this repository can swap them. Links resolve as `corpus()`
 * resolves them over the same files (plan 0455).
 */
import { corpusFromText, links } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixtureFiles } from './fixture.js'

const NAME = 'corpus-from-text'

const rule = (files: Record<string, string>): ReturnType<typeof links> =>
  links(corpusFromText(files)).should().resolve().because('a reader follows every link')

describe('a corpus built from text', () => {
  it('clean: every link resolves', () => {
    const v = rule(fixtureFiles(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // Five links across three pages are examined.
    expect(v.examined).toBe(5)
  })

  it('violating-broken-link: a link to a missing page is reported', () => {
    const v = rule(fixtureFiles(NAME, 'violating-broken-link')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    // The broken link, by its page's path in the map.
    expect(finding?.element).toBe('guides/install.md → ./configuring.md')
    expect(finding?.file).toMatch(/guides\/install\.md$/)
    expect(finding?.message).toBe(
      'broken link: "./configuring.md" does not resolve to a file in the repo',
    )
    // A finding about the document, not a configuration finding about the rule.
    expect(finding?.bypassFilters).toBeUndefined()
  })
})
