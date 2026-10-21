/**
 * Plan 0539: `mentions()` and `beLinked()`. Every row drives the public entry point,
 * `mentions(corpus, { pattern })`, over `corpusFromText` or a throwaway tree.
 */
import { describe, it, expect } from 'vitest'
import {
  areSelfMentions,
  corpus,
  corpusFromText,
  isArchConfigError,
  mentions,
  not,
  type ArchViolation,
  type MdDocument,
  type MdMention,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const RECORD = /\b(?<kind>bug|plan)s?\s+(?<n>\d{4})\b/gi
const NO_BREAK = /\b(?<kind>bug|plan)s?[ -](?<n>\d{4})\b/gi

const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${String(v.line)}: ${v.message}`)

const selected = (b: ReturnType<typeof mentions>): string[] =>
  b
    .select({ label: 'm', identify: (m) => ({ name: m.text }) })
    .elements.map(
      (m: MdMention) =>
        `${String(m.line)} ${m.text.replace(/\n/g, '⏎')}${m.inCode ? ' code' : ''}${m.link ? ` → ${m.link.url}` : ''}`,
    )

const one = (text: string, pattern: RegExp = RECORD) =>
  mentions(corpusFromText({ 'a.md': text }), { pattern })

describe('mentions(): what is a mention, and where it sits', () => {
  it('a plain mention is red at its own line; a linked one beside it is green', () => {
    const v = one('# A\n\nSee [bug 0001](./b.md) and bug 0002.\n').should().beLinked().violations()
    expect(said(v)).toEqual(['3: "bug 0002" is not a link'])
  })

  it('a mention in inline code is red with the inline-code message', () => {
    const v = one('# A\n\nSee `bug 0002`.\n').should().beLinked().violations()
    expect(said(v)).toEqual(['3: "bug 0002" is in inline code, not a link'])
  })

  it('a mention in inline code inside a link is linked', () => {
    expect(selected(one('# A\n\nSee [`bug 0002`](./b.md).\n'))).toEqual([
      '3 bug 0002 code → ./b.md',
    ])
    expect([...one('# A\n\nSee [`bug 0002`](./b.md).\n').should().beLinked().violations()]).toEqual(
      [],
    )
  })

  it('the number alone in a link is linked', () => {
    expect(selected(one('# A\n\nSee bug [0119](./0119-x.md).\n'))).toEqual([
      '3 bug 0119 → ./0119-x.md',
    ])
  })

  it('a mention split by emphasis is found and red', () => {
    const v = one('# A\n\nSee **bug** 0002 here.\n').should().beLinked().violations()
    expect(said(v)).toEqual(['3: "bug 0002" is not a link'])
  })

  it('a mention broken by a soft line break is found by \\s+ and missed by [ -]', () => {
    const text = '# A\n\nThis is about bug\n0002 and more.\n'
    expect(selected(one(text, RECORD))).toEqual(['3 bug⏎0002'])
    expect(selected(one(text, NO_BREAK))).toEqual([])
  })

  it("a mention's line is its own, on the third line of a paragraph", () => {
    const v = one('# A\n\nOne line,\ntwo lines,\nthree: bug 0002.\n')
      .should()
      .beLinked()
      .violations()
    expect(said(v)).toEqual(['5: "bug 0002" is not a link'])
  })

  it('fenced, indented, front-matter and HTML-comment mentions are not elements', () => {
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
      'Prose.',
      '',
    ].join('\n')
    expect(selected(one(text))).toEqual([])
  })

  it('groups carries named captures and omits a group that did not take part', () => {
    const pattern = /\b(?:(?<kind>bug)\s+(?<n>\d{4})|(?<adr>ADR)-(?<num>\d{3}))\b/g
    const found = mentions(corpusFromText({ 'a.md': '# A\n\nbug 0001 and ADR-009.\n' }), {
      pattern,
    })
      .select({ label: 'm', identify: (m) => ({ name: m.text }) })
      .elements.map((m: MdMention) => m.groups)
    expect(found).toEqual([
      { kind: 'bug', n: '0001' },
      { adr: 'ADR', num: '009' },
    ])
  })

  it("a caller's g pattern used twice gives the same elements", () => {
    const c = corpusFromText({ 'a.md': '# A\n\nbug 0001, bug 0002.\n' })
    RECORD.lastIndex = 5
    const first = selected(mentions(c, { pattern: RECORD }))
    const second = selected(mentions(c, { pattern: RECORD }))
    expect(first).toEqual(['3 bug 0001', '3 bug 0002'])
    expect(second).toEqual(first)
    expect(RECORD.lastIndex).toBe(5)
    RECORD.lastIndex = 0
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
    '![bug 0003](./x.png)',
    '',
    '[text](./b.md "bug 0004")',
    '',
    '[ref]: ./b.md',
    '',
  ].join('\n')

  it('an HTML block, a reference-style link, image alt and a link title are red as unread, each with its cause', () => {
    // Every mention here is unread, so the rule examined nothing: the vacuity finding names them.
    const all = one(unread).should().beLinked().violations()
    expect(all.examined).toBe(0)
    const v = all.filter((x) => x.ruleId === 'md/unread-mention')
    expect(v.every((x) => x.message.endsWith('It is why this rule examined nothing.'))).toBe(true)
    expect(
      v.map((x) => `${x.ruleId ?? ''} ${String(x.line)}: ${x.message.split(',')[0] ?? ''}`),
    ).toEqual([
      'md/unread-mention 3: "bug 0001" sits in a raw HTML block',
      'md/unread-mention 5: "bug 0002" sits in a reference-style link\'s text',
      'md/unread-mention 7: "bug 0003" sits in an image\'s alt text',
      'md/unread-mention 9: "bug 0004" sits in a link\'s or image\'s title',
    ])
    expect(v.every((x) => x.bypassFilters === true)).toBe(true)
  })

  it("an unread mention outside the rule's predicates is not reported", () => {
    const c = corpusFromText({ 'a.md': unread, 'b.md': '# B\n\n[bug 0005](./a.md)\n' })
    const v = mentions(c, { pattern: RECORD })
      .that()
      .resideInFile('b.md')
      .should()
      .beLinked()
      .violations()
    expect([...v]).toEqual([])
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
    const v = mentions(c, { pattern: RECORD })
      .that()
      .satisfy(not(areSelfMentions({ mention: key, document: keyOf })))
      .should()
      .beLinked()
      .violations()
    expect(said(v)).toEqual(['1: "bug 0002" is not a link'])
  })
})

describe('mentions(): it fails closed', () => {
  it('a pattern matching the empty string is an ArchConfigError at build', () => {
    let err: unknown
    try {
      mentions(corpusFromText({ 'a.md': '# A\n' }), { pattern: /x*/g })
    } catch (e) {
      err = e
    }
    expect(isArchConfigError(err)).toBe(true)
  })

  it('a rule selecting no mention is the vacuity finding', () => {
    const v = one('# A\n\nNothing named here.\n').should().beLinked().violations()
    expect(v.length).toBeGreaterThan(0)
    expect(v.examined).toBe(0)
  })

  it('reads a corpus on disk, not only one from text', () => {
    const c = corpus({ cwd: tree({ 'a.md': '# A\n\nbug 0002.\n' }), roots: ['**/*.md'] })
    expect(said(mentions(c, { pattern: RECORD }).should().beLinked().violations())).toEqual([
      '3: "bug 0002" is not a link',
    ])
  })
})
