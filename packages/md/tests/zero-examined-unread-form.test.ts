import { describe, expect, it } from 'vitest'
import { corpusFromText, links } from '../src/index.js'

// Bug 0589: over a corpus whose links are all written in a form `links()` does not read (wikilinks),
// the zero-examined finding offered `.expectEmpty()` as its one concrete remedy, and declaring it
// turned the rule green with no link checked. The message now names that cause with its own remedy,
// and keeps `.expectEmpty()` for a source that is legitimately empty.

const vault = {
  'a.md': '# A\n\nSee [[Missing Page]] and [[Other|label]].\n',
  'b.md': '# B\n\nBack to [[A]].\n',
}

describe('a zero-examined rule names a form it does not read as a cause (bug 0589)', () => {
  it('over wikilinks only, the message names the unread form and does not offer .expectEmpty() for it', () => {
    const v = links(corpusFromText(vault)).should().resolve().violations()
    expect(v.examined).toBe(0)
    const message = v[0]?.message ?? ''
    expect(message).toMatch(/written in a form this rule does not read/)
    expect(message).toMatch(/write them in a form the rule reads/)
    // `.expectEmpty()` is offered only for the legitimately empty source, and named last.
    expect(message).toMatch(/only then declare it with \.expectEmpty\(\)/)
    expect(message.indexOf('.expectEmpty()')).toBeGreaterThan(message.indexOf('does not read'))
  })

  it('the remedy for that cause clears the finding by examining the links, not by declaring them away', () => {
    const rewritten = {
      'a.md': '# A\n\nSee [Missing Page](./missing-page.md) and [label](./other.md).\n',
      'b.md': '# B\n\nBack to [A](./a.md).\n',
    }
    const v = links(corpusFromText(rewritten)).should().resolve().violations()
    expect(v.examined).toBe(3)
    expect(v.map((x) => x.message.split(':')[0])).toEqual(['broken link', 'broken link'])
  })

  it('a link this rule reports unread keeps the rule red under .expectEmpty()', () => {
    const c = corpusFromText({ 'docs/p.md': '# P\n\nsee <a href=./a.md title=a/b>x</a>\n' })
    const v = links(c).should().resolve().expectEmpty().violations()
    expect(v.map((x) => x.ruleId)).toEqual(['md/unread-link'])
  })

  it('a corpus with no link in any form, declared empty, stays green', () => {
    const v = links(corpusFromText({ 'a.md': '# A\n\nNo links here.\n' }))
      .should()
      .resolve()
      .expectEmpty()
      .violations()
    expect([...v]).toEqual([])
  })
})
