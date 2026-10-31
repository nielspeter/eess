import { describe, expect, it } from 'vitest'
import { corpusFromText, docs, links } from '../src/index.js'

// Bug 0566: the guard judged a line-1 `---` block by parsing the block alone, so a reference whose
// definition sits in the body was text to it, the block stayed front matter, and the link was never
// read. Bug 0087's rule is that the block is read as Markdown when it holds what a Markdown reader
// checks, exactly as before front matter was parsed: the whole document's parse decides.

const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()

describe('a front-matter block holding a reference defined in the body is read as Markdown (bug 0566)', () => {
  it('the reference is examined and its broken target reported', () => {
    const v = resolveOf({
      'docs/a.md': '---\na: |\n  See [g].\n---\n\n# A\n\n[ok](./b.md)\n\n[g]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g])',
    ])
    expect(v.examined).toBe(2)
  })

  it('a block whose reference is to an external definition stays front matter', () => {
    const text = '---\na: |\n  See [g].\n---\n\n# A\n\n[ok](./b.md)\n\n[g]: https://example.com\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
    // Read as Markdown, the block would be a phantom first heading; front matter, the title is `A`.
    expect(titleOf(text)).toEqual([])
  })

  it('front matter with a list beside an internal link in the body stays front matter', () => {
    expect(titleOf('---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n\n[ok](./adr.md)\n')).toEqual([])
  })
})

// Bug 0410: a block read as Markdown said nothing; the title finding now names why.
const titleOf = (text: string, name?: string): string[] =>
  docs(corpusFromText({ 'docs/a.md': text, 'docs/adr.md': `# ${name ?? 'ADR'}\n` }))
    .should()
    .haveTitle(name)
    .violations()
    .map((x) => x.message)

describe('a title finding names why the front matter was read as Markdown (bug 0410)', () => {
  it('a duplicate key: the YAML error and its line', () => {
    expect(titleOf('---\ntitle: a\ntitle: b\n---\n\n# Doc\n')).toEqual([
      'no title: the first heading, "title: a\ntitle: b" at line 2, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because its YAML does not parse (DUPLICATE_KEY at line 3)',
    ])
  })

  // Deliberately not reported: read as Markdown, the list ends the paragraph, so the closing `---`
  // is a rule, not a setext underline. No phantom section, the title is the document's, and the box
  // is checked like any other.
  it('a task box on a continuation line makes no phantom title, so nothing needs naming', () => {
    expect(titleOf('---\na: |\n  - [ ] open\n---\n\n# Doc\n')).toEqual([])
  })

  it('a YAML list shaped like a reference defined in the body: the link and its line', () => {
    expect(titleOf('---\ntags: [adr]\n---\n\n# Doc\n\n[adr]: ./adr.md\n')).toEqual([
      'no title: the first heading, "tags: adr" at line 2, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds a link into the repository at line 2',
    ])
  })

  it('a task box past a blank line in the block: the box and its line', () => {
    expect(titleOf('---\na: |\n  - [ ] open\n\nb: c\n---\n\n# Doc\n')).toEqual([
      'no title: the first heading, "b: c" at line 5, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds a task box at line 3',
    ])
  })

  it('a block that is not a mapping, or holds no key, says so', () => {
    expect(titleOf('---\njust text\n---\n\n# Doc\n')).toEqual([
      'no title: the first heading, "just text" at line 2, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it is not a YAML mapping',
    ])
    expect(titleOf('---\n{}\n---\n\n# Doc\n')).toEqual([
      'no title: the first heading, "{}" at line 2, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds no key',
    ])
  })

  it('a document opening with a byte-order mark names why too', () => {
    expect(titleOf('\uFEFF---\ntitle: a\ntitle: b\n---\n\n# Doc\n')).toEqual([
      'no title: the first heading, "title: a\ntitle: b" at line 2, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because its YAML does not parse (DUPLICATE_KEY at line 3)',
    ])
  })

  it('a heading below the block gets no reason, though the block was read as Markdown', () => {
    expect(titleOf('---\na: |\n  - [ ] open\n---\n\n## Sub\n')).toEqual([
      'no title: the first heading, "Sub" at line 6, is at depth 2',
    ])
  })

  it('a heading further into the block, past a blank line, names why too', () => {
    expect(titleOf('---\ntitle: Doc\n\ntags: [adr]\n---\n\n# Doc\n\n[adr]: ./adr.md\n')).toEqual([
      'no title: the first heading, "tags: adr" at line 4, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds a link into the repository at line 4',
    ])
  })

  it('a YAML comment read as the title names why when the title does not match', () => {
    const text = '---\n# page settings\ntags: [adr]\n---\n\n# Doc\n\n[adr]: ./adr.md\n'
    expect(titleOf(text, 'Doc')).toEqual([
      'the title "page settings" (line 2) is not "Doc"; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds a link into the repository at line 3',
    ])
  })

  it('valid front matter gives no title finding', () => {
    expect(titleOf('---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n')).toEqual([])
  })
})
