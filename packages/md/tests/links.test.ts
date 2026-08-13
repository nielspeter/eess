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

describe('links() — directory targets (bug 0086)', () => {
  const repoLinksCorpus = () =>
    corpus({
      roots: ['repo-links/board.md', 'repo-links/fixed/**', 'repo-links/indexed/**'],
      cwd: fixtureRoot,
    })

  it('a link to an existing directory with no index file is broken today (the bug)', () => {
    const v = links(repoLinksCorpus()).that().areInternal().should().resolve().violations()
    // Every directory-shaped link is flagged — the corpus is right, the gate is wrong.
    expect(v.map((x) => x.message).filter((m) => m.includes('fixed')).length).toBe(2)
  })

  it('resolve({ resolveDirectories: true }) resolves a real directory, slash or not', () => {
    const v = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: true })
      .violations()
    expect(v.some((x) => x.message.includes('"./fixed/"'))).toBe(false)
    expect(v.some((x) => x.message.includes('"./fixed"'))).toBe(false)
  })

  it('resolve({ resolveDirectories: true }) still flags a directory that does not exist', () => {
    const v = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: true })
      .violations()
    // The fix must not resolve everything — ./missing/ and ./missing stay broken.
    expect(v.map((x) => x.message).filter((m) => m.includes('missing')).length).toBe(2)
  })

  it('an ordinary file resolution is unaffected by resolveDirectories', () => {
    // The new directory branch is a fallback tried after the file index, not
    // a replacement for it — a link to a real file inside a directory that is
    // ALSO directory-linked elsewhere in the same corpus must keep resolving
    // via the normal path either way.
    const withOption = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: true })
      .violations()
    const withoutOption = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve()
      .violations()
    expect(withOption.some((x) => x.message.includes('0001-item.md'))).toBe(false)
    expect(withoutOption.some((x) => x.message.includes('0001-item.md'))).toBe(false)
  })

  it('tryIndex and resolveDirectories compose — a directory WITH an index resolves either way', () => {
    const v = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ tryIndex: 'index.md', resolveDirectories: true })
      .violations()
    expect(v.some((x) => x.message.includes('indexed'))).toBe(false)
  })

  it('resolveDirectories defaults to off — existing callers see no behaviour change', () => {
    const withOption = links(repoLinksCorpus()).that().areInternal().should().resolve().violations()
    const withoutOption = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: false })
      .violations()
    expect(withOption.length).toBe(withoutOption.length)
  })
})

describe('links() — broken-link messages name the near-miss (bug 0137)', () => {
  const repoLinksCorpus = () =>
    corpus({
      roots: ['repo-links/board.md', 'repo-links/fixed/**', 'repo-links/indexed/**'],
      cwd: fixtureRoot,
    })

  it('a real directory with resolveDirectories off says so, naming it exactly', () => {
    const v = links(repoLinksCorpus()).that().areInternal().should().resolve().violations()
    const fixedViolation = v.find((x) => x.message.includes('"./fixed/"'))
    // Exact match, not a loose pattern — a hint naming the wrong directory
    // would still satisfy /is a real directory/ + /resolveDirectories/.
    expect(fixedViolation?.message).toBe(
      'broken link: "./fixed/" does not resolve to a file in the repo — ' +
        '"repo-links/fixed" is a real directory; this check runs with resolveDirectories off',
    )
  })

  it('the same directory written with no trailing slash gets the hint too', () => {
    const v = links(repoLinksCorpus()).that().areInternal().should().resolve().violations()
    const fixedViolation = v.find((x) => x.message.includes('"./fixed"'))
    expect(fixedViolation?.message).toBe(
      'broken link: "./fixed" does not resolve to a file in the repo — ' +
        '"repo-links/fixed" is a real directory; this check runs with resolveDirectories off',
    )
  })

  it('a genuinely missing target keeps the generic message — the hint is not a blanket addition', () => {
    const v = links(repoLinksCorpus()).that().areInternal().should().resolve().violations()
    const missingViolation = v.find((x) => x.message.includes('"./missing/"'))
    expect(missingViolation?.message).toBe(
      'broken link: "./missing/" does not resolve to a file in the repo',
    )
  })

  it('the hint disappears once resolveDirectories is on — the link resolves instead of merely explaining itself', () => {
    const v = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: true })
      .violations()
    expect(v.some((x) => x.message.includes('"./fixed/"'))).toBe(false)
  })

  it('resolveDirectories on + a genuinely missing target still gets the plain message', () => {
    const v = links(repoLinksCorpus())
      .that()
      .areInternal()
      .should()
      .resolve({ resolveDirectories: true })
      .violations()
    const missingViolation = v.find((x) => x.message.includes('"./missing/"'))
    expect(missingViolation?.message).toBe(
      'broken link: "./missing/" does not resolve to a file in the repo',
    )
  })

  it('a rootDir ambiguity names WHICH candidate is real, not just that one is', () => {
    // site/ambiguous.md links /decoy/ with rootDir: 'site'. The repo-root
    // candidate ("decoy") is a real directory; the content-root candidate
    // ("site/decoy") is not. An unlabelled hint would report "decoy" as if
    // it were the page the author meant — it isn't, and toggling
    // resolveDirectories would resolve the wrong, unrelated directory.
    const c = corpus({ roots: ['site/ambiguous.md'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve({ rootDir: 'site' }).violations()
    const decoyViolation = v.find((x) => x.message.includes('"/decoy/"'))
    expect(decoyViolation?.message).toBe(
      'broken link: "/decoy/" does not resolve to a file in the repo — ' +
        '"decoy" (repo-root) is a real directory; this check runs with resolveDirectories off',
    )
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
