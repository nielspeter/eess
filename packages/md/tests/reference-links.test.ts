import { describe, expect, it } from 'vitest'
import { corpusFromText, links, sections } from '../src/index.js'

// Bug 0558: a reference-style link — `[text][label]`, `[label][]`, `[label]`, its URL in a
// definition `[label]: url` elsewhere — renders as a link, and `links()` read inline links only,
// so a broken one passed and `examined` left it out.

const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()

describe('links() reads a reference-style link (bug 0558)', () => {
  const broken = {
    'docs/a.md': [
      '# A',
      '',
      'A [full][gone] link, a [collapsed][] one, a [shortcut] one and a [numbered][1] one.',
      '',
      'And [one that resolves][ok], and [Text][FOO] by a label in another case.',
      '',
      '[gone]: ./gone-full.md',
      '[collapsed]: ./gone-collapsed.md',
      '[shortcut]: ./gone-shortcut.md',
      '[1]: ./gone-numbered.md',
      '[ok]: ./b.md',
      '[foo]: ./gone-case.md',
      '',
    ].join('\n'),
    'docs/b.md': '# B\n',
  }

  it('a broken reference link of each form is reported at its definition, naming the label', () => {
    expect(resolveOf(broken).map((v) => `${String(v.line)} ${v.message}`)).toEqual([
      '7 broken link: "./gone-full.md" does not resolve to a file in the repo (the definition of [gone])',
      '8 broken link: "./gone-collapsed.md" does not resolve to a file in the repo (the definition of [collapsed])',
      '9 broken link: "./gone-shortcut.md" does not resolve to a file in the repo (the definition of [shortcut])',
      '10 broken link: "./gone-numbered.md" does not resolve to a file in the repo (the definition of [1])',
      '12 broken link: "./gone-case.md" does not resolve to a file in the repo (the definition of [foo])',
    ])
  })

  it('examined counts each reference link', () => {
    expect(resolveOf(broken).examined).toBe(6)
  })

  it('a label matches its definition by Unicode case fold, as the spec says', () => {
    const v = resolveOf({
      'docs/a.md': '# A\n\nSee [the street][STRASSE].\n\n[straße]: ./gone.md\n',
    })
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./gone.md" does not resolve to a file in the repo (the definition of [straße])',
    ])
  })

  it('one definition used by several references is one finding, at the definition', () => {
    const v = resolveOf({
      'docs/a.md': '# A\n\nFirst [a][d], then [b][d], then [c][d].\n\n[d]: ./gone.md\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '5 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [d])',
    ])
    expect(v.examined).toBe(3)
  })

  it('a moved target gets one fix, over the definition’s URL', () => {
    const text = '# A\n\n[a][d] and [b][d].\n\n[d]: ./old/moved.md\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/new/moved.md': '# Moved\n' })
    expect(v).toHaveLength(1)
    const fix = v[0]?.fix
    expect(fix?.replacement).toBe('./new/moved.md')
    expect(text.slice(fix?.start, fix?.end)).toBe('./old/moved.md')
  })

  it('a reference link that resolves, and the text of an undefined one, produce nothing', () => {
    const v = resolveOf({
      'docs/a.md': '# A\n\n[b][ok], and [WIP] and > [!NOTE] text.\n\n[ok]: ./b.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
  })
})

describe('beLinkedBack() counts a link back written as a reference (bug 0558)', () => {
  it('a link back by reference answers the link', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\n**Related to:** [B](./b.md)\n',
      'docs/b.md': '# B\n\n**Related to:** [A][a]\n\n[a]: ./a.md\n',
    })
    const v = links(c).that().areLabelled('Related to').should().beLinkedBack().violations()
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(2)
  })
})

describe('areLabelled() reads a declaration of reference links (bug 0558)', () => {
  it('a reference link in a declaration is selected and resolved, not reported unread', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\n**Related to:** [c](./c.md) and [d][d]\n\n[d]: ./gone.md\n',
      'docs/c.md': '# C\n',
    })
    const v = links(c).that().areLabelled('Related to').should().resolve().violations()
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./gone.md" does not resolve to a file in the repo (the definition of [d])',
    ])
    expect(v.examined).toBe(2)
  })
})

describe('sections().haveLink() holds for a reference-style link (bug 0558)', () => {
  it('a section whose only link is reference-style holds a link', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\n## With\n\nSee [b][b].\n\n## Without\n\nNo link.\n\n[b]: ./b.md\n',
    })
    const held = sections(c)
      .that()
      .haveLink()
      .select({ label: 'section', identify: (x) => ({ name: x.name }) })
      .elements.map((x) => x.name)
    expect(held).toEqual(['A', 'With'])
  })
})
