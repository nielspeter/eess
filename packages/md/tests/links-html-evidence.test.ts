import type { ArchViolation, Undecided } from '@nielspeter/eess'
import { describe, expect, it } from 'vitest'
import { corpusFromText, links, sections, UNREAD_LINK } from '../src/index.js'
import { sectionsOf } from '../src/model/sections.js'
import { sectionsHolding } from '../src/predicates/section.js'

// Plan 0580 Phase 3 (R6): an HTML link eess-md cannot read, standing in another subject's evidence,
// makes that subject undecided, not "has no link": `sections().haveLink()` in either position,
// `beLinkedBack()`, and the declaration scan.

const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${String(v.line)}: ${v.ruleId ?? '-'} ${v.message.split(', so ')[1] ?? v.message}`)
const UNREAD = 'see <a href=./a.md title=a/b>x</a>'
const inFile = (path: string) => ({
  description: `in ${path}`,
  test: (l: { doc: { relPath: string } }) => l.doc.relPath === path,
})

/** `## A` whose only link is unread (line 5), `## B` with a read link (line 9). */
const twoSections = () =>
  corpusFromText({
    'docs/p.md': `# R\n\n## A\n\n${UNREAD}\n\n## B\n\n[ok](./a.md)\n`,
    'docs/a.md': '# A\n\n[p](./p.md)\n',
  })

describe('sections().haveLink() after .should(): an unread link is reported, not "holds no link"', () => {
  it('a section whose only link is unread gets md/unread-link at the site, and no "holds no link"', () => {
    const v = sections(twoSections()).that().areNamed('A').should().haveLink().violations()
    expect(said(v)).toEqual([
      `5: ${UNREAD_LINK} this rule cannot judge whether its section holds a link.`,
    ])
    expect(v[0]?.bypassFilters).toBe(true)
  })

  it('a section with a read link and an unread one passes; one with neither still holds no link', () => {
    const c = corpusFromText({
      'docs/p.md': `# R\n\n## A\n\n${UNREAD}\n\n[ok](./a.md)\n\n## E\n\nnothing\n`,
      'docs/a.md': '# Target\n',
    })
    expect(said(sections(c).that().areNamed('A').should().haveLink().violations())).toEqual([])
    expect(said(sections(c).that().areNamed('E').should().haveLink().violations())).toEqual([
      '9: - section "E" holds no link',
    ])
  })

  it('two sites on one line with different causes are two findings', () => {
    const c = corpusFromText({
      'docs/p.md':
        '# R\n\n## A\n\nsee <a href=./a.md title=a/b>x</a> and <a href=./b.md data-x=c/d>y</a>\n',
    })
    const v = sections(c).that().areNamed('A').should().haveLink().violations()
    expect(v.map((x) => x.suggestion)).toEqual([
      "Quote `href`'s and `title`'s values: write each in double quotes.",
      "Quote `href`'s and `data-x`'s values: write each in double quotes.",
    ])
  })

  it('reports a site once per rule, however many nested sections contain it', () => {
    const c = corpusFromText({ 'docs/p.md': `# R\n\n## A\n\n### A1\n\n${UNREAD}\n` })
    const v = sections(c).should().haveLink().violations()
    // The whole list: no "holds no link" beside the site for a section that also contains it.
    expect(said(v)).toEqual([
      `7: ${UNREAD_LINK} this rule cannot judge whether its section holds a link.`,
    ])
  })

  it('every other holding ignores an unread link, in both positions', () => {
    const v = sections(twoSections()).that().areNamed('A').should().haveListItem().violations()
    // docs/a.md's own title is a section named "A" too, and holds no list item either.
    expect(said(v)).toEqual([
      '1: - section "A" holds no list item',
      '3: - section "A" holds no list item',
    ])
    const picked = sections(twoSections())
      .that()
      .haveCodeBlock()
      .select({ label: 's', identify: (x) => ({ name: x.name }) })
    expect(picked.elements).toEqual([])
  })
})

