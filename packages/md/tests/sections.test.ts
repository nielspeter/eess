/**
 * Plan 0496: sections as elements, so a rule runs inside each matching section. Every row drives the
 * public entry points (`sections()`, `docs()`, `links()`) and the terminal, over a throwaway tree.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  inDocuments,
  isArchConfigError,
  links,
  predicateHaveField,
  predicateHaveSection,
  resideInFolder,
  sections,
  type ArchViolation,
  type Condition,
  type MdSectionElement,
} from '../src/index.js'
import { tree } from './helpers/tree.js'

const of = (files: Readonly<Record<string, string>>) =>
  corpus({ cwd: tree(files), roots: ['**/*.md'] })

/** Every selected section, by `name@line..endLine` and its path, through `.select()`. */
const selected = (b: ReturnType<typeof sections>): string[] =>
  b
    .select({ label: 's', identify: (s) => ({ name: s.name }) })
    .elements.map(
      (s: MdSectionElement) =>
        `${s.name}@${String(s.line)}..${String(s.endLine)} [${s.sectionPath.join(' > ')}]`,
    )

const said = (vs: readonly ArchViolation[]): string[] => vs.map((v) => `${v.element}: ${v.message}`)

/** A positive condition that holds for every section. */
const holds: Condition<MdSectionElement> = { description: 'hold', evaluate: () => [] }

const PLAN = [
  '# Plan',
  '',
  '## Phase 1',
  '',
  '### Files changed',
  '',
  '- a.ts',
  '',
  '## Phase 2',
  '',
  '### Files changed',
  '',
  '- b.ts',
  '',
].join('\n')

describe('what a section is (decision 4, one fixture each)', () => {
  it('a heading line inside a fenced code block is not a section', () => {
    const c = of({ 'a.md': '# A\n\n```md\n## Fenced\n```\n' })
    expect(
      selected(
        sections(c)
          .that()
          .satisfy({ description: 'all', test: () => true }),
      ),
    ).toEqual(['A@1..5 []'])
  })

  it('an <h2> in an HTML block is not a section', () => {
    const c = of({ 'a.md': '# A\n\n<h2>Html</h2>\n\ntext\n' })
    expect(selected(sections(c).that().areNamed('Html'))).toEqual([])
    expect(selected(sections(c).that().areNamed('A'))).toEqual(['A@1..5 []'])
  })

  it('a setext heading is a section, its line the text line and its depth 1 or 2', () => {
    const c = of({ 'a.md': 'Title\n=====\n\nSub\n---\n\ntext\n' })
    expect(selected(sections(c).that().areAtDepth(1))).toEqual(['Title@1..7 []'])
    expect(selected(sections(c).that().areAtDepth(2))).toEqual(['Sub@4..7 [Title]'])
  })

  it('a depth skip nests: #### B is in ## A, and A has subsection B', () => {
    const c = of({ 'a.md': '# Top\n\n## A\n\n#### B\n\ntext\n\n## C\n' })
    expect(selected(sections(c).that().areNamed('B'))).toEqual(['B@5..8 [Top > A]'])
    expect(selected(sections(c).that().haveSubsection('B'))).toEqual([
      'Top@1..9 []',
      'A@3..8 [Top]',
    ])
    const v = sections(c)
      .that()
      .areNamed('A')
      .should()
      .haveSubsection('B', { depth: 3 })
      .violations()
    expect(said(v)).toEqual([
      'a.md:3: section "A" has no subsection "B" at depth 3; "B" at line 5 is at depth 4',
    ])
  })

  it('a heading in a list item, a blockquote or a footnote definition is not a section, and is named', () => {
    const c = of({
      'a.md': [
        '# Top',
        '',
        '- ## Listed',
        '',
        '> ## Quoted',
        '',
        'See[^1].',
        '',
        '[^1]: ## Noted',
        '',
      ].join('\n'),
    })
    for (const name of ['Listed', 'Quoted', 'Noted']) {
      expect(selected(sections(c).that().areNamed(name))).toEqual([])
    }
    const v = sections(c)
      .that()
      .areNamed('Top')
      .should()
      .haveSubsection(/^(Listed|Quoted|Noted)$/)
      .violations()
    expect(said(v)).toEqual([
      'a.md:1: section "Top" has no subsection "/^(Listed|Quoted|Noted)$/"; ' +
        'the heading "Listed" at line 3 is inside a list item, which does not start a section; ' +
        'the heading "Quoted" at line 5 is inside a blockquote, which does not start a section; ' +
        'the heading "Noted" at line 9 is inside a footnote definition, which does not start a section',
    ])
    // `haveSection` names it too, appended to its unchanged message.
    expect(said(docs(c).should().haveSection('Listed').violations())).toEqual([
      'a.md: missing section "Listed"; the heading "Listed" at line 3 is inside a list item, which does not start a section',
    ])
  })
})

