/**
 * A reference-style link whose definition is missing is reported (bug 0558): `[text][label]` or
 * `[label][]` with no `[label]: url`, its definition deleted or renamed, is text to the parser, and
 * GitHub shows the brackets. It is not a link, so nothing in `links()` reads it. This is the family's
 * pattern for text of a shape the corpus names: `mentions()` with the corpus's own pattern, and an
 * absence rule over what it finds. A defined reference is a link, not text, so the pattern never
 * sees its brackets; a shortcut `[label]` is left out of the pattern, since a task box, `[WIP]` and
 * `> [!NOTE]` share its shape; and a match inside a link's text is left out with `areLinked()`.
 * A match in inline code, or written escaped, is still reported: eess-md has no public predicate
 * for either yet (bug 0571).
 */
import { areLinked, corpus, links, mentions, not } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-reference-with-no-definition-is-reported'

// `[text][label]` or `[label][]`: two bracket pairs, neither holding a bracket or a line break.
const REFERENCE = /\[[^[\]\n]+\]\[[^[\]\n]*\]/g

const rule = (cwd: string): ReturnType<typeof mentions> =>
  mentions(corpus({ cwd, roots: ['docs/**'] }), { pattern: REFERENCE })
    .that()
    .satisfy(not(areLinked()))
    .should()
    .notExist()
    .because('a reference whose definition is gone is not a link: GitHub shows its brackets')

describe('a reference-style link with no definition is reported', () => {
  it('clean: every reference has its definition; a task box, a shortcut and an alert are not references', () => {
    const cwd = fixture(NAME, 'clean')
    expect([...rule(cwd).violations()]).toEqual([])
    // An absence rule examines nothing when it holds, so the population is proven apart: the two
    // references were there, each read as a link with its definition.
    const references = links(corpus({ cwd, roots: ['docs/**'] }))
      .select({ label: 'link', identify: (l) => ({ name: l.url }) })
      .elements.filter((l) => l.definition !== undefined)
      .map((l) => `${l.definition?.label ?? ''} ${l.url}`)
    expect(references).toEqual(['setup ./setup.md', 'reference ./reference.md'])
  })

  it('violating-renamed-definition: a reference whose label lost its definition is reported at its line', () => {
    const v = rule(fixture(NAME, 'violating-renamed-definition')).violations()
    expect(v.map((f) => f.message)).toEqual(['docs/guide.md:3 should not exist'])
  })

  it('violating-deleted-definition: a collapsed reference with no definition is reported', () => {
    const v = rule(fixture(NAME, 'violating-deleted-definition')).violations()
    expect(v.map((f) => f.message)).toEqual(['docs/guide.md:3 should not exist'])
  })
})
