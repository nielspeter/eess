import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, links } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')

describe('links()', () => {
  it('resolve() flags exactly the broken internal link', () => {
    const c = corpus({ roots: ['docs/*.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve().violations()
    // Only ./missing.md is broken. Valid (./bad.md), anchored (./good.md#…),
    // external (https://…), and fenced (./should-not-count.md) are NOT flagged.
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/broken link/)
    expect(v[0]?.message).toMatch(/missing\.md/)
  })

  it('ignores links inside fenced code (would be broken if extracted)', () => {
    const c = corpus({ roots: ['docs/links.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve().violations()
    expect(v.some((x) => x.message.includes('should-not-count.md'))).toBe(false)
  })

  it('external links are never flagged by resolve()', () => {
    const c = corpus({ roots: ['docs/links.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve().violations()
    expect(v.some((x) => x.message.includes('example.com'))).toBe(false)
  })

  it('anchored internal link resolves by its file part', () => {
    const c = corpus({ roots: ['docs/links.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve().violations()
    expect(v.some((x) => x.message.includes('good.md'))).toBe(false)
  })

  it('resolve() without options flags extensionless static-site links', () => {
    const c = corpus({ roots: ['site/home.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve().violations()
    // As written, ./guide and ./guide/ don't name files — both flagged.
    expect(v.map((x) => x.message).filter((m) => m.includes('./guide')).length).toBe(2)
  })

  it('resolve({ tryExtensions, tryIndex }) resolves extensionless and directory links', () => {
    const c = corpus({ roots: ['site/home.md'], cwd: fixtureRoot })
    const v = links(c)
      .that()
      .areInternal()
      .should()
      .resolve({ tryExtensions: ['.md'], tryIndex: 'index.md' })
      .violations()
    // ./guide → guide.md, ./guide/ → guide/index.md; only ./nowhere stays broken.
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/nowhere/)
  })
})

describe('links() — rootDir (site-absolute links)', () => {
  it('resolves leading-/ links against the content root', () => {
    const c = corpus({ roots: ['site/absolute.md'], cwd: fixtureRoot })
    const v = links(c)
      .that()
      .areInternal()
      .should()
      .resolve({ tryExtensions: ['.md'], tryIndex: 'index.md', rootDir: 'site' })
      .violations()
    // /guide → site/guide.md resolves; /no-such-page and ./nowhere stay broken.
    expect(v.some((x) => x.message.includes('/guide"'))).toBe(false)
    expect(v.some((x) => x.message.includes('no-such-page'))).toBe(true)
  })
})
