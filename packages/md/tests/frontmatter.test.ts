import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, links, pointers, taskItems, terms } from '../src/index.js'

// Bug 0087: YAML front matter was parsed as a setext heading — the closing `---`
// turned the YAML above it into a depth-2 section named with its contents.
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/frontmatter')
const load = (name: string) => corpus({ roots: [`docs/${name}`], cwd: fixtureRoot })
const doc = (name: string) => {
  const d = load(name).documents()[0]
  if (d === undefined) throw new Error(`fixture ${name} not loaded`)
  return d
}
const firstNode = (name: string) => doc(name).root.children[0]?.type
const linkUrls = (name: string) =>
  links(load(name))
    .select({ label: 'link', identify: (l) => ({ name: l.url }) })
    .elements.map((l) => l.url)
const openBoxes = (name: string) =>
  taskItems(load(name))
    .that()
    .areOpen()
    .select({ label: 'box', identify: (t) => ({ name: t.text }) })
    .elements.map((t) => [t.line, t.text])

describe('YAML front matter (bug 0087)', () => {
  it('is not a section: only the real headings are', () => {
    expect(doc('page.md').sections.map((s) => [s.depth, s.line, s.name])).toEqual([
      [1, 8, 'Page'],
      [2, 12, 'Facts'],
    ])
  })

  it('is a yaml node carrying its raw text and start line — a comment and a URL included', () => {
    const first = doc('page.md').root.children[0]
    expect(first?.type).toBe('yaml')
    expect(first?.type === 'yaml' ? first.value : undefined).toBe(
      'title: A page\nstatus: draft\nowner: Platform team\n# a YAML comment\nhome: https://example.com',
    )
    expect(first?.position?.start.line).toBe(1)
  })

  it('leaves no phantom section in a table’s sectionPath', () => {
    expect(doc('page.md').tables[0]?.sectionPath).toEqual(['Page', 'Facts'])
    expect(doc('table-first.md').tables[0]?.sectionPath).toEqual([])
  })

  it('is still read by terms(), which scans text lines', () => {
    const seen = terms(load('page.md'), { label: /owner:/ })
      .select({ label: 'term', identify: (t) => ({ name: t.value }) })
      .elements.map((t) => t.value)
    expect(seen).toEqual(['Platform team'])
  })

  it('is still read by pointers(), which scans text lines outside code', () => {
    const rule = pointers(load('pointer.md')).should().resolve()
    const seen = rule
      .select({ label: 'pointer', identify: (p) => ({ name: p.raw }) })
      .elements.map((p) => [p.line, p.raw])
    expect(seen).toEqual([[3, 'src/thing.ts:2']])
    expect([...rule.rule({ id: 'test/pointer' }).violations()]).toEqual([])
  })

  it('parses with a byte-order mark and CRLF line endings', () => {
    expect(firstNode('crlf.md')).toBe('yaml')
    expect(doc('crlf.md').sections.map((s) => s.name)).toEqual(['Crlf'])
  })
})

describe('a line-1 `---` block that is not front matter is read as Markdown (bug 0087 review)', () => {
  it('a block holding a link into the repository: the link is still checked', () => {
    expect(firstNode('link-in-front-matter.md')).not.toBe('yaml')
    expect(linkUrls('link-in-front-matter.md')).toEqual(['missing-overview.md'])
  })

  it('a body opening with a rule: its open box and dead link stay visible', () => {
    expect(firstNode('swallow.md')).not.toBe('yaml')
    expect(openBoxes('swallow.md')).toEqual([[6, 'still open']])
    expect(linkUrls('swallow.md')).toEqual(['missing-swallow.md'])
  })

  it('valid YAML whose continuation lines carry a task box and a link: both stay visible', () => {
    expect(firstNode('indented.md')).not.toBe('yaml')
    // Bug 0507: a box's text is collapsed across its lines.
    expect(openBoxes('indented.md')).toEqual([[4, 'still open Next: finish the migration']])
    expect(linkUrls('indented.md')).toEqual(['missing-indented.md'])
  })

  it('valid YAML carrying only a task box on a continuation line: the box stays visible', () => {
    expect(firstNode('box-only.md')).not.toBe('yaml')
    expect(openBoxes('box-only.md')).toEqual([[4, 'still open']])
  })

  it('a YAML sequence is not front matter: front matter is a mapping', () => {
    expect(firstNode('sequence.md')).not.toBe('yaml')
  })

  it('YAML with an error is not front matter, though the library returns a mapping beside it', () => {
    expect(firstNode('duplicate-key.md')).not.toBe('yaml')
    expect(firstNode('two-documents.md')).not.toBe('yaml')
    expect(openBoxes('two-documents.md')).toEqual([[4, 'open x']])
  })

  it('an empty block, a blank first line and an unterminated block are not front matter', () => {
    expect(firstNode('empty.md')).not.toBe('yaml')
    expect(firstNode('blank-first-line.md')).not.toBe('yaml')
    expect(firstNode('unterminated.md')).not.toBe('yaml')
    expect(linkUrls('unterminated.md')).toEqual(['missing-unterminated.md'])
  })
})
