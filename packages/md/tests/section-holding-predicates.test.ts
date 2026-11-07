/**
 * Plan 0636 (proposal 026, ask B): the predicates behind `sections()`'s holding methods, on the root.
 * Each is driven as an adopter calls it: through `satisfy()`, and composed into `inSections()`.
 */
import { describe, expect, it } from 'vitest'
import { and, type Predicate } from '@nielspeter/eess'
import {
  corpusFromText,
  inSections,
  sections,
  sectionsAtDepth,
  sectionsWithCodeBlock,
  sectionsWithCodePointer,
  sectionsWithContent,
  sectionsWithLink,
  sectionsWithListItem,
  taskItems,
  type MdSectionElement,
} from '../src/index.js'

/** One section per thing a section can hold, each holding nothing the others hold but content. */
const KINDS = corpusFromText({
  'docs/kinds.md': [
    '# Kinds',
    '',
    '## Empty',
    '',
    '## Text',
    '',
    'A plain paragraph.',
    '',
    '## List',
    '',
    '- an item',
    '',
    '## Link',
    '',
    'See [the other](./other.md).',
    '',
    '## Pointer',
    '',
    'See `src/a.ts:3`.',
    '',
    '## TsBlock',
    '',
    '```TS',
    'const x = 1',
    '```',
    '',
    '## JsBlock',
    '',
    '```js',
    'const y = 2',
    '```',
    '',
  ].join('\n'),
  'docs/other.md': '# Other\n',
})

/**
 * The names of the depth-2 sections of `docs/kinds.md` a predicate selects, through `satisfy()`. The
 * title section contains them all, so it holds every kind, and is left out.
 */
const chosen = (p: Predicate<MdSectionElement>): string[] =>
  sections(KINDS)
    .that()
    .satisfy(p)
    .select({ label: 's', identify: (s) => ({ name: s.name }) })
    .elements.filter((s: MdSectionElement) => s.doc.relPath === 'docs/kinds.md' && s.depth === 2)
    .map((s: MdSectionElement) => s.name)

describe('each holding predicate selects its own kind (plan 0636)', () => {
  it('sectionsWithContent selects every section with a block after its heading', () => {
    expect(chosen(sectionsWithContent())).toEqual([
      'Text',
      'List',
      'Link',
      'Pointer',
      'TsBlock',
      'JsBlock',
    ])
  })

  it('sectionsWithCodeBlock selects the sections with a code block, and lang in any letter case', () => {
    expect(chosen(sectionsWithCodeBlock())).toEqual(['TsBlock', 'JsBlock'])
    expect(chosen(sectionsWithCodeBlock({ lang: 'ts' }))).toEqual(['TsBlock'])
  })

  it('sectionsWithListItem selects the section with a list item', () => {
    expect(chosen(sectionsWithListItem())).toEqual(['List'])
  })

  it('sectionsWithLink selects the section with a link', () => {
    expect(chosen(sectionsWithLink())).toEqual(['Link'])
  })

  it('sectionsWithCodePointer selects the section with a code pointer', () => {
    expect(chosen(sectionsWithCodePointer())).toEqual(['Pointer'])
  })

  it('each selects the same sections as its builder twin after .that()', () => {
    const twin = (b: ReturnType<typeof sections>): string[] =>
      b
        .select({ label: 's', identify: (s) => ({ name: s.name }) })
        .elements.filter(
          (s: MdSectionElement) => s.doc.relPath === 'docs/kinds.md' && s.depth === 2,
        )
        .map((s: MdSectionElement) => s.name)
    const that = () => sections(KINDS).that()
    expect(chosen(sectionsWithContent())).toEqual(twin(that().haveContent()))
    expect(chosen(sectionsWithCodeBlock({ lang: 'js' }))).toEqual(
      twin(that().haveCodeBlock({ lang: 'js' })),
    )
    expect(chosen(sectionsWithListItem())).toEqual(twin(that().haveListItem()))
    expect(chosen(sectionsWithLink())).toEqual(twin(that().haveLink()))
    expect(chosen(sectionsWithCodePointer())).toEqual(twin(that().haveCodePointer()))
  })
})

describe('a holding predicate composes into inSections (plan 0636)', () => {
  it('limits a rule over boxes to the depth-2 sections that cite code, through and()', () => {
    // The title section contains the pointer too, so the depth narrows it to the box's own section.
    const c = corpusFromText({
      'docs/r.md':
        '# R\n\n## Cited\n\n- [ ] box one\n\nSee `src/a.ts:3`.\n\n## Uncited\n\n- [ ] box two\n',
    })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(and(sectionsAtDepth(2), sectionsWithCodePointer())))
      .should()
      .notExist()
      .violations()
    expect(v.map((x) => x.line)).toEqual([5])
  })
})

describe('sectionsWithLink cannot judge a section whose only link is unread (ADR-021)', () => {
  it('a rule reports the site at its own line, and neither selects nor drops the section', () => {
    const c = corpusFromText({
      'docs/p.md': '# R\n\n## A\n\nsee <a href=./a.md title=a/b>x</a>\n\n## B\n\n[ok](./a.md)\n',
      'docs/a.md': '# A\n',
    })
    const v = sections(c).that().satisfy(sectionsWithLink()).should().notExist().violations()
    const site = v.filter((x) => x.file.endsWith('docs/p.md') && x.line === 5)
    expect(site.map((x) => x.message)).toEqual([
      expect.stringMatching(/whether its section holds a link cannot be judged/),
    ])
    expect(site[0]?.bypassFilters).toBe(true)
    // Section B holds a read link and is selected; section A is neither selected nor dropped.
    expect(v.filter((x) => x.line === 7).map((x) => x.message)).toEqual([
      expect.stringMatching(/should not exist/),
    ])
    expect(v.some((x) => x.line === 3)).toBe(false)
  })
})
