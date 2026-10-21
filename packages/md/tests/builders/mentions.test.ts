/**
 * Plan 0539: `mentions()` and `beLinked()`. Every row drives the public entry point,
 * `mentions(corpus, { pattern })`, over `corpusFromText` or a throwaway tree.
 */
import { describe, it, expect } from 'vitest'
import {
  areSelfMentions,
  corpus,
  corpusFromText,
  inDocuments,
  inSections,
  isArchConfigError,
  mentions,
  not,
  resideInFile,
  sectionsNamed,
  type ArchViolation,
  type MdDocument,
  type MdMention,
  type Predicate,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

/** A fresh pattern per use, so no test shares a `lastIndex` with another. */
const record = (): RegExp => /\b(?<kind>bug|plan)s?\s+(?<n>\d{4})\b/gi
const noBreak = (): RegExp => /\b(?<kind>bug|plan)s?[ -](?<n>\d{4})\b/gi

const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${String(v.line)}: ${v.message}`)

const selected = (b: ReturnType<typeof mentions>): string[] =>
  b
    .select({ label: 'm', identify: (m) => ({ name: m.text }) })
    .elements.map(
      (m: MdMention) =>
        `${String(m.line)} ${m.text.replace(/\n/g, '⏎')}${m.inCode ? ' code' : ''}${m.link ? ` → ${m.link.url}` : ''}`,
    )

const one = (text: string, pattern: RegExp = record()) =>
  mentions(corpusFromText({ 'a.md': text }), { pattern })

const linked = (text: string, pattern?: RegExp): string[] =>
  said(one(text, pattern).should().beLinked().violations())

describe('mentions(): what is a mention, and where it sits', () => {
  it('a plain mention is red at its own line; a linked one beside it is green', () => {
    expect(linked('# A\n\nSee [bug 0001](./b.md) and bug 0002.\n')).toEqual([
      '3: "bug 0002" is not a link',
    ])
  })

  it('a mention in inline code is red with the inline-code message', () => {
    const v = one('# A\n\nSee `bug 0002`.\n').should().beLinked().violations()
    expect(said(v)).toEqual(['3: "bug 0002" is in inline code, not a link'])
    expect(v[0]?.suggestion).toMatch(/^Put a link around it/)
  })

  it('a mention partly in inline code is in inline code', () => {
    expect(linked('# A\n\nSee bug `0002` here.\n')).toEqual([
      '3: "bug 0002" is in inline code, not a link',
    ])
  })

  it('a mention in inline code inside a link is linked', () => {
    expect(selected(one('# A\n\nSee [`bug 0002`](./b.md).\n'))).toEqual([
      '3 bug 0002 code → ./b.md',
    ])
    expect(linked('# A\n\nSee [`bug 0002`](./b.md).\n')).toEqual([])
  })

  it('the number alone in a link is linked', () => {
    const text = '# A\n\nSee bug [0119](./0119-x.md).\n'
    expect(selected(one(text))).toEqual(['3 bug 0119 → ./0119-x.md'])
    expect(linked(text)).toEqual([])
  })

  it('a link with no target is not a link: an empty URL and a bare #', () => {
    expect(linked('# A\n\nSee [bug 0001]() and [bug 0002](#).\n')).toEqual([
      '3: "bug 0001" is not a link',
      '3: "bug 0002" is not a link',
    ])
  })

  it("a mention in a link's title is a mention, and linked", () => {
    const text = '# A\n\nSee [bug 0001](./b.md "about bug 0002").\n'
    expect(selected(one(text))).toEqual(['3 bug 0001 → ./b.md', '3 bug 0002 → ./b.md'])
    expect(linked(text)).toEqual([])
  })

  it('a mention split by emphasis is found and red', () => {
    expect(linked('# A\n\nSee **bug** 0002 here.\n')).toEqual(['3: "bug 0002" is not a link'])
  })

  it("a mention broken by a soft line break is found by the caller's \\s+ and missed by its [ -]", () => {
    const text = '# A\n\nThis is about bug\n0002 and more.\n'
    expect(selected(one(text, record()))).toEqual(['3 bug⏎0002'])
    expect(selected(one(text, noBreak()))).toEqual([])
  })

  it('a mention across a hard line break is found', () => {
    expect(selected(one('# A\n\nThis is about bug\\\n0002 and more.\n'))).toEqual(['3 bug⏎0002'])
  })

  it('a mention in a table cell and in a heading is found, each at its own line', () => {
    const text = '# About bug 0001\n\n| a | b |\n| - | - |\n| x | bug 0002 |\n'
    expect(linked(text)).toEqual(['1: "bug 0001" is not a link', '5: "bug 0002" is not a link'])
  })

  it("the caller's flags are kept: an i pattern finds a capitalised mention, and one without i does not", () => {
    expect(linked('# A\n\nSee Bug 0001.\n')).toEqual(['3: "Bug 0001" is not a link'])
    expect(selected(one('# A\n\nSee Bug 0001.\n', /\bbug\s+\d{4}\b/g))).toEqual([])
  })

  it("a caller's sticky flag is dropped: a mention is found anywhere in a run", () => {
    expect(selected(one('# A\n\nSee bug 0001 here.\n', /\bbug\s+\d{4}\b/y))).toEqual(['3 bug 0001'])
  })

  it("a mention's line is its own, on the third line of a paragraph", () => {
    expect(linked('# A\n\nOne line,\ntwo lines,\nthree: bug 0002.\n')).toEqual([
      '5: "bug 0002" is not a link',
    ])
  })

  it('fenced, indented, front-matter and HTML-comment mentions are neither elements nor findings', () => {
    const text = [
      '---',
      'about: bug 0001',
      '---',
      '# A',
      '',
      '```md',
      'bug 0002',
      '```',
      '',
      '    bug 0003',
      '',
      '<!-- bug 0004 -->',
      '',
      'Prose bug 0009.',
      '',
    ].join('\n')
    expect(selected(one(text))).toEqual(['14 bug 0009'])
    expect(linked(text)).toEqual(['14: "bug 0009" is not a link'])
  })

  it('groups carries named captures and omits a group that did not take part', () => {
    const pattern = /\b(?:(?<kind>bug)\s+(?<n>\d{4})|(?<adr>ADR)-(?<num>\d{3}))\b/g
    const found = one('# A\n\nbug 0001 and ADR-009.\n', pattern)
      .select({ label: 'm', identify: (m) => ({ name: m.text }) })
      .elements.map((m: MdMention) => m.groups)
    expect(found).toStrictEqual([
      { kind: 'bug', n: '0001' },
      { adr: 'ADR', num: '009' },
    ])
  })

  it("a caller's g pattern used twice gives the same elements, and its lastIndex is left alone", () => {
    const pattern = record()
    const c = corpusFromText({ 'a.md': '# A\n\nbug 0001, bug 0002.\n' })
    pattern.lastIndex = 5
    const first = selected(mentions(c, { pattern }))
    const second = selected(mentions(c, { pattern }))
    expect(first).toEqual(['3 bug 0001', '3 bug 0002'])
    expect(second).toEqual(first)
    expect(pattern.lastIndex).toBe(5)
  })
})

