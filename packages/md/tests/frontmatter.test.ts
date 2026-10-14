import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, links, pointers, terms } from '../src/index.js'

// Bug 0087: YAML front matter was parsed as a setext heading — the closing `---`
// turned the YAML above it into a depth-2 section named with its contents.
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/frontmatter')
const page = () => {
  const doc = corpus({ roots: ['docs/page.md'], cwd: fixtureRoot }).documents()[0]
  if (doc === undefined) throw new Error('fixture not loaded')
  return doc
}

describe('YAML front matter (bug 0087)', () => {
  it('is not a section: only the real headings are', () => {
    expect(page().sections.map((s) => [s.depth, s.line, s.name])).toEqual([
      [1, 7, 'Page'],
      [2, 11, 'Facts'],
    ])
  })

  it('is a yaml node carrying its raw text and start line', () => {
    const first = page().root.children[0]
    expect(first?.type).toBe('yaml')
    expect(first?.type === 'yaml' ? first.value : undefined).toBe(
      'title: A page\nstatus: draft\nowner: Platform team\nsources: see [the overview](overview.md)',
    )
    expect(first?.position?.start.line).toBe(1)
  })

  it('leaves no phantom section in a table’s sectionPath', () => {
    expect(page().tables[0]?.sectionPath).toEqual(['Page', 'Facts'])
    const first = corpus({ roots: ['docs/table-first.md'], cwd: fixtureRoot }).documents()[0]
    expect(first?.tables[0]?.sectionPath).toEqual([])
  })

  it('is still read by terms(), which scans text lines', () => {
    const c = corpus({ roots: ['docs/page.md'], cwd: fixtureRoot })
    const seen = terms(c, { label: /owner:/ })
      .select({ label: 'term', identify: (t) => ({ name: t.value }) })
      .elements.map((t) => t.value)
    expect(seen).toEqual(['Platform team'])
  })

  it('is still read by pointers(), which scans text lines outside code', () => {
    const c = corpus({ roots: ['docs/pointer.md'], cwd: fixtureRoot })
    const rule = pointers(c).should().resolve()
    const seen = rule
      .select({ label: 'pointer', identify: (p) => ({ name: p.raw }) })
      .elements.map((p) => [p.line, p.raw])
    expect(seen).toEqual([[3, 'src/thing.ts:2']])
    expect([...rule.rule({ id: 'test/pointer' }).violations()]).toEqual([])
  })

  it('holds no links: YAML is not rendered as Markdown, so a link in it is text', () => {
    const c = corpus({ roots: ['docs/page.md'], cwd: fixtureRoot })
    const urls = links(c)
      .select({ label: 'link', identify: (l) => ({ name: l.url }) })
      .elements.map((l) => l.url)
    expect(urls).toEqual(['other.md'])
  })
})
