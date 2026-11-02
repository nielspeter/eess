import { isArchRuleError, type ArchViolation } from '@nielspeter/eess'
import { describe, expect, it } from 'vitest'
import { corpusFromText, links, sections, UNREAD_LINK } from '../src/index.js'

// Plan 0580 Phase 2: `links()` reads an `href` in raw HTML and resolves it, and reports, under a named
// cause, every HTML link it cannot read. The probes (P, Q, B) are the plan's Measured rows.

const page = (body: string) => `# R\n\n${body}\n`
const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${String(v.line)}: ${v.ruleId ?? '-'} ${v.message}`)
const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()
/**
 * The findings of `resolve()` over one page beside the files it links to. `docs/a.md` links home, so
 * the rule examines something and an unread finding is not also why it examined nothing.
 */
const resolved = (body: string, extra: Record<string, string> = {}) =>
  said(resolveOf({ 'docs/p.md': page(body), 'docs/a.md': '# A\n\n[home](./a.md)\n', ...extra }))
/** A predicate on the link's document, which an unread link knows. */
const inFile = (path: string) => ({
  description: `in ${path}`,
  test: (l: { doc: { relPath: string } }) => l.doc.relPath === path,
})

describe('links() reads an href in raw HTML (R1)', () => {
  it('a readable broken href is red at its own line inside a multi-line block', () => {
    expect(resolved('<div>\n<p>\n<a\n  href="./gone.md">x</a>\n</p>\n</div>')).toEqual([
      '6: - broken link: "./gone.md" does not resolve to a file in the repo',
    ])
  })

  it('in a blockquote, in a <details> fence, and an <area>, each at its line', () => {
    expect(resolved('> <div>\n> <a href="./gone.md">x</a>\n> </div>')).toEqual([
      '4: - broken link: "./gone.md" does not resolve to a file in the repo',
    ])
    expect(resolved('<details>\n```\n<a href="./gone.md">F</a>\n```\n</details>')).toEqual([
      '5: - broken link: "./gone.md" does not resolve to a file in the repo',
    ])
    expect(
      resolved('<map name="m">\n<area shape="rect" href="./gone.md" alt="A">\n</map>'),
    ).toEqual(['4: - broken link: "./gone.md" does not resolve to a file in the repo'])
  })

  it('a readable href that resolves is green, inline and in a block', () => {
    expect(resolved('see <a href="./a.md">a</a> here')).toEqual([])
    expect(resolved('<div>\n<a href="./a.md">a</a>\n</div>')).toEqual([])
  })

  it('./R&amp;D.md resolves against R&D.md, and a broken one is quoted decoded', () => {
    expect(resolved('<a href="./R&amp;D.md">x</a>', { 'docs/R&D.md': '# RD\n' })).toEqual([])
    expect(resolved('<a href="./Q&amp;A.md">x</a>')).toEqual([
      '3: - broken link: "./Q&A.md" does not resolve to a file in the repo',
    ])
  })

  it('produces no broken link for an external href, "", a valueless href, "#x", <a name> or :href', () => {
    expect(
      resolved(
        [
          '<div>',
          '<a href="https://example.com/x">e</a>',
          '<a href="">s</a>',
          '<a href>v</a>',
          '<a href="#x">f</a>',
          '<a name="n">n</a>',
          '<a :href="foo">b</a>',
          '</div>',
        ].join('\n'),
      ),
    ).toEqual([])
  })

  it('counts each href read in examined', () => {
    const v = resolveOf({
      'docs/p.md': page('<div>\n<a href="./a.md">a</a>\n<a href="./a.md">b</a>\n</div>'),
      'docs/a.md': '# A\n',
    })
    expect(v.examined).toBe(2)
  })
})

describe('an HTML link links() cannot read is reported under its cause (R3)', () => {
  it('split-tag (P15), and removing the blank line clears it', () => {
    const cut = '<div>\n<a href="./a.md"\n\ntitle="t">x</a>\n</div>'
    expect(resolved(cut)).toEqual([
      `4: ${UNREAD_LINK} an HTML link here cannot be read: its HTML tag is cut by a blank line, which ends the HTML block, so its target is not checked.`,
    ])
    expect(resolved(cut.replace('\n\n', '\n'))).toEqual([])
  })

  it('split-tag inside a blockquote (E3): the walk passes the quote’s depth, and the remedy clears it', () => {
    const cut = '> <div>\n> <a href="./a.md"\n>\n> title="t">x</a>\n> </div>'
    expect(resolved(cut)).toEqual([
      `4: ${UNREAD_LINK} an HTML link here cannot be read: its HTML tag is cut by a blank line, which ends the HTML block, so its target is not checked.`,
    ])
    expect(resolved(cut.replace('\n>\n', '\n'))).toEqual([])
  })

  it('split-tag over two blank lines: the remedy names the blank lines, and removing them clears it', () => {
    const cut = '<div>\n<a href="./a.md"\n\n\ntitle="t">x</a>\n</div>'
    const v = resolveOf({ 'docs/p.md': page(cut), 'docs/a.md': '# A\n\n[home](./a.md)\n' })
    expect(v.map((x) => x.suggestion)).toEqual([
      'Keep the tag inside one HTML block: remove the blank lines inside it.',
    ])
    expect(resolved(cut.replace('\n\n\n', '\n'))).toEqual([])
  })

  it('unterminated (a quote that never closes), and closing it clears it', () => {
    const open = '<div>\n<a href="./a.md>x</a>\n</div>'
    expect(resolved(open)).toEqual([
      `4: ${UNREAD_LINK} an HTML link here cannot be read: its HTML tag never closes inside its HTML block, so its target is not checked.`,
    ])
    expect(resolved(open.replace('./a.md>', './a.md">'))).toEqual([])
  })

  it('unquoted-slash names every attribute holding a "/", and quoting them clears it', () => {
    expect(resolved('see <a href=a.md title=a/b>x</a> here')).toEqual([
      `3: ${UNREAD_LINK} an HTML link here cannot be read: the Markdown parser reads its tag as text, because \`title\`'s unquoted value holds a "/", so its target is not checked.`,
    ])
    expect(resolved('see <a href=a.md title="a/b">x</a> here')).toEqual([])
    const both = resolveOf({
      'docs/p.md': page('see <a href=./a.md title=a/b>x</a>'),
      'docs/a.md': '# A\n',
    })
    expect(both[0]?.suggestion).toBe(
      "Quote `href`'s and `title`'s values: write each in double quotes.",
    )
    expect(resolved('see <a href="./a.md" title="a/b">x</a>')).toEqual([])
  })

  it('unquoted-slash across a line break (P3) and around emphasis (Q2), and quoting clears both', () => {
    expect(
      resolved('see <a\nhref=./a.md>x</a>').map(
        (s) =>
          `${s.split(' ').slice(0, 2).join(' ')} ${String(s.includes('reads its tag as text, because'))}`,
      ),
    ).toEqual([`3: ${UNREAD_LINK} true`])
    expect(resolved('see <a\nhref="./a.md">x</a>')).toEqual([])
    expect(
      resolved('see <a href=./a.md title=*t*>x</a>').map(
        (s) =>
          `${s.split(' ').slice(0, 2).join(' ')} ${String(s.includes('reads its tag as text, because'))}`,
      ),
    ).toEqual([`3: ${UNREAD_LINK} true`])
    expect(resolved('see <a href="./a.md" title=*t*>x</a>')).toEqual([])
  })

  it('what GitHub renders as text gives no finding of any rule id (P7, P8, Q7, \\<a)', () => {
    expect(resolved('see <a href="./gone.md"title="y">W</a> here')).toEqual([])
    expect(resolved('see <a @click="go" href="./gone.md">C</a> here')).toEqual([])
    expect(resolved('see <a name=a/b>x</a>')).toEqual([])
    expect(resolved('see \\<a href=./gone.md>x</a>')).toEqual([])
  })
})