describe('mentions(): what cannot be read is reported, where the rule reaches it', () => {
  const unread = [
    '# A',
    '',
    '<div>bug 0001</div>',
    '',
    'A [bug 0002][ref] reference.',
    '',
    '![bug 0003](./x.png "bug 0004")',
    '',
    '![bug 0005][img]',
    '',
    'See <a href="./b.md">bug 0006</a> here.',
    '',
    '<!-- a --> bug 0007 <!-- b -->',
    '',
    '[ref]: ./b.md "bug 0008"',
    '[img]: ./x.png',
    '',
  ].join('\n')

  const unreadFindings = (v: readonly ArchViolation[]): string[] =>
    v
      .filter((x) => x.ruleId === 'md/unread-mention')
      .map((x) => `${String(x.line)}: ${x.message.split(', which')[0] ?? ''}`)

  it('every place a reader sees but the rule cannot read is red as unread, with its cause and line', () => {
    expect(unreadFindings(one(unread).should().beLinked().violations())).toEqual([
      '3: "bug 0001" sits in a raw HTML block',
      '5: "bug 0002" sits in a reference-style link\'s text',
      '7: "bug 0003" sits in an image\'s alt text',
      '7: "bug 0004" sits in an image\'s title',
      '9: "bug 0005" sits in an image\'s alt text',
      '11: "bug 0006" sits in a link written in HTML',
      '13: "bug 0007" sits in a raw HTML block',
      '15: "bug 0008" sits in a link definition\'s title',
    ])
  })

  it('an unread mention is unsuppressable: .excluding() does not hide it', () => {
    const v = one(unread).should().beLinked().excluding(/.*/).violations()
    const found = v.filter((x) => x.ruleId === 'md/unread-mention')
    expect(found).toHaveLength(8)
    expect(found.every((x) => x.bypassFilters === true)).toBe(true)
  })

  it('a mention on a later line of an HTML block is reported at its own line', () => {
    const v = one('# A\n\n<div>\nfirst\nbug 0001\n</div>\n\nbug 0002.\n')
      .should()
      .beLinked()
      .violations()
    expect(unreadFindings(v)).toEqual(['5: "bug 0001" sits in a raw HTML block'])
  })

  it('names itself as why the rule examined nothing only when it is', () => {
    const none = one('# A\n\n<div>bug 0001</div>\n').should().beLinked().violations()
    expect(none.examined).toBe(0)
    expect(none.find((x) => x.ruleId === 'md/unread-mention')?.message).toMatch(
      /It is why this rule examined nothing\.$/,
    )
    const some = one('# A\n\n<div>bug 0001</div>\n\nbug 0002.\n').should().beLinked().violations()
    expect(some.examined).toBe(1)
    expect(some.find((x) => x.ruleId === 'md/unread-mention')?.message).not.toMatch(
      /examined nothing/,
    )
  })

  it('each remedy says where the text must go', () => {
    const v = one(unread).should().beLinked().violations()
    const by = (line: number): string =>
      v.find((x) => x.ruleId === 'md/unread-mention' && x.line === line)?.suggestion ?? ''
    expect(by(7)).toMatch(/^Take the text out of the alt text/)
    expect(by(11)).toMatch(/^Write the link in Markdown/)
    expect(by(15)).toMatch(/^Take the text out of the definition's title/)
  })

  it("an unread mention outside the rule's document scope is not reported", () => {
    const c = corpusFromText({ 'a.md': unread, 'b.md': '# B\n\n[bug 0009](./a.md)\n' })
    const v = mentions(c, { pattern: record() })
      .that()
      .resideInFile('b.md')
      .should()
      .beLinked()
      .violations()
    expect([...v]).toEqual([])
  })

  it('resideInFolder selects by folder, and names itself when its glob cannot match', () => {
    const c = corpusFromText({ 'x/a.md': '# A\n\nbug 0001.\n', 'y/b.md': '# B\n\nbug 0002.\n' })
    expect(selected(mentions(c, { pattern: record() }).that().resideInFolder('y/**'))).toEqual([
      '3 bug 0002',
    ])
    const v = mentions(c, { pattern: record() })
      .that()
      .resideInFolder('/y/**')
      .should()
      .notExist()
      .violations()
    expect(v.some((x) => x.message.includes('resideInFolder("/y/**")'))).toBe(true)
  })

  it('a predicate that cannot judge an unread mention reports it: a test of the link', () => {
    const c = corpusFromText({
      'a.md': '# A\n\n[bug 0001](./x.md) and [bug 0002][r].\n\n[r]: ./y.md\n',
    })
    const linkedToX: Predicate<MdMention> = {
      description: 'link to x',
      test: (m) => m.link?.url === './x.md',
    }
    const v = mentions(c, { pattern: record() })
      .that()
      .satisfy(linkedToX)
      .should()
      .notExist()
      .violations()
    expect(
      v
        .map((x) => `${x.ruleId === 'md/unread-mention' ? 'unread' : 'selected'} ${String(x.line)}`)
        .sort(),
    ).toEqual(['selected 3', 'unread 3'])
  })

  it("an undecided document scope reports the unread mention and the scope's cause", () => {
    // a.md holds only an unread mention, so the scope's cause there can come from the unread path
    // alone: the kernel reports causes for selected subjects, and a.md has none.
    const undecidedScope: Predicate<MdDocument> = {
      description: 'a scope undecided on a.md',
      test: (d) => {
        if (d.relPath === 'a.md') throw new Error('test() is not called on an undecided subject')
        return true
      },
      undecided: (d) =>
        d.relPath === 'a.md'
          ? [{ file: d.file, line: 1, element: 'a.md:1', message: 'the scope cannot judge a.md' }]
          : [],
    }
    const c = corpusFromText({
      'a.md': '# A\n\n<div>bug 0001</div>\n',
      'b.md': '# B\n\nbug 0002.\n',
    })
    const v = mentions(c, { pattern: record() })
      .that()
      .satisfy(inDocuments(undecidedScope))
      .should()
      .beLinked()
      .violations()
    expect(v.some((x) => x.ruleId === 'md/unread-mention' && x.element === 'a.md:3')).toBe(true)
    expect(v.some((x) => x.message.includes('the scope cannot judge a.md'))).toBe(true)
  })
})

describe('mentions(): an unread mention the rule decides out is not reported', () => {
  const unreadIds = (v: readonly ArchViolation[]): string[] =>
    v.filter((x) => x.ruleId === 'md/unread-mention').map((x) => x.element)
  const self = {
    mention: (m: MdMention): string | undefined =>
      m.groups.n === undefined ? undefined : `bug:${String(Number(m.groups.n))}`,
    document: (d: MdDocument): string | undefined => {
      const m = /(?:^|\/)(\d{4})-[^/]*\.md$/.exec(d.relPath)
      return m?.[1] === undefined ? undefined : `bug:${String(Number(m[1]))}`
    },
  }

  it("a record's own number in its own HTML is decided out by not(areSelfMentions(…)); another's is not", () => {
    const c = corpusFromText({
      'bugs/0001-a.md':
        '# Bug 0001\n\n<div>bug 0001 and bug 0002</div>\n\n[bug 0002](./0002-b.md)\n',
    })
    const v = mentions(c, { pattern: record() })
      .that()
      .satisfy(not(areSelfMentions(self)))
      .should()
      .beLinked()
      .violations()
    expect(
      v.filter((x) => x.ruleId === 'md/unread-mention').map((x) => x.message.split(' sits')[0]),
    ).toEqual(['"bug 0002"'])
  })

  it('not(inDocuments(…)) and inSections(…) decide an unread mention out by its place', () => {
    const c = corpusFromText({
      'a.md': '# A\n\n<div>bug 0001</div>\n\nbug 0003.\n',
      'b.md': '# B\n\n## Notes\n\n<div>bug 0002</div>\n\nbug 0004.\n',
    })
    const notA = mentions(c, { pattern: record() })
      .that()
      .satisfy(not(inDocuments(resideInFile('a.md'))))
      .should()
      .beLinked()
      .violations()
    expect(unreadIds(notA)).toEqual(['b.md:5'])
    const inNotes = mentions(c, { pattern: record() })
      .that()
      .satisfy(inSections(sectionsNamed('Notes')))
      .should()
      .beLinked()
      .violations()
    expect(unreadIds(inNotes)).toEqual(['b.md:5'])
  })

  it('a field on a predicate cannot forge a scope: a forged docMembership drops nothing', () => {
    const forged = {
      description: 'forged',
      test: (): boolean => true,
      docMembership: (): boolean => false,
    } satisfies Predicate<MdMention> & { docMembership: () => boolean }
    const v = one('# A\n\n<div>bug 0001</div>\n\nbug 0002.\n')
      .that()
      .satisfy(forged)
      .should()
      .beLinked()
      .violations()
    expect(unreadIds(v)).toEqual(['a.md:3'])
  })
})

describe('mentions(): links written in HTML', () => {
  const lines = [
    '# A',
    '',
    'An anchor <a id="x">bug 0001</a> is no link.',
    '',
    'Inside [<a href="./y.md">bug 0002</a>](./x.md) a Markdown link.',
    '',
    'See <A HREF="./b.md">bug 0003</A> here.',
    '',
    'See <a href="./b.md">x</a> and bug 0004 after it.',
    '',
  ].join('\n')

  it('an <a> with no href is not a link; one inside a Markdown link is linked; upper case is read; text after </a> is read', () => {
    const v = one(lines).should().beLinked().violations()
    expect(
      v.map(
        (x) => `${String(x.line)} ${x.ruleId ?? 'beLinked'}: ${x.message.split(' sits')[0] ?? ''}`,
      ),
    ).toEqual([
      '3 beLinked: "bug 0001" is not a link',
      '9 beLinked: "bug 0004" is not a link',
      '7 md/unread-mention: "bug 0003"',
    ])
  })
})

describe('mentions(): the caller keys a self-mention', () => {
  const key = (m: MdMention): string | undefined =>
    m.groups.kind === undefined || m.groups.n === undefined
      ? undefined
      : `${m.groups.kind.toLowerCase()}:${String(Number(m.groups.n))}`
  const keyOf = (d: MdDocument): string | undefined => {
    const m = /(?:^|\/)(\d{4})-[^/]*\.md$/.exec(d.relPath)
    return m?.[1] === undefined ? undefined : `bug:${String(Number(m[1]))}`
  }

  it("areSelfMentions drops a record's own title, keeps another record's mention in it, and composes through not()", () => {
    const c = corpusFromText({
      'bugs/0001-a.md': '# Bug 0001: about bug 0002\n\nBug 0001 again.\n',
    })
    const v = mentions(c, { pattern: record() })
      .that()
      .satisfy(not(areSelfMentions({ mention: key, document: keyOf })))
      .should()
      .beLinked()
      .violations()
    expect(said(v)).toEqual(['1: "bug 0002" is not a link'])
  })
})

describe('mentions(): it fails closed', () => {
  it('a pattern matching the empty string is an ArchConfigError at build, saying so', () => {
    let err: unknown
    try {
      mentions(corpusFromText({ 'a.md': '# A\n' }), { pattern: /x*/g })
    } catch (e) {
      err = e
    }
    expect(isArchConfigError(err)).toBe(true)
    expect(err instanceof Error ? err.message : '').toMatch(/matches the empty string/)
  })

  it('a pattern that matches an empty string only when run is an ArchConfigError naming where', () => {
    let err: unknown
    try {
      selected(one('# A\n\nSee bug 0001.\n', /(?=bug)|zzz/g))
    } catch (e) {
      err = e
    }
    expect(isArchConfigError(err)).toBe(true)
    expect(err instanceof Error ? err.message : '').toMatch(/matched an empty string at offset 4/)
  })

  it('a rule selecting no mention is the vacuity finding', () => {
    const v = one('# A\n\nNothing named here.\n').should().beLinked().violations()
    expect(v.examined).toBe(0)
    expect(v.some((x) => x.message.includes('this rule examined zero units'))).toBe(true)
  })

  it('reads a corpus on disk, not only one from text', () => {
    const c = corpus({ cwd: tree({ 'a.md': '# A\n\nbug 0002.\n' }), roots: ['**/*.md'] })
    expect(said(mentions(c, { pattern: record() }).should().beLinked().violations())).toEqual([
      '3: "bug 0002" is not a link',
    ])
  })
})
