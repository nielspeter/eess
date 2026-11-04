import { describe, expect, it } from 'vitest'
import { corpusFromText, docs, links, ONE_READING_LINK } from '../src/index.js'

// Bug 0566: the guard judged a line-1 `---` block by parsing the block alone, so a reference whose
// definition sits in the body was text to it, the block stayed front matter, and the link was never
// read. Bug 0087's rule is that the block is read as Markdown when it holds what a Markdown reader
// checks, exactly as before front matter was parsed: the whole document's parse decides.

const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()

/** The findings that are not spike 0613's one-reading finding: what the pinned rows pin. */
const bodyFindings = (files: Record<string, string>) => {
  const v = resolveOf(files)
  return Object.assign(
    v.filter((x) => x.ruleId !== ONE_READING_LINK),
    { examined: v.examined },
  )
}

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
    const v = bodyFindings({
      'docs/a.md':
        '---\na: |\n\n  [g]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '14 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [g])',
    ])
    expect(v.examined).toBe(2)
  })

  it('a second label the body also defines: the body’s broken target is reported', () => {
    const v = bodyFindings({
      'docs/a.md':
        '---\na: |\n\n  [x]: ./b.md\n\n  [y]: ./b.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x] and [y].\n\n[y]: ./gone.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '16 broken link: "./gone.md" does not resolve to a file in the repo (the definition of [y])',
    ])
  })

  it('a fence opened in the block does not swallow a broken body link', () => {
    const v = bodyFindings({
      'docs/a.md':
        '---\na: |\n\n  [x]: ./b.md\n\n  ```\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n\n```\n\nSee [x].\n',
      'docs/b.md': '# B\n',
    })
    expect(v.map((x) => `${String(x.line)} ${x.message}`)).toEqual([
      '12 broken link: "./gone.md" does not resolve to a file in the repo',
    ])
  })

  it('a link whose text holds a block-defined label is still a link', () => {
    const v = bodyFindings({
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

// Spike 0613: a link only one reading of a line-1 `---` block holds. GitHub and VitePress drop the
// block as front matter; a reader of the whole document (bug 0087's) reads it as Markdown. Where the
// two disagree whether a link is there, `links()` cannot judge it: it is no element, so no condition
// can pass on it, and each one is an unsuppressable finding (ADR-021), as an unread link is.
describe('a link only one reading holds is reported, never judged (bugs 0572, 0610, 0611, 0612)', () => {
  const BODY = '\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n'
  const said = (text: string): string[] =>
    resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n' }).map(
      (x) => `${String(x.line)} ${x.ruleId ?? '-'} ${x.message.split(':')[0] ?? ''}`,
    )
  const one = (
    line: number,
    url: string,
    where: 'read as Markdown' | 'front matter',
    def?: string,
  ) =>
    `${String(line)} ${ONE_READING_LINK} the link to "${url}"${def === undefined ? '' : ` (the definition of ${def})`} is a link only where the line-1 \`---\` block is ${where}`

  it('the 0572 case: a definition in the block that a body reference uses', () => {
    expect(
      said('---\na: |\n\n  [x]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x].\n'),
    ).toEqual([one(12, './gone.md', 'read as Markdown', '[x] at line 4')])
  })

  it('the 0572 case: the definition written as a YAML key', () => {
    expect(said('---\n[x]: ./gone.md\n---\n\n# A\n\nSee [x].\n')).toEqual([
      one(7, './gone.md', 'read as Markdown', '[x] at line 2'),
    ])
  })

  it('the 0572 case: the block’s definition behind an external body one', () => {
    expect(
      said(
        '---\na: |\n\n  [g]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md) See [g].\n\n[g]: https://example.com\n',
      ),
    ).toEqual([one(10, './gone.md', 'read as Markdown', '[g] at line 4')])
  })

  it('the 0610 case: a block read as Markdown for another reason, its body definition shadowed', () => {
    for (const block of [
      '---\na: |\n\n  - [ ] t\n\n  [g]: ./b.md\nb: c\n---\n',
      '---\na: b\na: c\n\n[g]: ./b.md\n---\n',
      '---\na: |\n\n  [t](./b.md)\n\n  [g]: ./b.md\nb: c\n---\n',
    ]) {
      const lines = (block + BODY).split('\n')
      const line = lines.indexOf('See [g].') + 1
      const def = `[g] at line ${String(lines.indexOf('[g]: ./gone.md') + 1)}`
      expect(said(block + BODY)).toEqual([one(line, './gone.md', 'front matter', def)])
    }
  })

  it('the 0611 case: an <a href> in a YAML value; an external one adds nothing', () => {
    expect(said('---\na: <a href="./gone.md">x</a>\n---\n\n# A\n\n[ok](./b.md)\n')).toEqual([
      one(2, './gone.md', 'read as Markdown'),
    ])
    expect(
      said('---\na: <a href="https://example.com">x</a>\n---\n\n# A\n\n[ok](./b.md)\n'),
    ).toEqual([])
  })

  it('the 0612 case: a fence, a comment or a <pre> opened in the block does not hide a body link', () => {
    for (const opener of ['```', '<!--', '<pre>'])
      expect(
        said(
          `---\na: |\n\n  [t](./b.md)\n\n  ${opener}\nb: c\n---\n\n# A\n\n[bad](./gone.md)\n`,
        ).filter((f) => f.includes('./gone.md')),
      ).toEqual([one(12, './gone.md', 'front matter')])
  })

  it('a link one reading holds is no element: a condition cannot pass on it', () => {
    const anyToB = {
      description: 'link somewhere to b.md',
      evaluate: (ls: readonly { url: string; doc: { file: string }; line: number }[]) =>
        ls.some((l) => l.url === './b.md')
          ? []
          : [{ rule: 'x', element: 'x', file: '', line: 0, message: 'no link to b.md' }],
    }
    const v = links(
      corpusFromText({
        'docs/a.md': '---\na: <a href="./b.md">x</a>\n---\n\n# A\n\n[c](./c.md)\n',
        'docs/b.md': '# B\n',
        'docs/c.md': '# C\n',
      }),
    )
      .should()
      .satisfy(anyToB)
      .violations()
    expect(v.map((x) => x.ruleId ?? x.message)).toEqual(['no link to b.md', ONE_READING_LINK])
  })

  it('it is unsuppressable, and its remedy says how to make the readers agree', () => {
    const c = corpusFromText({
      'docs/a.md': '---\n[x]: ./b.md\n---\n\n# A\n\nSee [x].\n',
      'docs/b.md': '# B\n',
    })
    const v = links(c).should().resolve().excluding(/.*/).violations()
    expect(v.map((x) => [x.ruleId, x.bypassFilters])).toEqual([[ONE_READING_LINK, true]])
    expect(v[0]?.suggestion).toBe(
      'Move the definition of [x] (line 2) out of the line-1 `---` block, so both readers agree.',
    )
  })

  // ADR-009 rule 2: each remedy, applied, clears its finding.
  it('each remedy, applied, clears the finding', () => {
    const oneReading = (text: string) =>
      resolveOf({ 'docs/a.md': text, 'docs/b.md': '# B\n', 'docs/c.md': '# C\n' }).filter(
        (x) => x.ruleId === ONE_READING_LINK,
      )
    const pairs: [string, string][] = [
      [
        '---\na: |\n\n  [x]: ./b.md\nb: c\n---\n\n# A\n\nSee [x].\n',
        '---\na: c\nb: c\n---\n\n# A\n\nSee [x].\n\n[x]: ./b.md\n',
      ],
      [
        '---\na: <a href="./b.md">x</a>\n---\n\n# A\n\n[ok](./b.md)\n',
        '---\na: x\n---\n\n# A\n\n[ok](./b.md) <a href="./b.md">x</a>\n',
      ],
      [
        '---\na: |\n\n  - [ ] t\n\n  [g]: ./b.md\nb: c\n---\n\n# A\n\nSee [g].\n\n[g]: ./c.md\n',
        '---\na: |\n\n  - [ ] t\nb: c\n---\n\n# A\n\nSee [g].\n\n[g]: ./c.md\n',
      ],
      [
        '---\na: |\n\n  [t](./b.md)\n\n  ```\nb: c\n---\n\n# A\n\n[bad](./b.md)\n',
        '---\na: |\n\n  [t](./b.md)\n\n  ```\n  x\n  ```\nb: c\n---\n\n# A\n\n[bad](./b.md)\n',
      ],
    ]
    for (const [before, after] of pairs) {
      expect([before, oneReading(before).length]).toEqual([before, 1])
      expect([after, oneReading(after).length]).toEqual([after, 0])
    }
  })

  it('two links on one line to one URL are one finding', () => {
    const v = resolveOf({
      'docs/a.md':
        '---\na: <a href="./b.md">x</a> <a href="./b.md">y</a>\n---\n\n# A\n\n[ok](./b.md)\n',
      'docs/b.md': '# B\n',
    })
    expect(v.filter((x) => x.ruleId === ONE_READING_LINK)).toHaveLength(1)
  })

  it('a URL in a YAML value is no link: a rule over all links still examines nothing', () => {
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

  it('ordinary front matter adds nothing', () => {
    const v = resolveOf({
      'docs/a.md': '---\ntitle: Doc\ntags: [a, b]\n---\n\n# Doc\n\nSee [g].\n\n[g]: ./b.md\n',
      'docs/b.md': '# B\n',
    })
    expect(v.examined).toBe(1)
    expect(v.map((x) => x.message)).toEqual([])
  })
})
