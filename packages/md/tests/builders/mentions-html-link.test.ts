import { describe, expect, it } from 'vitest'
import { areLinked, corpusFromText, mentions } from '../../src/index.js'

// Bug 0601: a mention inside a readable `<a href>…</a>` was reported `md/unread-mention`, cause
// `html-link`, though `links()` reads that `href` (plan 0580). With the one HTML attribute owner, the
// mention is judged linked to the tag's target; only an `<a>` its block never closes stays unread.

const pattern = /\bbug (?<id>\d{4})\b/g
const page = (body: string) =>
  corpusFromText({ 'docs/a.md': `# A\n\n${body}\n`, 'docs/b.md': '# B\n' })

describe('a mention inside an HTML link is judged linked (bug 0601)', () => {
  it('a mention in a readable inline <a href> is linked, to the tag’s target', () => {
    const c = page('See <a href="./b.md">bug 0001</a> here.')
    expect(
      mentions(c, { pattern })
        .should()
        .beLinked()
        .violations()
        .map((v) => v.message),
    ).toEqual([])
    const linked = mentions(c, { pattern })
      .that()
      .satisfy(areLinked())
      .select({ label: 'm', identify: (m) => ({ name: m.text }) })
      .elements.map((m) => `${m.text} → ${m.link?.url ?? '-'} (${m.link?.target.kind ?? '-'})`)
    expect(linked).toEqual(['bug 0001 → ./b.md (document)'])
  })

  it('the link’s text is the <a>’s whole text, inline code kept in backticks', () => {
    const c = page('See <a href="./b.md">bug 0001 in `b`</a>.')
    const texts = mentions(c, { pattern })
      .select({ label: 'm', identify: (m) => ({ name: m.text }) })
      .elements.map((m) => m.link?.text)
    expect(texts).toEqual(['bug 0001 in `b`'])
  })

  it('text before and after the <a> is not linked', () => {
    const c = page('bug 0001 then <a href="./b.md">x</a> then bug 0002.')
    const v = mentions(c, { pattern }).should().beLinked().violations()
    expect(v.map((x) => x.message.split(' ').slice(0, 2).join(' '))).toEqual([
      '"bug 0001"',
      '"bug 0002"',
    ])
  })

  it('an <a> its block never closes stays md/unread-mention', () => {
    const c = page('See <a href="./b.md">bug 0001 and no end.')
    const v = mentions(c, { pattern }).should().beLinked().violations()
    expect(v.map((x) => x.ruleId)).toEqual(['md/unread-mention'])
  })

  it('an <a> with no href is no link: the mention in it is not linked', () => {
    const c = page('See <a name="x">bug 0001</a> here.')
    const v = mentions(c, { pattern }).should().beLinked().violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.ruleId).not.toBe('md/unread-mention')
    expect(v[0]?.message).toMatch(/^"bug 0001"/)
  })
})

describe('another link inside a held <a> fails closed (bug 0601 review)', () => {
  const ruleIds = (body: string) =>
    mentions(page(body), { pattern })
      .should()
      .beLinked()
      .violations()
      .map((x) => x.ruleId ?? 'beLinked')

  it('a Markdown link inside an <a href>: unread, not linked to the outer href', () => {
    expect(ruleIds('<a href="./b.md">see [y](./c.md) bug 0001</a>')).toEqual(['md/unread-mention'])
  })

  it('an <a name> inside an <a href>: unread, not linked', () => {
    expect(ruleIds('<a href="./b.md">see <a name="x">bug 0001</a></a>')).toEqual([
      'md/unread-mention',
    ])
  })

  it('an <a href> inside an <a href>: unread, not linked to the outer one', () => {
    expect(ruleIds('<a href="./b.md">see <a href="./c.md">bug 0001</a></a>')).toEqual([
      'md/unread-mention',
    ])
  })

  it('a reference-style link inside an <a href>: unread, not linked to the outer href', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\n<a href="./b.md">[x][r] bug 0001</a>\n\n[r]: ./c.md\n',
      'docs/b.md': '# B\n',
      'docs/c.md': '# C\n',
    })
    const ids = mentions(c, { pattern })
      .should()
      .beLinked()
      .violations()
      .map((x) => x.ruleId ?? 'beLinked')
    expect(ids).toEqual(['md/unread-mention'])
  })

  it('a mention in a Markdown link inside an <a href> is unread', () => {
    expect(ruleIds('<a href="./b.md">[bug 0001](./c.md)</a>')).toEqual(['md/unread-mention'])
  })

  it('an <a> whose href points nowhere ("" or #) links nothing', () => {
    expect(ruleIds('<a href="">bug 0001</a> and <a href="#">bug 0002</a>')).toEqual([
      'beLinked',
      'beLinked',
    ])
  })
})
