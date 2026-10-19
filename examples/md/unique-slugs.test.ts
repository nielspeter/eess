/**
 * No two pages share a slug (proposal 017, block 13): a page publishes at its file name, so two
 * pages named alike in different folders would publish at one URL. One `beUniqueBy()` rule, keyed by
 * the caller's own slug, with nothing built by hand.
 */
import { corpus, docs, type MdDocument } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'unique-slugs'

/** A page's slug: its file name without the folder or `.md`. Normalising is the caller's. */
const slug = (d: MdDocument): string => d.relPath.replace(/^.*\/|\.md$/g, '')

const rule = (cwd: string): ReturnType<typeof docs> =>
  docs(corpus({ cwd, roots: ['guides/**'] }))
    .should()
    .beUniqueBy(slug, 'slug')
    .because('a page publishes at its slug')

describe('no two pages share a slug', () => {
  it('clean: every guide has its own slug', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    expect(v.examined).toBe(2)
  })

  it('violating-shared-slug: both pages of a shared slug are reported, each naming the other', () => {
    const v = rule(fixture(NAME, 'violating-shared-slug')).violations()
    expect(v.map((f) => f.message)).toEqual([
      'guides/admin/install.md has the same slug as 1 other: guides/getting-started/install.md:1',
      'guides/getting-started/install.md has the same slug as 1 other: guides/admin/install.md:1',
    ])
    for (const finding of v) {
      expect(finding.file).toContain('violating-shared-slug')
      // A finding about a page, not a configuration finding about the rule.
      expect(finding.bypassFilters).toBeUndefined()
    }
  })
})
