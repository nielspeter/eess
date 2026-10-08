import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, links, type MdLink } from '../../src/index.js'

// Plan 0405. Selected sets are compared by identity (`file url`), never by count.
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/declared-block')
const load = (roots: string[]) => corpus({ roots, cwd: fixtureRoot })
const id = (l: MdLink): string => `${l.doc.relPath.replace(/^docs\//, '')} ${l.url}`

function selectedUnderLabel(roots: string[], label = 'Related to'): string[] {
  return links(load(roots))
    .that()
    .areLabelled(label)
    .select({ label: 'link', identify: (l) => ({ name: id(l) }) })
    .elements.map(id)
    .sort()
}

function selectedInSection(roots: string[], name: string | RegExp): string[] {
  return links(load(roots))
    .that()
    .areInSection(name)
    .select({ label: 'link', identify: (l) => ({ name: id(l) }) })
    .elements.map(id)
    .sort()
}

/** Findings through the public rule path — never `.select()`, which carries none. */
function findings(
  roots: string[],
  declare: (b: ReturnType<typeof links>) => ReturnType<typeof links>,
) {
  return declare(links(load(roots)).that())
    .should()
    .resolve()
    .rule({ id: 'test/declared' })
    .violations()
}

describe('areLabelled() — label forms (plan 0405)', () => {
  it('selects each of the four forms, exactly and case-sensitively', () => {
    expect(selectedUnderLabel(['docs/forms.md'])).toEqual([
      'forms.md a1.md',
      'forms.md a2.md',
      'forms.md a3.md',
      'forms.md a4.md',
    ])
  })

  it('reports a wrapped near-miss by case or spacing, and never a plain-form or colon-less line', () => {
    const v = findings(['docs/forms.md'], (b) => b.areLabelled('Related to'))
    const declarationFindings = v.filter((x) => x.message.includes('is not the declared'))
    expect(declarationFindings.map((x) => x.element).sort()).toEqual([
      'docs/forms.md → label "Related  to"',
      'docs/forms.md → label "Related To"',
    ])
    expect(declarationFindings.map((x) => x.line).sort()).toEqual([11, 13])
  })
})

describe('areLabelled() — block ownership (plan 0405)', () => {
  it('a wrapped label owns its second line', () => {
    expect(selectedUnderLabel(['docs/wrapped.md'])).toEqual([
      'wrapped.md w1.md',
      'wrapped.md w2.md',
    ])
  })

  it('a label alone owns the list that follows, nested items included', () => {
    expect(selectedUnderLabel(['docs/label-then-list.md'])).toEqual([
      'label-then-list.md l1.md',
      'label-then-list.md l2.md',
    ])
  })

  it('a label alone inside a list item owns the list after it', () => {
    expect(selectedUnderLabel(['docs/label-in-item.md'])).toEqual(['label-in-item.md li1.md'])
  })

  it('a labelled list item owns its nested sub-list', () => {
    expect(selectedUnderLabel(['docs/item-sublist.md'])).toEqual([
      'item-sublist.md i1.md',
      'item-sublist.md i2.md',
    ])
  })

  it('a list after an intervening paragraph is not owned', () => {
    expect(selectedUnderLabel(['docs/intervening.md'])).toEqual([])
  })

  it('a label with its own link does not own the list after it', () => {
    expect(selectedUnderLabel(['docs/inline-then-list.md'])).toEqual(['inline-then-list.md b1.md'])
  })

  it('a loose list item with two paragraphs is one block', () => {
    expect(selectedUnderLabel(['docs/loose-item.md'])).toEqual([
      'loose-item.md lo1.md',
      'loose-item.md lo2.md',
    ])
  })
})

describe('areInSection() (plan 0405)', () => {
  it('selects under the heading and its sub-headings, until a heading of the same depth', () => {
    expect(selectedInSection(['docs/sections.md'], 'See also')).toEqual([
      'sections.md s1.md',
      'sections.md s2.md',
    ])
  })

  it('a shallower heading ends the section', () => {
    expect(selectedInSection(['docs/sections-shallow.md'], 'See also')).toEqual([
      'sections-shallow.md t1.md',
    ])
  })

  it('a RegExp declaration selects by pattern and produces no near-miss', () => {
    expect(selectedInSection(['docs/section-near-miss.md'], /^see\s+also$/i)).toEqual([
      'section-near-miss.md sa.md',
      'section-near-miss.md sb.md',
    ])
    const v = findings(['docs/section-near-miss.md'], (b) => b.areInSection(/^see\s+also$/i))
    expect(v.filter((x) => x.message.includes('is not the declared'))).toEqual([])
  })

  it('a heading that misses a string declaration by case or spacing is reported', () => {
    const v = findings(['docs/section-near-miss.md'], (b) => b.areInSection('See also'))
    expect(
      v
        .filter((x) => x.message.includes('is not the declared section'))
        .map((x) => x.element)
        .sort(),
    ).toEqual([
      'docs/section-near-miss.md → section "See  also"',
      'docs/section-near-miss.md → section "See Also"',
    ])
  })
})

