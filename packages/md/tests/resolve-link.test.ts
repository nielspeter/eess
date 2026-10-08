import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  corpus,
  links,
  resolveLink,
  type LinkResolveOptions,
  type LinkTarget,
  type LinkToResolve,
} from '../src/index.js'

// Plan 0404. The source document sits in a subdirectory, so a resolver that
// returns the URL unchanged cannot pass a row by accident.
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/resolve-link')
const SOURCE = 'docs/sub/source.md'

function load() {
  return corpus({
    roots: ['docs/**'],
    ignore: ['docs/ignored/**', 'outside/ign.md'],
    cwd: fixtureRoot,
  })
}

const link = (url: string, external = false): LinkToResolve => ({
  url,
  external,
  doc: { relPath: SOURCE },
})

const resolve = (url: string, options?: LinkResolveOptions): LinkTarget =>
  resolveLink(link(url), load(), options)

describe('resolveLink() — the spelling table (plan 0404)', () => {
  it.each([
    ['./a.md', 'docs/sub/a.md'],
    ['a.md', 'docs/sub/a.md'],
    ['a.md#x', 'docs/sub/a.md'],
    ['../b.md', 'docs/b.md'],
    ['../a%20b.md', 'docs/a b.md'],
    ['/docs/b.md', 'docs/b.md'],
  ])('%s is the document %s', (url, path) => {
    const target = resolve(url)
    expect(target.kind).toBe('document')
    if (target.kind !== 'document') return
    expect(target.path).toBe(path)
    expect(target.doc.relPath).toBe(path)
  })

  it('a site-absolute link with rootDir resolves through the content root', () => {
    const target = resolve('/b.md', { rootDir: 'docs' })
    expect(target).toMatchObject({ kind: 'document', path: 'docs/b.md' })
    if (target.kind === 'document') expect(target.doc.relPath).toBe('docs/b.md')
  })

  it('with rootDir, an existing repo-root file wins over the content root', () => {
    // Both candidates exist: docs/b.md as written, and docs/docs/b.md under the
    // content root. Order is repo-root first, so docs/b.md wins.
    expect(resolve('/docs/b.md', { rootDir: 'docs' })).toMatchObject({
      kind: 'document',
      path: 'docs/b.md',
    })
  })

  it.each(['#x', './source.md', 'source.md#x', '../sub/source.md'])(
    '%s from the source itself is self',
    (url) => {
      expect(resolve(url)).toEqual({ kind: 'self' })
    },
  )

  it('an extensionless link resolves with tryExtensions, and is missing without it', () => {
    const guide = resolve('./guide', { tryExtensions: ['.md'] })
    expect(guide).toMatchObject({ kind: 'document', path: 'docs/sub/guide.md' })
    if (guide.kind === 'document') expect(guide.doc.relPath).toBe('docs/sub/guide.md')
    expect(resolve('./guide')).toEqual({ kind: 'missing', tried: ['docs/sub/guide'] })
  })

  it('a directory link resolves through tryIndex', () => {
    const manual = resolve('./manual/', { tryIndex: 'index.md' })
    expect(manual).toMatchObject({ kind: 'document', path: 'docs/sub/manual/index.md' })
    if (manual.kind === 'document') expect(manual.doc.relPath).toBe('docs/sub/manual/index.md')
  })

  it('a directory with no file candidate is a directory, whatever resolveDirectories says', () => {
    expect(resolve('./folder/')).toEqual({ kind: 'directory', path: 'docs/sub/folder' })
    expect(resolve('./folder', { resolveDirectories: true })).toEqual({
      kind: 'directory',
      path: 'docs/sub/folder',
    })
  })

  it('a file and a same-named directory: the file wins', () => {
    const both = resolve('./both', { tryExtensions: ['.md'] })
    expect(both).toMatchObject({ kind: 'document', path: 'docs/sub/both.md' })
    if (both.kind === 'document') expect(both.doc.relPath).toBe('docs/sub/both.md')
  })

  it('a file outside the roots is not-in-corpus, outside-roots', () => {
    expect(resolve('../../outside/out.md')).toEqual({
      kind: 'not-in-corpus',
      path: 'outside/out.md',
      reasons: ['outside-roots'],
    })
  })

  it('a non-Markdown file inside the roots is not-in-corpus, not-markdown', () => {
    expect(resolve('./pic.png')).toEqual({
      kind: 'not-in-corpus',
      path: 'docs/sub/pic.png',
      reasons: ['not-markdown'],
    })
  })

  it('an ignored file is not-in-corpus, ignored', () => {
    expect(resolve('../ignored/i.md')).toEqual({
      kind: 'not-in-corpus',
      path: 'docs/ignored/i.md',
      reasons: ['ignored'],
    })
  })

  it('an ignored file outside the roots lists both reasons', () => {
    expect(resolve('../../outside/ign.md')).toEqual({
      kind: 'not-in-corpus',
      path: 'outside/ign.md',
      reasons: ['ignored', 'outside-roots'],
    })
  })

  it('a missing file lists every candidate it tried, in order', () => {
    expect(resolve('./nope', { tryExtensions: ['.md', '.mdx'], tryIndex: 'index.md' })).toEqual({
      kind: 'missing',
      tried: ['docs/sub/nope', 'docs/sub/nope.md', 'docs/sub/nope.mdx', 'docs/sub/nope/index.md'],
    })
  })

  it('a missing site-absolute link with rootDir lists both roots', () => {
    expect(resolve('/nothere.md', { rootDir: 'docs' })).toEqual({
      kind: 'missing',
      tried: ['nothere.md', 'docs/nothere.md'],
    })
  })

  describe('a built-in ignored folder', () => {
    // The file must really exist, or this row passes whatever corpus() walks.
    // It cannot be committed (node_modules is gitignored), so it is written here.
    const dir = join(fixtureRoot, 'node_modules', 'pkg')
    beforeAll(() => {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'readme.md'), '# A package readme\n')
    })
    afterAll(() => {
      rmSync(join(fixtureRoot, 'node_modules'), { recursive: true, force: true })
    })

    it('an existing file in node_modules is missing, since that folder is never walked', () => {
      expect(resolve('../../node_modules/pkg/readme.md')).toEqual({
        kind: 'missing',
        tried: ['node_modules/pkg/readme.md'],
      })
    })
  })

  it('a hand-built Corpus without registered matchers reports outside-roots', () => {
    const c = load()
    const handBuilt = { documents: () => c.documents(), root: c.root, fileIndex: c.fileIndex }
    // An ignored file: corpus() would say ignored; a corpus it did not build cannot.
    expect(resolveLink(link('../ignored/i.md'), handBuilt)).toEqual({
      kind: 'not-in-corpus',
      path: 'docs/ignored/i.md',
      reasons: ['outside-roots'],
    })
  })

  it('an empty link is self', () => {
    expect(resolve('')).toEqual({ kind: 'self' })
  })

  it('malformed percent-encoding is missing, not a thrown error', () => {
    expect(resolve('./bad%E0.md')).toEqual({ kind: 'missing', tried: ['./bad%E0.md'] })
  })

  it('an external link is external', () => {
    expect(resolveLink(link('https://example.com/a.md', true), load())).toEqual({
      kind: 'external',
    })
  })
})