describe('the extent', () => {
  it('text before the first heading is in no section; the last section runs to the last line', () => {
    const c = of({ 'a.md': 'intro\n\n## A\n\nbody\n' })
    expect(selected(sections(c).that().areNamed('A'))).toEqual(['A@3..5 []'])
  })

  it('a file with no newline at its end ends on its last line', () => {
    const c = of({ 'a.md': '## A\n\nbody' })
    expect(selected(sections(c).that().areNamed('A'))).toEqual(['A@1..3 []'])
  })

  it('two sections of one name are two elements', () => {
    const c = of({ 'a.md': '## A\n\n## A\n' })
    expect(selected(sections(c).that().areNamed('A'))).toEqual(['A@1..2 []', 'A@3..3 []'])
  })

  it('front matter does not shift a line', () => {
    const c = of({ 'a.md': '---\ntitle: x\n---\n\n## A\n\nbody\n' })
    expect(selected(sections(c).that().areNamed('A'))).toEqual(['A@5..7 []'])
  })

  it('a link in a heading’s text is inside that heading’s section', () => {
    const c = of({ 'a.md': '## See [b](b.md)\n\ntext\n', 'b.md': '# B\n' })
    expect(selected(sections(c).that().areNamed('See b'))).toEqual(['See b@1..3 []'])
    const inIt = links(c).that().areInSection('See b').should().resolve().violations()
    expect(inIt.examined).toBe(1)
  })

  it('areInSection matches any enclosing heading, not only the nearest', () => {
    const c = of({ 'a.md': '# Top\n\n## Mid\n\n### Low\n' })
    expect(selected(sections(c).that().areInSection('Top'))).toEqual([
      'Mid@3..5 [Top]',
      'Low@5..5 [Top > Mid]',
    ])
  })

  it('two corpora with the same relPath keep their own sections', () => {
    const one = of({ 'a.md': '## One\n' })
    const two = of({ 'a.md': '## Two\n' })
    expect(selected(sections(one).that().areAtDepth(2))).toEqual(['One@1..1 []'])
    expect(selected(sections(two).that().areAtDepth(2))).toEqual(['Two@1..1 []'])
  })
})