describe('an unread link is undecided in every links() rule its predicates reach (R4)', () => {
  const c = () =>
    corpusFromText({
      'docs/p.md': page('see <a href=./a.md title=a/b>x</a>'),
      'docs/a.md': '# A\n',
      'notes/n.md': page('nothing here'),
    })
  const ids = (vs: readonly ArchViolation[]) => vs.map((v) => v.ruleId ?? '-')

  it('resolve(), beLinkedBack(), satisfy() and notExist() each report it', () => {
    expect(ids(links(c()).should().resolve().violations())).toContain(UNREAD_LINK)
    expect(ids(links(c()).should().beLinkedBack().violations())).toContain(UNREAD_LINK)
    expect(
      ids(
        links(c())
          .should()
          .satisfy({ description: 'any', evaluate: () => [] })
          .violations(),
      ),
    ).toContain(UNREAD_LINK)
    expect(ids(links(c()).should().notExist().violations())).toContain(UNREAD_LINK)
  })

  it('a path scope decides it out; areExternal() cannot, since its URL is unknown', () => {
    expect(
      ids(links(c()).that().satisfy(inFile('notes/n.md')).should().resolve().violations()),
    ).not.toContain(UNREAD_LINK)
    expect(ids(links(c()).that().areExternal().should().resolve().violations())).toContain(
      UNREAD_LINK,
    )
  })

  it('areInSection() reaches a site in the section, and decides out one outside it', () => {
    const c = corpusFromText({
      'docs/p.md':
        '# R\n\n## Refs\n\nsee <a href=./a.md title=a/b>x</a>\n\n## Other\n\nsee <a href=./a.md title=a/b>y</a>\n',
      'docs/a.md': '# A\n',
    })
    const v = links(c).that().areInSection('Refs').should().resolve().violations()
    expect(v.filter((x) => x.ruleId === UNREAD_LINK).map((x) => x.line)).toEqual([5])
  })

  it('areLabelled() reaches a site under the label, and decides out one elsewhere', () => {
    const c = corpusFromText({
      'docs/p.md': page(
        '**Links:**\n\n- see <a href=./a.md title=a/b>x</a>\n\nsee <a href=./a.md title=a/b>y</a>',
      ),
      'docs/a.md': '# A\n',
    })
    const v = links(c).that().areLabelled('Links').should().resolve().violations()
    expect(v.filter((x) => x.ruleId === UNREAD_LINK).map((x) => x.line)).toEqual([5])
  })

  it('a predicate that reads .text cannot decide a site out: its text is unknown', () => {
    const v = links(c())
      .that()
      .satisfy({ description: 'text x', test: (l) => l.text === 'nothing like it' })
      .should()
      .resolve()
      .violations()
    expect(ids(v)).toContain(UNREAD_LINK)
  })

  it('is unsuppressable: .excluding() keeps it, it carries bypassFilters, and .warn() still throws', () => {
    const v = links(c()).should().resolve().excluding(/.*/).violations()
    const found = v.filter((x) => x.ruleId === UNREAD_LINK)
    expect(found).toHaveLength(1)
    expect(found[0]?.bypassFilters).toBe(true)
    let thrown: unknown
    try {
      links(c()).should().resolve().warn()
    } catch (e) {
      thrown = e
    }
    expect(isArchRuleError(thrown) ? thrown.violations.map((v) => v.ruleId) : thrown).toEqual([
      UNREAD_LINK,
    ])
  })

  it('is not counted in examined; over only unread links there is no zero-examined finding', () => {
    const only = corpusFromText({ 'docs/p.md': page('see <a href=./a.md title=a/b>x</a>') })
    const v = links(only).should().resolve().violations()
    expect(v.examined).toBe(0)
    expect(ids(v)).toEqual([UNREAD_LINK])
    expect(v[0]?.message.endsWith('It is why this rule examined nothing.')).toBe(true)
    const none = links(only).should().notExist().violations()
    expect(ids(none)).toEqual([UNREAD_LINK])
    expect(none.declaredEmpty).toBeUndefined()
  })
})