describe('sections().haveLink() after .that(): a section whose only link is unread is undecided', () => {
  it('is reported at the site, and neither selected nor dropped silently', () => {
    const v = sections(twoSections()).that().haveLink().should().notExist().violations()
    const site = v.filter((x) => x.line === 5)
    expect(site.map((x) => x.message.split(', so ')[1]?.split('. ')[0])).toEqual([
      'whether its section holds a link cannot be judged',
    ])
    expect(site[0]?.bypassFilters).toBe(true)
    expect(v.some((x) => x.message.includes('docs/p.md:3'))).toBe(false)
  })

  it('its message carries the site’s remedy, since the kernel’s finding has no suggestion of its own', () => {
    const v = sections(twoSections()).that().haveLink().should().notExist().violations()
    expect(v.find((x) => x.line === 5)?.message).toMatch(
      /cannot be judged\. Quote `href`'s and `title`'s values: write each in double quotes\.$/,
    )
  })

  it('a site in nested sections is one undecided finding, and two causes on one line are two', () => {
    const one = corpusFromText({ 'docs/p.md': `# R\n\n## A\n\n### A1\n\n${UNREAD}\n` })
    const v = sections(one).that().haveLink().should().notExist().violations()
    expect(v.map((x) => x.line)).toEqual([7])
    const two = corpusFromText({
      'docs/p.md':
        '# R\n\nsee <a href=./a.md title=a/b>x</a> and <a href=./b.md data-x=c/d>y</a>\n',
    })
    const w = sections(two).that().haveLink().should().notExist().violations()
    expect(w.map((x) => x.line)).toEqual([3, 3])
  })

  it('test() refuses an undecided section, for a caller that skips undecided()', () => {
    const doc = twoSections()
      .documents()
      .find((d) => d.relPath === 'docs/p.md')
    const a = doc === undefined ? undefined : sectionsOf(doc).find((x) => x.name === 'A')
    const p = sectionsHolding({ kind: 'link' })
    expect(a === undefined ? undefined : () => p.test(a)).toThrow(
      /haveLink cannot judge section "A"/,
    )
  })

  it('a section holding a read link and an unread one is selected, not undecided', () => {
    const c = corpusFromText({
      'docs/p.md': '# R\n\n## A\n\nsee <a href=./a.md title=a/b>x</a>\n\n[ok](./t.md)\n',
      'docs/t.md': '# T\n',
    })
    const names = sections(c)
      .that()
      .haveLink()
      .select({ label: 's', identify: (x) => ({ name: x.name }) })
    expect(names.elements.map((x) => x.name)).toEqual(['R', 'A'])
  })

  it('select() refuses, naming the site; a corpus with no unread link selects as before', () => {
    const identify = (s: { name: string }) => ({ name: s.name })
    expect(() =>
      sections(twoSections()).that().haveLink().select({ label: 's', identify }),
    ).toThrow(/docs\/p\.md:5/)
    const clean = corpusFromText({
      'docs/p.md': '# R\n\n## B\n\n[ok](./a.md)\n',
      'docs/a.md': '# A\n',
    })
    expect(
      sections(clean)
        .that()
        .haveLink()
        .select({ label: 's', identify })
        .elements.map((s) => s.name),
    ).toEqual(['R', 'B'])
  })
})

