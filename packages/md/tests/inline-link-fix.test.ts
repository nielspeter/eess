import { describe, expect, it } from 'vitest'
import { corpusFromText, links } from '../src/index.js'

// Bug 0563: an inline link's fix span was the last match of the decoded URL in the link's raw text,
// so a title holding the same text, or an escaped destination, got the fix instead of the URL.

const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()

describe('an inline link’s fix rewrites its URL, never its title (bug 0563)', () => {
  it('a title equal to the URL: the fix is over the URL', () => {
    const text = '# A\n\nSee [x](./old/moved.md "./old/moved.md").\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/new/moved.md': '# M\n' })
    const fix = v[0]?.fix
    expect(fix?.start).toBe(text.indexOf('./old/moved.md'))
    expect(text.slice(fix?.start, fix?.end)).toBe('./old/moved.md')
  })

  it('link text equal to the URL: the fix is over the URL, after the text', () => {
    const text = '# A\n\nSee [./old/moved.md](./old/moved.md).\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/new/moved.md': '# M\n' })
    expect(v[0]?.fix?.start).toBe(text.lastIndexOf('./old/moved.md'))
  })

  it('an escaped destination whose title holds the decoded URL gets no fix', () => {
    const text = '# A\n\nSee [x](<./old/a\\>b.md> "./old/a>b.md").\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/new/a>b.md': '# M\n' })
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./old/a>b.md" does not resolve to a file in the repo',
    ])
    expect(v[0]?.fix).toBeUndefined()
  })

  it('an angle-bracketed URL, and a plain one with a title, get their fix over the URL', () => {
    for (const text of [
      '# A\n\nSee [x](<./old/moved.md>).\n',
      '# A\n\nSee [x](./old/moved.md "Moved").\n',
    ]) {
      const v = resolveOf({ 'docs/a.md': text, 'docs/new/moved.md': '# M\n' })
      expect(text.slice(v[0]?.fix?.start, v[0]?.fix?.end)).toBe('./old/moved.md')
    }
  })
})