describe('select() refuses when it reaches an unread link (R7)', () => {
  const identify = (l: { line: number }) => ({ name: String(l.line) })

  it('refuses, naming the site; a page with no unread link selects as before', () => {
    const bad = corpusFromText({ 'docs/p.md': page('see <a href=./a.md title=a/b>x</a>') })
    expect(() => links(bad).select({ label: 'l', identify })).toThrow(/docs\/p\.md:3/)
    const good = corpusFromText({
      'docs/p.md': page('see <a href="./a.md">x</a>'),
      'docs/a.md': '# A\n',
    })
    expect(
      links(good)
        .select({ label: 'l', identify })
        .elements.map((l) => l.url),
    ).toEqual(['./a.md'])
  })
})

describe('what changes for the other readers of links()', () => {
  it('R8: an href in a top-level HTML block has no block, and a label above a <ul> block declares nothing', () => {
    const c = corpusFromText({
      'docs/p.md': page('**Links:**\n\n<ul>\n<li><a href="./a.md">a</a></li>\n</ul>'),
      'docs/a.md': '# A\n',
    })
    const all = links(c).select({ label: 'l', identify: (l) => ({ name: l.url }) }).elements
    expect(all.map((l) => [l.url, l.block])).toEqual([['./a.md', undefined]])
    expect(links(c).that().areLabelled('Links').should().resolve().violations().examined).toBe(0)
  })

  it('areLabelled() and areInSection() declare an inline href like an inline link', () => {
    const c = corpusFromText({
      'docs/p.md': '# R\n\n## Refs\n\n**Links:** <a href="./a.md">a</a>\n',
      'docs/a.md': '# A\n',
    })
    expect(links(c).that().areLabelled('Links').should().resolve().violations().examined).toBe(1)
    expect(links(c).that().areInSection('Refs').should().resolve().violations().examined).toBe(1)
  })

  it('haveLiveTargets() reads an href into a frozen record as that record, and drops it', () => {
    const c = corpusFromText({
      'docs/p.md': page('<a href="./completed/r.md">old</a>\n\n<a href="./a.md">live</a>'),
      'docs/completed/r.md': '# R\n',
      'docs/a.md': '# A\n',
    })
    const live = links(c)
      .that()
      .haveLiveTargets()
      .select({ label: 'l', identify: (l) => ({ name: l.url }) })
    expect(live.elements.map((l) => l.url)).toEqual(['./a.md'])
  })

  it('.text is the element’s text, and empty for <a><img></a>', () => {
    const c = corpusFromText({
      'docs/p.md': page(
        '<div>\n<a href="./a.md">Read <b>this</b></a>\n<a href="./a.md"><img src="x.png"></a>\n</div>',
      ),
      'docs/a.md': '# A\n',
    })
    expect(
      links(c)
        .select({ label: 'l', identify: (l) => ({ name: l.url }) })
        .elements.map((l) => l.text),
    ).toEqual(['Read this', ''])
  })

  it('an inline <a>’s .text is what a reader sees: tags cut, and empty around an image', () => {
    const c = corpusFromText({
      'docs/p.md': page(
        'see <a href="./a.md">Read <b>this</b></a> and <a href="./a.md"><img src="x.png"></a>, <a href="./a.md">two</a>',
      ),
      'docs/a.md': '# A\n',
    })
    const texts = links(c)
      .select({ label: 'l', identify: (l) => ({ name: l.url }) })
      .elements.map((l) => l.text)
    expect(texts).toEqual(['Read this', '', 'two'])
  })

  it('an inline <a> across a line break has its whitespace collapsed, as in a block', () => {
    const c = corpusFromText({
      'docs/p.md': page('see <a href="./a.md">Read\nthis</a> here'),
      'docs/a.md': '# A\n',
    })
    const texts = links(c)
      .select({ label: 'l', identify: (l) => ({ name: l.url }) })
      .elements.map((l) => l.text)
    expect(texts).toEqual(['Read this'])
  })

  it('an href counts as a link back, and gives its section a link', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md': '# B\n\n<a href="./a.md">a</a>\n',
    })
    const back = links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()
    expect(said(back)).toEqual([])
    expect(back.examined).toBe(1)
    expect(said(sections(c).that().areNamed('B').should().haveLink().violations())).toEqual([])
  })

  it('a commented-out href is not a link back, and gives a section no link', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md': '# B\n\n<!-- <a href="./a.md">a</a> -->\n',
    })
    expect(
      said(links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()),
    ).toEqual(['3: - docs/a.md declares docs/b.md, and docs/b.md does not link back'])
    expect(said(sections(c).that().areNamed('B').should().haveLink().violations())).toEqual([
      '1: - section "B" holds no link',
    ])
  })
})

