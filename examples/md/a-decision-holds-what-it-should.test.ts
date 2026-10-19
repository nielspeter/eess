/**
 * What a document and its sections hold (proposal 017, blocks 3 and 14; plan 0522): every decision
 * record has a title, its context says something, its diagram is a Mermaid block (tagged in any
 * letter case), its consequences are a list, and it cites the code that enforces it, live. The cited
 * pointer is three rules reading one const: the record holds the section, the section holds a
 * pointer, and each pointer in it resolves. A pointer rule alone is green on a record that has no
 * such section, or a section with no pointer.
 */
import { corpus, docs, inSections, pointers, sections, sectionsNamed } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-decision-holds-what-it-should'
const load = (cwd: string) => corpus({ cwd, roots: ['adr/**/*.md'] })
const ENFORCEMENT = 'Enforcement'

const rules = (cwd: string) => {
  const c = load(cwd)
  return {
    title: docs(c)
      .should()
      .haveTitle(/^ADR-\d{3}: /),
    holdsTheSection: docs(c).should().haveSection(ENFORCEMENT),
    holdsAPointer: sections(c).that().areNamed(ENFORCEMENT).should().haveCodePointer(),
    pointersLive: pointers(c)
      .that()
      .satisfy(inSections(sectionsNamed(ENFORCEMENT)))
      .should()
      .resolve(),
    context: sections(c).that().areNamed('Context').should().haveContent(),
    diagram: sections(c).that().areNamed('Diagram').should().haveCodeBlock({ lang: 'mermaid' }),
    consequences: sections(c).that().areNamed('Consequences').should().haveListItem(),
  }
}

/** Every rule's findings, as `rule: element: message`. */
const said = (cwd: string): string[] =>
  Object.entries(rules(cwd)).flatMap(([name, rule]) =>
    rule.violations().map((v) => `${name}: ${v.element}: ${v.message}`),
  )

describe('a decision holds what it should', () => {
  it('clean: both records hold everything, and every rule examined something', () => {
    const cwd = fixture(NAME, 'clean')
    expect(said(cwd)).toEqual([])
    const examined = Object.fromEntries(
      Object.entries(rules(cwd)).map(([name, rule]) => [name, rule.violations().examined]),
    )
    expect(examined).toEqual({
      title: 2,
      holdsTheSection: 2,
      holdsAPointer: 2,
      pointersLive: 2,
      context: 2,
      diagram: 2,
      consequences: 2,
    })
  })

  it('violating-no-title: a record whose first heading is at depth 2', () => {
    expect(said(fixture(NAME, 'violating-no-title'))).toEqual([
      'title: adr/002-names.md: no title: the first heading, "ADR-002: one word, one meaning" at line 1, is at depth 2',
    ])
  })

  it('violating-missing-section: only the document rule sees a record without the section', () => {
    expect(said(fixture(NAME, 'violating-missing-section'))).toEqual([
      'holdsTheSection: adr/002-names.md: missing section "Enforcement"',
    ])
  })

  it('violating-no-pointer: a section that cites nothing', () => {
    expect(said(fixture(NAME, 'violating-no-pointer'))).toEqual([
      'holdsAPointer: adr/002-names.md:18: section "Enforcement" holds no code pointer',
    ])
  })

  it('violating-stale-pointer: a cited line past the file’s end', () => {
    const found = said(fixture(NAME, 'violating-stale-pointer'))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(
      /^pointersLive: adr\/002-names\.md → src\/layers\.py:30: stale code pointer: src\/layers\.py has \d+ lines; "src\/layers\.py:30" references line 30 \(under "Enforcement", line 18\)$/,
    )
  })

  it('violating-empty-context: a section holding only a comment is empty', () => {
    expect(said(fixture(NAME, 'violating-empty-context'))).toEqual([
      'context: adr/002-names.md:3: section "Context" is empty',
    ])
  })

  it('violating-no-diagram: the diagram written as prose', () => {
    expect(said(fixture(NAME, 'violating-no-diagram'))).toEqual([
      'diagram: adr/002-names.md:7: section "Diagram" holds no code block tagged "mermaid"',
    ])
  })

  it('violating-consequences-in-prose: consequences that are not a list', () => {
    expect(said(fixture(NAME, 'violating-consequences-in-prose'))).toEqual([
      'consequences: adr/002-names.md:14: section "Consequences" holds no list item',
    ])
  })
})