describe('a break class per new way to fail', () => {
  const phases = sections.bind(null)

  it('a section lacks a subsection', () => {
    const c = of({ 'plans/a.md': PLAN.replace('### Files changed\n\n- a.ts', '- a.ts') })
    const v = phases(c)
      .that()
      .areNamed(/^Phase \d+/)
      .should()
      .haveSubsection('Files changed')
      .violations()
    expect(said(v)).toEqual(['plans/a.md:3: section "Phase 1" has no subsection "Files changed"'])
  })

  it('a subsection belongs to its own section, not the one before it (extent overrun)', () => {
    const c = of({
      'plans/a.md': '# Plan\n\n## Phase 1\n\ntext\n\n## Phase 2\n\n### Files changed\n',
    })
    const v = phases(c)
      .that()
      .areNamed(/^Phase/)
      .should()
      .haveSubsection('Files changed')
      .violations()
    expect(said(v)).toEqual(['plans/a.md:3: section "Phase 1" has no subsection "Files changed"'])
    expect(v.examined).toBe(2)
  })

  it('a subsection at the wrong depth', () => {
    const c = of({ 'plans/a.md': '## Phase 1\n\n#### Files changed\n' })
    const v = phases(c)
      .that()
      .areNamed(/^Phase/)
      .should()
      .haveSubsection('Files changed', { depth: 3 })
      .violations()
    expect(said(v)).toEqual([
      'plans/a.md:1: section "Phase 1" has no subsection "Files changed" at depth 3; "Files changed" at line 3 is at depth 4',
    ])
  })

  it('a subsection that is only a heading in a container: one finding, the condition’s', () => {
    const c = of({ 'plans/a.md': '## Phase 1\n\n- ### Files changed\n' })
    const v = phases(c)
      .that()
      .areNamed(/^Phase/)
      .should()
      .haveSubsection('Files changed')
      .violations()
    expect(said(v)).toEqual([
      'plans/a.md:1: section "Phase 1" has no subsection "Files changed"; the heading "Files changed" at line 3 is inside a list item, which does not start a section',
    ])
    expect(v).toHaveLength(1)
  })

  it('a selected name misspelt in one document: the scan reds', () => {
    const c = of({
      'plans/a.md': '## Files changed\n',
      'plans/b.md': '## Files Changed\n',
    })
    const v = phases(c).that().areNamed('Files changed').should().satisfy(holds).violations()
    expect(said(v)).toEqual([
      'plans/b.md → section "Files Changed" (near miss): the heading "Files Changed" is not the declared section "Files changed", so this rule does not read it',
    ])
    expect(v.examined).toBe(1)
  })

  it('a section that must not exist, hidden in a container: the scan reds', () => {
    const c = of({ 'plans/a.md': '# A\n\n> ## Deprecated\n' })
    const v = phases(c).that().areNamed('Deprecated').should().notExist().violations()
    expect(said(v)).toEqual([
      'plans/a.md → section "Deprecated" (in a blockquote): the heading "Deprecated" at line 3 is inside a blockquote, which does not start a section, so this rule does not read it',
    ])
  })

  it('a container heading outside the rule’s document scope gives no finding', () => {
    const c = of({ 'plans/a.md': '# A\n', 'docs/x.md': '# X\n\n> ## Deprecated\n' })
    const v = phases(c)
      .that()
      .areNamed('Deprecated')
      .and()
      .satisfy(inDocuments(resideInFolder('plans/**')))
      .should()
      .notExist()
      .violations()
    expect(said(v)).toEqual([])
  })

  it('a section lacks a table: the table in the next section does not count', () => {
    const table = '| Clause | Tier |\n| --- | --- |\n| a | 1 |\n'
    const c = of({ 'a.md': `## Enforcement\n\ntext\n\n## Next\n\n${table}` })
    const v = phases(c)
      .that()
      .areNamed('Enforcement')
      .should()
      .haveTable({ columns: [/Clause/, /Tier/] })
      .violations()
    expect(said(v)).toEqual([
      'a.md:1: section "Enforcement" has no table with the required columns (/Clause/, /Tier/)',
    ])
    const ok = of({ 'a.md': `## Enforcement\n\n${table}` })
    expect(
      phases(ok)
        .that()
        .areNamed('Enforcement')
        .should()
        .haveTable({ columns: [/Clause/, /Tier/] })
        .violations(),
    ).toHaveLength(0)
  })

  it('`section` passed to the section haveTable is a configuration error', () => {
    const c = of({ 'a.md': '## A\n' })
    const options = { columns: [/x/], section: 'A' }
    expect(() => phases(c).should().haveTable(options)).toThrow(/takes \{ columns \} only/)
    try {
      phases(c).should().haveTable(options)
    } catch (e) {
      expect(isArchConfigError(e)).toBe(true)
    }
  })

  it('a document lacks a section at a depth: the depth is named', () => {
    const c = of({ 'p/006.md': '# P\n\n### Acceptance criteria\n' })
    const v = docs(c).should().haveSection('Acceptance criteria', { depth: 2 }).violations()
    expect(said(v)).toEqual([
      'p/006.md: missing section "Acceptance criteria" at depth 2; "Acceptance criteria" at line 3 is at depth 3',
    ])
    expect(v).toHaveLength(1)
    expect(
      docs(c)
        .that()
        .haveSection('Acceptance criteria', { depth: 3 })
        .should()
        .notExist()
        .violations(),
    ).toHaveLength(1)
    expect(
      docs(c)
        .that()
        .satisfy(predicateHaveSection('Acceptance criteria', { depth: 2 }))
        .should()
        .notExist()
        .violations(),
    ).toHaveLength(1) // the scan's depth note: the selection itself is empty and green
  })

  it('a g-flagged name examines every section', () => {
    const c = of({ 'a.md': '## Phase 1\n\n## Phase 2\n\n## Phase 3\n\n## Phase 4\n' })
    const v = phases(c)
      .that()
      .areNamed(/^Phase \d+/g)
      .should()
      .satisfy(holds)
      .violations()
    expect(v.examined).toBe(4)
    const y = phases(c)
      .that()
      .areNamed(/Phase \d+/y)
      .should()
      .satisfy(holds)
      .violations()
    expect(y.examined).toBe(4)
  })

  it('bug 0506, md: a g-flagged haveSection selector examines all four documents', () => {
    const files = Object.fromEntries(
      [1, 2, 3, 4].map((n) => [`p${String(n)}.md`, `## Phase ${String(n)}\n\ntext\n`]),
    )
    const c = of(files)
    const v = docs(c)
      .that()
      .haveSection(/^Phase \d/g)
      .should()
      .haveTable({ columns: [/X/] })
      .violations()
    expect(v.examined).toBe(4)
    expect(v.map((x) => x.element).sort()).toEqual(['p1.md', 'p2.md', 'p3.md', 'p4.md'])
  })

  it('a rule that selects no section: the kernel’s zero-examined finding and the near miss', () => {
    const c = of({ 'a.md': '## Files Changed\n' })
    const v = phases(c).that().areNamed('Files changed').should().satisfy(holds).violations()
    expect(v.examined).toBe(0)
    const messages = v.map((x) => x.message)
    expect(messages).toHaveLength(2)
    expect(messages).toContain(
      'the heading "Files Changed" is not the declared section "Files changed", so this rule does not read it',
    )
    expect(messages.some((m) => m.startsWith('this rule examined zero units'))).toBe(true)
  })

  it('a scope that selects no document: plan 0457’s diagnosis, with the noun sections', () => {
    const c = of({ 'a.md': '## A\n' })
    const [finding] = phases(c)
      .that()
      .satisfy(inDocuments(resideInFolder('nope/**')))
      .should()
      .satisfy(holds)
      .violations()
    expect(finding?.message).toMatch(
      /inDocuments\(reside in folder nope\/\*\*\) matched none of the corpus's 1 documents/,
    )
  })

  it('a depth that cannot match is refused', () => {
    const c = of({ 'a.md': '## A\n' })
    for (const bad of [
      () => phases(c).that().areAtDepth(7),
      () => phases(c).that().areAtDepth(1.5),
      () => phases(c).should().haveSubsection('X', { depth: 0 }),
      () => docs(c).should().haveSection('X', { depth: 9 }),
      () => predicateHaveSection('X', { depth: -1 }),
    ]) {
      expect(bad).toThrow(/depth must be an integer from 1 to 6/)
      try {
        bad()
      } catch (e) {
        expect(isArchConfigError(e)).toBe(true)
      }
    }
  })

  it('a document a lifted predicate cannot judge is reported, not dropped', () => {
    const c = of({
      'a.md': '# A\n\n**Status:** done\n\n**Status:** open\n\n## Phase 1\n',
    })
    const done = predicateHaveField({ label: 'Status', forms: ['bold'], oneOf: /^done$/ })
    const v = phases(c).that().satisfy(inDocuments(done)).should().notExist().violations()
    expect(v.map((x) => x.message)).toEqual([
      "Status is given twice (line 3 'done', line 5 'open'); keep one",
    ])
    expect(v[0]?.bypassFilters).toBe(true)
  })

  it('notExist reports each section at relPath:line of its heading', () => {
    const c = of({ 'a.md': '# A\n\n## Deprecated\n\n## Deprecated\n' })
    const v = phases(c).that().areNamed('Deprecated').should().notExist().violations()
    expect(v.map((x) => `${x.element} ${String(x.line)}`)).toEqual(['a.md:3 3', 'a.md:5 5'])
  })
})