/**
 * Every declaration finding on the fixture as `line message`, the base rule's own
 * findings (a link that does not resolve, zero examined) left out — exact sets,
 * so a fixture producing a second, wrong finding fails too.
 */
function declarationFindingsOf(
  roots: string[],
  declare: (b: ReturnType<typeof links>) => ReturnType<typeof links> = (b) =>
    b.areLabelled('Related to'),
): string[] {
  return findings(roots, declare)
    .filter((x) => !/does not resolve|examined zero units/.test(x.message))
    .map((x) => `${x.line} ${x.message}`)
    .sort()
}

const REFS = (l: number): string =>
  `${l} the "Related to" declaration holds reference-style links, which eess-md does not read — write them as inline links ([text](path))`
const NEAR = (l: number, found = 'Related To'): string =>
  `${l} the label "${found}" is not the declared "Related to", so the links under it are not checked — write it "Related to"`
const ALONE = (l: number): string =>
  `${l} the "Related to" label stands alone with no list directly under it, so it declares nothing — put its list right after it, or its links on its line`
const UNREAD = (l: number, found: string): string =>
  `${l} the label "${found}" is not at the start of a paragraph or list item, so the links after it are not read as a declaration — start a paragraph or list item with it`
const FORMAT = (l: number): string =>
  `${l} the label "Related to" is written with formatting eess-md does not read, so the links after it are not read as a declaration — write it **Related to:**`
const TAKEN = (l: number, found: string): string =>
  `${l} the label "${found}" sits inside the "Related to" declaration and takes the links under it out of it — drop the label, or move it out of the "Related to" list`

describe('declarations nothing can read (plan 0405)', () => {
  it('a wrapped declaration of only reference-style links is reported, and nothing else', () => {
    expect(declarationFindingsOf(['docs/refs.md'])).toEqual([REFS(3)])
  })

  it('a declaration mixing inline and reference-style links selects the inline one and reports the rest', () => {
    expect(selectedUnderLabel(['docs/mixed-refs.md'])).toEqual(['mixed-refs.md c.md'])
    expect(declarationFindingsOf(['docs/mixed-refs.md'])).toEqual([REFS(3)])
  })

  it('a wrapped label alone with nothing under it says no list follows it', () => {
    expect(declarationFindingsOf(['docs/empty.md'])).toEqual([ALONE(3)])
  })

  it('a label alone with a paragraph before its list names the cause, not a missing link', () => {
    expect(declarationFindingsOf(['docs/intervening.md'])).toEqual([ALONE(3)])
  })

  it('a wrapped declaration of text with no link is reported as naming no record', () => {
    expect(declarationFindingsOf(['docs/text-only.md'])).toEqual([
      '3 the "Related to" declaration names no record — add the links it declares, or remove the label',
    ])
  })

  it('a plain-form label with no link is not a finding', () => {
    expect(declarationFindingsOf(['docs/plain-empty.md'])).toEqual([])
  })
})

describe('a label is read wherever a block can hold it (plan 0405 review)', () => {
  it('a label nested under a colon-bearing parent, a link or a URL is its own block', () => {
    expect(selectedUnderLabel(['docs/nested.md'])).toEqual([
      'nested.md c1.md',
      'nested.md c2.md',
      'nested.md c3.md',
      'nested.md c4.md',
    ])
    expect(declarationFindingsOf(['docs/nested.md'])).toEqual([NEAR(18)])
  })

  it('a label after an ordered-list marker, a task box or a blockquote marker is read', () => {
    expect(selectedUnderLabel(['docs/prefixes.md'])).toEqual([
      'prefixes.md o1.md',
      'prefixes.md q1.md',
      'prefixes.md t1.md',
    ])
    expect(declarationFindingsOf(['docs/prefixes.md'])).toEqual([NEAR(11), NEAR(9)])
  })

  it('a wrapped label inside a paragraph is reported, exact or near', () => {
    expect(selectedUnderLabel(['docs/mid-block.md'])).toEqual([])
    expect(declarationFindingsOf(['docs/mid-block.md'])).toEqual([
      UNREAD(4, 'Related to'),
      UNREAD(7, 'Related To'),
    ])
  })
})

