import type { ArchViolation } from '@nielspeter/eess'
import { describe, expect, it } from 'vitest'
import { corpusFromText, mentions, sections } from '../../src/index.js'

// Plan 0580 Phase 1: `mentions()` reads an HTML link through the one HTML reader, and an unread
// mention is undecided on the receipt.

const record = (): RegExp => /\b(?<kind>bug)\s+(?<n>\d{4})\b/gi
const one = (text: string) => mentions(corpusFromText({ 'a.md': text }), { pattern: record() })
const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${String(v.line)}: ${v.ruleId ?? '-'} ${v.message}`)

describe('an HTML link is what the one reader says it is (bug 0593)', () => {
  const notes = [
    '# Notes',
    '',
    'A: <a href="./bugs/0001-login.md">bug 0001</a> is an HTML link.',
    '',
    'B: <a data-href="./bugs/0001-login.md">bug 0001</a> is no link at all.',
    '',
    'C: <a title="see href=./x.md">bug 0001</a> is no link at all.',
    '',
    'D: <a title="a>b" href="./bugs/0001-login.md">bug 0001</a> is an HTML link.',
    '',
    'E: bug 0001 is plain text.',
    '',
  ].join('\n')

  it('lines 3 and 9 sit in an HTML link; lines 5, 7 and 11 are plain text, not a link', () => {
    expect(said(one(notes).should().beLinked().violations())).toEqual([
      '5: - "bug 0001" is not a link',
      '7: - "bug 0001" is not a link',
      '11: - "bug 0001" is not a link',
      '3: md/unread-mention "bug 0001" sits in a link written in HTML, which this rule does not read, so it can be judged neither linked nor not.',
      '9: md/unread-mention "bug 0001" sits in a link written in HTML, which this rule does not read, so it can be judged neither linked nor not.',
    ])
  })

  it('<A HREF> and single quotes are links; <a name> and <a :href> are not (plan 0580, R2)', () => {
    const v = one(
      [
        '# N',
        '',
        '<A HREF="./x.md">bug 0001</A>',
        '',
        "<a href='./x.md'>bug 0002</a>",
        '',
        '<a name="x">bug 0003</a>',
        '',
        '<a :href="x">bug 0004</a>',
        '',
      ].join('\n'),
    )
      .should()
      .beLinked()
      .violations()
    expect(said(v).map((s) => s.slice(0, 40))).toEqual([
      '7: - "bug 0003" is not a link',
      '9: - "bug 0004" is not a link',
      '3: md/unread-mention "bug 0001" sits in ',
      '5: md/unread-mention "bug 0002" sits in ',
    ])
  })
})

describe('a rule over only unread mentions reports them and nothing beside (bug 0602)', () => {
  const unreadOnly = '# A\n\n<div>\nbug 0001\n</div>\n'

  it('beLinked() returns the unread finding and no zero-examined finding', () => {
    expect(
      said(one(unreadOnly).should().beLinked().violations()).map((s) => s.slice(0, 32)),
    ).toEqual(['4: md/unread-mention "bug 0001" '])
  })

  it('notExist() has no declaredEmpty beside the unread finding', () => {
    const v = one(unreadOnly).should().notExist().violations()
    expect(v.map((x) => x.ruleId)).toEqual(['md/unread-mention'])
    expect(v.declaredEmpty).toBeUndefined()
  })

  it('a read mention beside an unread one is judged as before', () => {
    const v = one('# A\n\n<div>\nbug 0001\n</div>\n\nbug 0002.\n').should().beLinked().violations()
    expect(said(v).map((s) => s.slice(0, 32))).toEqual([
      '7: - "bug 0002" is not a link',
      '4: md/unread-mention "bug 0001" ',
    ])
  })
})

describe('a node of only comments is invisible to both of its readers (plan 0580, D2)', () => {
  const unreadAt = (text: string): string[] =>
    one(text)
      .should()
      .beLinked()
      .violations()
      .filter((v) => v.ruleId === 'md/unread-mention')
      .map((v) => String(v.line))

  it('mentions(): two comments in one node, and a doctype, hide what they hold', () => {
    // One line, so micromark makes one node of both comments; the old pattern took only one.
    expect(unreadAt('# A\n\n<!-- bug 0001 --><!-- bug 0002 -->\n\n<!DOCTYPE bug 0003>\n')).toEqual(
      [],
    )
  })

  it('mentions(): a comment beside text still shows the text, as unread', () => {
    expect(unreadAt('# A\n\n<!-- a --> bug 0001 <!-- b -->\n')).toEqual(['3'])
  })

  it('sections().haveContent(): a doctype is no content; text between two comments is', () => {
    const c = (body: string) => corpusFromText({ 'a.md': `## A\n\n${body}\n\n## C\n\ntext\n` })
    const empty = (body: string) =>
      sections(c(body)).that().areNamed('A').should().haveContent().violations().length
    expect(empty('<!DOCTYPE html>')).toBe(1)
    expect(empty('<!-- a -->\n<!-- b -->')).toBe(1)
    expect(empty('<!-- a --> text <!-- b -->')).toBe(0)
  })
})