describe('a near miss is one finding, the condition’s (PR #252)', () => {
  it('haveSection with a depth names the near miss and the scan does not repeat it', () => {
    const c = of({ 'a.md': '# A\n\n## status\n' })
    expect(said(docs(c).should().haveSection('Status', { depth: 2 }).violations())).toEqual([
      'a.md: missing section "Status" at depth 2; the heading "status" at line 3 differs from "Status" only by case or spacing',
    ])
  })

  it('haveSubsection names the near miss inside the section, once', () => {
    const c = of({ 'plans/a.md': '## Phase 1\n\n### Files Changed\n' })
    const v = sections(c)
      .that()
      .areNamed('Phase 1')
      .should()
      .haveSubsection('Files changed')
      .violations()
    expect(said(v)).toEqual([
      'plans/a.md:1: section "Phase 1" has no subsection "Files changed"; the heading "Files Changed" at line 3 differs from "Files changed" only by case or spacing',
    ])
  })

  it('a field region names the near miss, once', () => {
    const c = of({ 'bugs/b.md': '# B\n\n## status\n\n- **State:** open\n' })
    const v = docs(c)
      .should()
      .haveField({ label: 'State', forms: ['bold'], region: { section: 'Status' } })
      .violations()
    expect(said(v)).toEqual([
      'bugs/b.md: no section "Status" to read State from (region); the heading "status" at line 3 differs from "Status" only by case or spacing',
    ])
  })
})

describe('unchanged behaviour', () => {
  it('haveSection without options keeps its verdict and message', () => {
    const c = of({ 'a.md': '# A\n\n### Deep\n' })
    expect(said(docs(c).should().haveSection('Missing').violations())).toEqual([
      'a.md: missing section "Missing"',
    ])
    expect(docs(c).should().haveSection('Deep').violations()).toHaveLength(0)
  })

  it('haveSection without options records nothing: a near miss is not a new finding', () => {
    const c = of({ 'a.md': '# A\n\n## Deep\n', 'b.md': '# B\n\n## deep\n' })
    expect(said(docs(c).that().haveSection('Deep').should().notExist().violations())).toEqual([
      'a.md: a.md should not exist',
    ])
  })
})
