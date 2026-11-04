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

// Bug 0572's attempt (PR #302) read a block holding a definition a body reference uses as Markdown,
// and three review rounds each found a shape where that hid a broken body link main reports. It was
// withdrawn; these rows pin what holds on main, so the next design cannot turn one of them green.
describe('a definition in a front-matter block, as main reads it (bug 0572)', () => {
  it('a label the body also defines: the body’s broken target is reported', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: |\n\n  [g]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '14 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g])',
    ])
    // Since spike 0613 the block's own `[g]` (Markdown reading, to `./b.md`) is examined too.
    expect(v.examined).toBe(3)
  })

  it('a second label the body also defines: the body’s broken target is reported', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: |\n\n  [x]: ./b.md\n\n  [y]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x] and [y].\n\n[y]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '16 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [y])',
    ])
  })

  it('a fence opened in the block does not swallow a broken body link', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: |\n\n  [x]: ./b.md\n\n  ```\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n\n```\n\nSee [x].\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '12 broken link: "./gone.md" does not resolve to a file in the repo',
    ])
  })

  it('a link whose text holds a block-defined label is still a link', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: |\n\n  [x]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\n[see [x]](./gone.md)\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '12 broken link: "./gone.md" does not resolve to a file in the repo',
    ])
  })

  it('ordinary front matter beside a body reference and its body definition stays front matter', () => {
    const text = '---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n\nSee [g].\n\n[g]: ./adr.md\n'
    expect(titleOf(text)).toEqual([])
  })
})

// Spike 0613: a link either reader sees is examined. One reading drops a line-1 `---` block as front
// matter (a renderer: GitHub, VitePress); the other reads the whole document as Markdown (bug 0087's
// reader). `links()` examines the union, so a broken link a reader can follow is never hidden by
// which reading eess-md picks for the document's structure.
describe('a link either reader sees is examined (bugs 0572, 0610, 0611, 0612)', () => {
  const BODY = '\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n'
  const broken = (text: string): string[] =>
    resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' }).map(
      (x) => `${String(x.line)} ${x.message}`,
    )

  it('the 0572 case: a definition in the block that a body reference uses', () => {
    expect(
      broken('---\na: |\n\n  [x]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x].\n'),
    ).toEqual([
      '4 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [x]) — a link only where the line-1 `---` block is read as Markdown',
    ])
  })

  it('the 0572 case: the definition written as a YAML key', () => {
    expect(broken('---\n[x]: ./gone.md\n---\n\n# A\n\nSee [x].\n')).toEqual([
      '2 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [x]) — a link only where the line-1 `---` block is read as Markdown',
    ])
  })

  it('the 0610 case: a block read as Markdown for another reason still has the body definition checked', () => {
    for (const block of [
      '---\na: |\n\n  - [ ] t\n\n  [g]: ./b.md\nb: c\n---\n',
      '---\na: b\na: c\n\n[g]: ./b.md\n---\n',
      '---\na: |\n\n  [t](./b.md)\n\n  [g]: ./b.md\nb: c\n---\n',
    ])
      expect(broken(block + BODY)).toEqual(
        [
          '14 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g]) — a link only where the line-1 `---` block is front matter',
        ].map((s) =>
          s.replace(/^14/, String((block + BODY).split('\n').indexOf('[g]: ./gone.md') + 1)),
        ),
      )
  })

  it('the 0611 case: an <a href> in a YAML value', () => {
    expect(broken('---\na: <a href="./gone.md">x</a>\n---\n\n# A\n\n[ok](./b.md)\n')).toEqual([
      '2 broken link: "./gone.md" does not resolve to a file in the repo — a link only where the line-1 `---` block is read as Markdown',
    ])
  })

  it('the 0612 case: a fence opened in the block does not swallow a body link', () => {
    expect(
      broken('---\na: |\n\n  [t](./b.md)\n\n  ```\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n\n```\n'),
    ).toEqual([
      '12 broken link: "./gone.md" does not resolve to a file in the repo — a link only where the line-1 `---` block is front matter',
    ])
  })

  it('the 0572 case: the block’s definition is checked though the body defines the label externally', () => {
    expect(
      broken(
        '---\na: |\n\n  [g]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md) See [g].\n\n[g]: https://example.com\n',
      ),
    ).toEqual([
      '4 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g]) — a link only where the line-1 `---` block is read as Markdown',
    ])
  })

  it('the 0611 case: the reproduction examines both links; an external href in YAML adds none', () => {
    const v = resolveOf({
      'docs/a.md': '---\na: <a href="./gone.md">x</a>\n---\n\n# A\n\n[ok](./b.md)\n',
      'docs/b.md': '# B\n',
    })
    expect(v.examined).toBe(2)
    const ext = resolveOf({
      'docs/a.md': '---\na: <a href="https://example.com">x</a>\n---\n\n# A\n\n[ok](./b.md)\n',
      'docs/b.md': '# B\n',
    })
    expect([ext.examined, ext.length]).toEqual([1, 0])
  })

  it('the 0612 case: a comment or a <pre> opened in the block does not swallow a body link', () => {
    for (const opener of ['<!--', '<pre>'])
      expect(
        broken(
          `---\na: |\n\n  [t](./b.md)\n\n  ${opener}\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n`,
        ).filter((f) => f.includes('./gone.md')),
      ).toEqual([
        '12 broken link: "./gone.md" does not resolve to a file in the repo — a link only where the line-1 `---` block is front matter',
      ])
  })

  it('a URL in a YAML value adds no link: a rule over all links still examines nothing', () => {
    const c = corpusFromText({ 'docs/a.md': '---\nhomepage: https://example.com\n---\n\n# A\n' })
    const v = links(c).should().resolve().violations()
    expect(v.examined).toBe(0)
    expect(v.map((x) => x.message.slice(0, 30))).toEqual(['this rule examined zero units.'])
  })

  it('select() refuses a link only one reading holds, naming it', () => {
    const c = corpusFromText({
      'docs/a.md': '---\n[x]: ./b.md\n---\n\n# A\n\nSee [x].\n',
      'docs/b.md': '# B\n',
    })
    expect(() => links(c).select({ label: 'l', identify: (l) => ({ name: l.url }) })).toThrow(
      /docs\/a\.md:7[\s\S]*only where the line-1 `---` block is read as Markdown/,
    )
  })

  it('an unread HTML link in a YAML value, or in a swallowed body, is reported', () => {
    for (const text of [
      '---\na: <a href=./gone.md title=a/b>x</a>\n---\n\n# A\n\n[ok](./b.md)\n',
      '---\na: |\n\n  [t](./b.md)\n\n  ```\nb: c\n---\n\n# A\n\n<a href=./gone.md title=a/b>x</a>\n',
    ]) {
      const v = resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' })
      expect(v.map((x) => x.ruleId)).toContain('md/unread-link')
    }
  })

  it('ordinary front matter adds no link', () => {
    const v = resolveOf({
      'docs/a.md': '---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n\nSee [g].\n\n[g]: ./b.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.examined).toBe(1)
    expect(v.map((x) => x.message)).toEqual([])
  })
})
