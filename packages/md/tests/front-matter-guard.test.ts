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

// Bug 0572, the mirror of 0566: the block holds the definition and the body the reference. The
// block's own lines then hold nothing a reader checks by itself, but a reader of the whole document
// sees the body's link and its target, so a definition there that a reference uses counts.
describe('a front-matter block holding a definition a body reference uses is read as Markdown (bug 0572)', () => {
  it('the body reference is examined and its broken target reported', () => {
    const v = resolveOf({
      'docs/a.md': '---\na: |\n\n  [x]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x].\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '4 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [x])',
    ])
    expect(v.examined).toBe(2)
  })

  it('a definition written as a YAML key is read as Markdown too', () => {
    const v = resolveOf({ 'docs/a.md': '---\n[x]: ./gone.md\n---\n\n# A\n\nSee [x].\n' })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '2 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [x])',
    ])
    expect(v.examined).toBe(1)
  })

  // A label defined in the block and in the body: reading the block as Markdown would give the
  // reference the block's definition and hide the body's, which a renderer that drops front matter
  // uses. So the block stays front matter and the body's is checked, as on main. The block's own
  // target is then unchecked (bug 0610).
  it('a label the body also defines keeps the block front matter, so the body’s broken target is reported', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: |\n\n  [g]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '14 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g])',
    ])
    expect(v.examined).toBe(2)
  })

  it('a label the body also defines, externally, leaves the block front matter', () => {
    const text =
      '---\na: |\n\n  [g]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md) See [g].\n\n[g]: https://example.com\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
    expect(titleOf(text)).toEqual([])
  })

  it('the title finding names the definition and the reference that uses it', () => {
    const text = '---\na: |\n\n  [adr]: ./adr.md\nb: c\n---\n\n# Doc\n\nSee [adr].\n'
    // Line 4, not 5: mdast starts the setext heading at the definition it absorbed (bug 0609).
    expect(titleOf(text)).toEqual([
      'no title: the first heading, "b: c" at line 4, is at depth 2; it is in the line-1 `---` block, read as Markdown, not as front matter, because it holds the definition at line 4 of a link into the repository at line 10',
    ])
  })

  it('a definition in the block that no reference uses leaves it front matter', () => {
    const text = '---\na: |\n\n  [x]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n'
    const v = resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' })
    expect(v.examined).toBe(1)
    expect(titleOf(text)).toEqual([])
  })

  it('an external definition in the block that a body reference uses leaves it front matter', () => {
    const text = '---\na: |\n\n  [x]: https://example.com\nb: c\n---\n\n# A\n\nSee [x].\n'
    expect(titleOf(text)).toEqual([])
  })

  it('ordinary front matter beside a body reference and its body definition stays front matter', () => {
    const text = '---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n\nSee [g].\n\n[g]: ./adr.md\n'
    expect(titleOf(text)).toEqual([])
  })
})