describe('beLinkedBack(): a target whose only link back may be an unread one is undecided', () => {
  const declared = () =>
    corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md) and [b again](./b.md).\n',
      'docs/b.md': `# B\n\n${UNREAD}\n`,
    })

  it('reports the target’s unread link once, not "does not link back" twice', () => {
    const v = links(declared())
      .that()
      .satisfy(inFile('docs/a.md'))
      .should()
      .beLinkedBack()
      .violations()
    expect(said(v)).toEqual([
      `3: ${UNREAD_LINK} whether docs/b.md links back to the records that declare it cannot be judged.`,
    ])
    expect(v[0]?.file.endsWith('docs/b.md')).toBe(true)
  })

  it('is one finding when the subject side reaches the same site in the same rule', () => {
    const v = links(declared()).should().beLinkedBack().violations()
    expect(v.filter((x) => x.ruleId === UNREAD_LINK).map((x) => x.line)).toEqual([3])
  })

  it('two sites on one line of the target are two findings', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md':
        '# B\n\nsee <a href=./a.md title=a/b>x</a> and <a href=./b.md data-x=c/d>y</a>\n',
    })
    const v = links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()
    expect(v.filter((x) => x.ruleId === UNREAD_LINK).map((x) => x.line)).toEqual([3, 3])
  })

  it('a frozen target keeps its own finding, whatever links it holds', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./completed/b.md).\n',
      'docs/completed/b.md':
        '# B\n\nsee <a href=./a.md title=a/b>x</a> and <a href=./b.md data-x=c/d>y</a>\n',
    })
    const v = links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()
    expect(said(v)).toEqual(['3: - docs/completed/b.md is frozen and cannot answer'])
  })

  it('a rule predicate’s own cause survives when the condition already reported the site', () => {
    const cause: Undecided = { file: 'x', line: 1, element: 'custom', message: 'custom cause on b' }
    const p = {
      description: 'custom',
      undecided: (l: { doc: { relPath: string } }) =>
        l.doc.relPath === 'docs/b.md' ? [cause] : [],
      test: () => true,
    }
    const v = links(declared()).that().satisfy(p).should().beLinkedBack().violations()
    expect(v.some((x) => x.message.includes('custom cause on b'))).toBe(true)
    expect(v.filter((x) => x.ruleId === UNREAD_LINK).map((x) => x.line)).toEqual([3])
  })

  it('the subject side drops only the site the condition reported, not another document’s', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md': `# B\n\n${UNREAD}\n`,
      'docs/c.md': `# C\n\n[a](./a.md)\n\n${UNREAD}\n`,
    })
    const v = links(c).should().beLinkedBack().violations()
    expect(
      v
        .filter((x) => x.ruleId === UNREAD_LINK)
        .map((x) => `${x.file.split('/').slice(-2).join('/')}:${String(x.line)}`)
        .sort(),
    ).toEqual(['docs/b.md:3', 'docs/c.md:5'])
  })

  it('a target with a read link back passes, whatever else it holds', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md': `# B\n\n${UNREAD}\n\n[a](./a.md)\n`,
    })
    expect(
      said(links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()),
    ).toEqual([])
  })

  it('a target with neither still does not link back', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\nSee [b](./b.md).\n',
      'docs/b.md': '# B\n\nnothing\n',
    })
    expect(
      said(links(c).that().satisfy(inFile('docs/a.md')).should().beLinkedBack().violations()),
    ).toEqual(['3: - docs/a.md declares docs/b.md, and docs/b.md does not link back'])
  })
})

describe('the declaration scan: a label whose list holds only an unread link is not empty', () => {
  it('reports the unread link, and no "stands alone with no list" beside it', () => {
    const c = corpusFromText({
      'docs/p.md': `# R\n\n**Links:**\n\n- ${UNREAD}\n`,
      'docs/a.md': '# A\n',
    })
    const v = links(c).that().areLabelled('Links').should().resolve().violations()
    expect(v.map((x) => x.ruleId ?? '-')).toEqual([UNREAD_LINK])
    expect(v.some((x) => x.message.includes('stands alone'))).toBe(false)
  })

  it('a label with nothing under it still stands alone', () => {
    const c = corpusFromText({ 'docs/p.md': '# R\n\n**Links:**\n\nprose\n', 'docs/a.md': '# A\n' })
    const v = links(c).that().areLabelled('Links').should().resolve().violations()
    expect(v.some((x) => x.message.includes('stands alone with no list directly under it'))).toBe(
      true,
    )
  })
})