describe('every <a or <area start ends read, with a cause, or in a named silence (R3 invariant)', () => {
  /** What one input yields: the links read, the unread sites, and nothing else. */
  const causeOf = (message: string): string =>
    message.includes('cut by a blank line')
      ? 'split-tag'
      : message.includes('never closes')
        ? 'unterminated'
        : message.includes('reads its tag as text, because')
          ? 'unquoted-slash'
          : 'refused-tag'
  const outcome = (body: string): string => {
    const v = links(corpusFromText({ 'docs/p.md': page(body) }))
      .should()
      .notExist()
      .violations()
    const unread = v
      .filter((x) => x.ruleId === UNREAD_LINK)
      .map((x) => `${String(x.line)}:${causeOf(x.message)}`)
    return `read ${String(v.examined)} · unread ${unread.join(',') || 'none'}`
  }
  const rows: readonly (readonly [string, string])[] = [
    // read
    ['see <a href=x.md>x</a>', 'read 1 · unread none'],
    ['see <a title="a>b" href="./x.md">x</a>', 'read 1 · unread none'],
    ['the <a href>element</a>', 'read 1 · unread none'],
    ['<a href=docs/>x</a>', 'read 1 · unread none'],
    ['<div>\n<a href="./x.md"title="y">W</a>\n</div>', 'read 1 · unread none'],
    ['<div align=center>\n<a @click="go" href="./x.md">C</a>\n</div>', 'read 1 · unread none'],
    ['<details>\n```\n<a href="./x.md">F</a>\n```\n</details>', 'read 1 · unread none'],
    ['<script>\nvar s = \'<a href="./x.md">S</a>\'\n</script>', 'read 1 · unread none'],
    ['<pre>\n<a href="./x.md">P</a>\n</pre>', 'read 1 · unread none'],
    ['<map name="m">\n<area href="./x.md" alt="A">\n</map>', 'read 1 · unread none'],
    // a cause
    ['see <a href=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see <a href=x.md title=a/b>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see <a\nhref=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['| h |\n| - |\n| <a href=./x.md>x</a> |', 'read 0 · unread 5:unquoted-slash'],
    ['> | h |\n> | - |\n> | <a href=./x.md>x</a> |', 'read 0 · unread 5:unquoted-slash'],
    ['## see <a href=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['> see <a class="c"\n> href=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see <a href=./a*b*.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see <a title="`" href=./x.md>x`</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see R&amp;D <a href=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['see \\\\<a href=./x.md>x</a>', 'read 0 · unread 3:unquoted-slash'],
    ['<div>\n<a href="./x\n\nmd">x</a>\n</div>', 'read 0 · unread 4:split-tag'],
    [
      '<div>\n<a href="./gone.md>x</a>\n</div>\n\nSee "this" -> there.',
      'read 0 · unread 4:unterminated',
    ],
    ['> <div>\n> <a\nhref="./gone.md">x</a>', 'read 0 · unread 4:unterminated'],
    ['<map>\n<area href="./x.md\n</map>', 'read 0 · unread 4:unterminated'],
    // a named silence: no tag GitHub renders, a tag with no href, a comment, an attribute value
    ['see <a href="./x.md"title="y">W</a> here', 'read 0 · unread none'],
    ['see <a @click="go" href="./x.md">C</a> here', 'read 0 · unread none'],
    ['see <a href="./x.md>x</a> here', 'read 0 · unread none'],
    ['see <a name=a/b>x</a>', 'read 0 · unread none'],
    ['see \\<a href=./x.md>x</a>', 'read 0 · unread none'],
    ['see &lt;a href=./x.md>x', 'read 0 · unread none'],
    ['<![CDATA[\n<a href="./x.md">D</a>\n]]>', 'read 0 · unread none'],
    ['see <img alt="<a href=\'./g.md\'>"> here', 'read 0 · unread none'],
    ['![logo <a href=./x.md>](y.png)', 'read 0 · unread none'],
    ['[x](y.md "<a href=./z.md>")', 'read 1 · unread none'],
    ["<script>\nconst s = '<a href=\"' + u\n</script>", 'read 0 · unread none'],
  ]

  it.each(rows)('%j → %s', (body, want) => {
    expect(outcome(body)).toBe(want)
  })
})