describe('resolveLink() and linkResolves agree (plan 0404)', () => {
  it('resolve() flags exactly the links resolveLink calls missing or a directory', () => {
    const c = load()
    const flagged = links(c)
      .that()
      .areInternal()
      .should()
      .resolve()
      .violations()
      .map((x) => x.element)
      .sort()
    const expected = links(c)
      .that()
      .areInternal()
      .select({ label: 'link', identify: (l) => ({ name: `${l.doc.relPath} → ${l.url}` }) })
      .elements.filter((l) => {
        const kind = resolveLink(l, c).kind
        return kind === 'missing' || kind === 'directory'
      })
      .map((l) => `${l.doc.relPath} → ${l.url}`)
      .sort()
    // Without options, ./both names only the directory both/ (both.md needs
    // tryExtensions), so it is a directory here.
    expect(expected).toEqual([
      'docs/sub/source.md → ./bad%E0.md',
      'docs/sub/source.md → ./both',
      'docs/sub/source.md → ./folder/',
      'docs/sub/source.md → ./guide',
      'docs/sub/source.md → ./nope',
    ])
    expect(flagged).toEqual(expected)
  })
})

describe('linkResolves through resolveLink (plan 0404)', () => {
  it('a malformed percent-encoding is one plain broken-link finding, not a thrown error', () => {
    const v = links(load()).that().areInternal().should().resolve().violations()
    const bad = v.filter((x) => x.element.endsWith('./bad%E0.md'))
    expect(bad.map((x) => x.message)).toEqual([
      'broken link: "./bad%E0.md" does not resolve to a file in the repo',
    ])
  })

  it('a rootDir directory hint names the content root when that is the directory', () => {
    const c = corpus({ roots: ['site/**'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve({ rootDir: 'site' }).violations()
    expect(v.find((x) => x.element.endsWith('/sub/'))?.message).toBe(
      'broken link: "/sub/" does not resolve to a file in the repo — ' +
        '"site/sub" (content-root) is a real directory; this check runs with resolveDirectories off',
    )
  })

  it('when both roots hold the directory, the repo root is reported', () => {
    const c = corpus({ roots: ['site/**'], cwd: fixtureRoot })
    const v = links(c).that().areInternal().should().resolve({ rootDir: 'site' }).violations()
    expect(v.find((x) => x.element.endsWith('/shared/'))?.message).toBe(
      'broken link: "/shared/" does not resolve to a file in the repo — ' +
        '"shared" (repo-root) is a real directory; this check runs with resolveDirectories off',
    )
  })
})
