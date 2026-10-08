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

describe('declarations nothing can read (plan 0405)', () => {
  it('a wrapped declaration of only reference-style links is reported', () => {
    const v = findings(['docs/refs.md'], (b) => b.areLabelled('Related to'))
    expect(v.map((x) => x.message).filter((m) => m.includes('reference-style'))).toEqual([
      'the "Related to" declaration holds only reference-style links, which eess-md does not read — write them as inline links ([text](path))',
    ])
  })

  it('a wrapped declaration with no link is reported', () => {
    const v = findings(['docs/empty.md'], (b) => b.areLabelled('Related to'))
    expect(v.map((x) => x.message).filter((m) => m.includes('names no record'))).toEqual([
      'the "Related to" declaration names no record — add the links it declares, or remove the label',
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