describe('a declaration keeps what is under it (plan 0405, second review)', () => {
  it('an item annotated with a colon, a URL or a plain label stays in its declaration', () => {
    expect(selectedUnderLabel(['docs/annotated.md'])).toEqual([
      'annotated.md an1.md',
      'annotated.md an2.md',
      'annotated.md an4.md',
      'annotated.md an5.md',
      'annotated.md an6.md',
      'annotated.md an7.md',
      'annotated.md https://example.com/an3',
    ])
    expect(declarationFindingsOf(['docs/annotated.md'])).toEqual([])
  })

  it('a different wrapped label inside a declaration keeps its links, and is reported', () => {
    expect(selectedUnderLabel(['docs/inner-label.md'])).toEqual(['inner-label.md il2.md'])
    expect(declarationFindingsOf(['docs/inner-label.md'])).toEqual([
      TAKEN(4, 'plan 0406'),
      TAKEN(9, 'Supersedes'),
    ])
  })

  it('a label alone encloses every list directly after it, whatever its bullet', () => {
    expect(selectedUnderLabel(['docs/bullets.md'])).toEqual([
      'bullets.md bu1.md',
      'bullets.md bu2.md',
    ])
  })

  it('a label in a table cell, a heading or mid-line is reported; one in code is not', () => {
    expect(selectedUnderLabel(['docs/unread.md'])).toEqual([])
    expect(declarationFindingsOf(['docs/unread.md'])).toEqual([
      UNREAD(5, 'Related to'),
      UNREAD(7, 'Related to'),
      UNREAD(9, 'Related To'),
    ])
  })
})

describe('a label at a block start in a form the grammar does not read (plan 0405, third review)', () => {
  it('is reported with its cause, and bold prose is not', () => {
    expect(selectedUnderLabel(['docs/formatted.md'])).toEqual(['formatted.md fm5.md'])
    expect(declarationFindingsOf(['docs/formatted.md'])).toEqual([
      FORMAT(3),
      FORMAT(5),
      FORMAT(7),
      FORMAT(9),
    ])
  })
})

describe('the declaration record (plan 0405 review)', () => {
  it('a label declared twice is scanned once', () => {
    const v = declarationFindingsOf(['docs/forms.md'], (b) =>
      b.areLabelled('Related to').and().areLabelled('Related to'),
    )
    expect(v).toEqual([NEAR(11), NEAR(13, 'Related  to')])
  })

  it('a fork keeps its own declarations', () => {
    const base = links(load(['docs/forms.md'])).that()
    base.areLabelled('Related to')
    const other = base
      .areLabelled('Something else')
      .should()
      .resolve()
      .rule({ id: 'test/fork' })
      .violations()
    expect(other.filter((x) => x.message.includes('is not the declared'))).toEqual([])
  })

  it('a declaration on a rule with no condition keeps the missing-condition finding', () => {
    const v = links(load(['docs/forms.md']))
      .that()
      .areLabelled('Related to')
      .rule({ id: 'test/no-condition' })
      .violations()
    expect(v.map((x) => x.message.split('\n')[0]).sort()).toEqual([
      "Rule 'test/no-condition' selects subjects but asserts nothing about them, so it cannot fail and certifies nothing.",
      NEAR(13, 'Related  to').slice(3),
      NEAR(11).slice(3),
    ])
  })
})

describe('the builder override keeps the base evidence (plan 0405)', () => {
  it('a corpus whose every declaration is misspelt reports the near-miss AND the zero-examined finding', () => {
    const v = findings(['misspelt/**'], (b) => b.areLabelled('Related to'))
    expect(v.some((x) => x.message.includes('is not the declared "Related to"'))).toBe(true)
    expect(v.some((x) => /examined zero units/.test(x.message))).toBe(true)
    expect(v).toHaveLength(2)
  })

  it('a correctly declared corpus reports nothing (the green control)', () => {
    const v = findings(['control/**'], (b) => b.areLabelled('Related to'))
    expect([...v]).toEqual([])
    expect(v.examined).toBe(2)
  })
})
