/**
 * Plan 0503: `inSections(p)` limits a rule over any element on a line of its document to the
 * elements inside the sections `p` selects; `haveTextMatching` selects or asserts a box's text. Every
 * row drives the public entry points over a throwaway tree.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  haveTextMatching,
  inDocuments,
  inSections,
  links,
  not,
  predicateHaveField,
  resideInFolder,
  sectionsAtDepth,
  sectionsInSection,
  sectionsNamed,
  sectionsWithSubsection,
  taskItems,
  type ArchViolation,
  type Condition,
  type MdTaskItem,
} from '../src/index.js'
import { tree } from './helpers/tree.js'

const of = (files: Readonly<Record<string, readonly string[]>>) =>
  corpus({
    cwd: tree(
      Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [...v, ''].join('\n')])),
    ),
    roots: ['**/*.md'],
  })
const said = (vs: readonly ArchViolation[]): string[] => vs.map((v) => `${v.element}: ${v.message}`)
const holds = <T>(): Condition<T> => ({ description: 'hold', evaluate: () => [] })

// Adopter 1's rule: in a closed record, an open box under acceptance criteria may carry only
// validation-owed. Each name and pattern is bound once, read by the rule and its guard.
const CLOSED = predicateHaveField({ label: 'Status', forms: ['bold'], oneOf: /^(done|closed)$/i })
const ACCEPTANCE = /^Acceptance criteria$/i
const VALIDATION_OWED = /\bvalidation-owed\b/
const ratchet = (c: ReturnType<typeof of>, acceptance: RegExp = ACCEPTANCE) =>
  taskItems(c)
    .that()
    .areOpen()
    .and()
    .satisfy(inDocuments(CLOSED))
    .and()
    .satisfy(inSections(sectionsNamed(acceptance)))
    .and()
    .satisfy(not(haveTextMatching(VALIDATION_OWED)))
    .should()
    .notExist()
const guard = (c: ReturnType<typeof of>, acceptance: RegExp = ACCEPTANCE) =>
  docs(c).that().satisfy(CLOSED).haveSection(acceptance).should().haveSection(acceptance)

const RECORD = [
  '# Plan 1',
  '',
  '**Status:** done',
  '',
  '## Acceptance criteria',
  '',
  '- [x] parses',
  '- [ ] runs on Bun — validation-owed: the CI job',
  '',
  '### Detail',
  '',
  '- [ ] prints its count',
  '',
  '## Notes',
  '',
  '- [ ] a note left open',
]

describe('inSections: the elements inside matching sections (plan 0503)', () => {
  it('adopter 1: an open box without the token, under a subsection of the chosen section, reds and names it', () => {
    const v = ratchet(of({ 'plans/1.md': RECORD })).violations()
    expect(said(v)).toEqual([
      'plans/1.md:12: plans/1.md:12 should not exist (under "Acceptance criteria", line 5)',
    ])
  })

  it('adopter 1: green when every acceptance box is checked or validation-owed; Notes left alone', () => {
    const clean = RECORD.map((l) => (l === '- [ ] prints its count' ? '- [x] prints its count' : l))
    expect(ratchet(of({ 'plans/1.md': clean })).violations()).toHaveLength(0)
    expect(guard(of({ 'plans/1.md': clean })).violations()).toHaveLength(0)
  })

  it('the attributed section is the innermost selected one', () => {
    const c = of({ 'a.md': ['# Top', '', '## A', '', '### B', '', '- [ ] x'] })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(sectionsAtDepth(2)))
      .should()
      .notExist()
      .violations()
    expect(said(v)).toEqual(['a.md:7: a.md:7 should not exist (under "A", line 3)'])
    const both = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed(/^(A|B)$/)))
      .should()
      .notExist()
      .violations()
    expect(said(both)).toEqual(['a.md:7: a.md:7 should not exist (under "B", line 5)'])
  })

  it('a link in a heading’s text is inside that heading’s section', () => {
    const c = of({ 'a.md': ['## See [b](b.md)', '', 'text'], 'b.md': ['# B'] })
    const scoped = links(c)
      .that()
      .satisfy(inSections(sectionsNamed('See b')))
      .select({ label: 'l', identify: (l) => ({ name: l.url }) })
    expect(scoped.elements.map((l) => l.line)).toEqual([1])
  })

  it('a box before the first heading is in no section', () => {
    const c = of({ 'a.md': ['- [ ] before', '', '## A', '', '- [ ] inside'] })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('A')))
      .should()
      .notExist()
    expect(said(v.violations())).toEqual(['a.md:5: a.md:5 should not exist (under "A", line 3)'])
  })

  it('a heading in a list is not a section: its box is not selected, and the scan names it', () => {
    const c = of({ 'a.md': ['# A', '', '- ## Acceptance', '', '  - [ ] x'] })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('Acceptance')))
      .should()
      .notExist()
    expect(said(v.violations())).toEqual([
      'a.md → section "Acceptance" (in a list item): the heading "Acceptance" at line 3 is inside a list item, which does not start a section, so this rule does not read it',
    ])
  })

  it('a depth skip nests: a box under #### Detail is under ## Acceptance', () => {
    const c = of({ 'a.md': ['## Acceptance', '', '#### Detail', '', '- [ ] x'] })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('Acceptance')))
      .should()
      .notExist()
    expect(said(v.violations())).toEqual([
      'a.md:5: a.md:5 should not exist (under "Acceptance", line 1)',
    ])
  })

  it('a positive rule whose section scope selects nothing names it', () => {
    const c = of({ 'a.md': ['## A', '', '- [ ] x'], 'b.md': ['## B'] })
    const [finding] = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('Acceptence')))
      .should()
      .satisfy(holds<MdTaskItem>())
      .violations()
    expect(finding?.message).toMatch(
      /^this rule examined zero units[\s\S]*inSections\(are named "Acceptence"\) selected none of the corpus's 2 sections in 2 documents — the section predicate is dead/,
    )
  })

  it('a live section scope that holds none of the selected elements gives the three counts', () => {
    const c = of({ 'a.md': ['## A', '', 'text', '', '## B', '', '- [ ] x'], 'b.md': ['## A'] })
    const [finding] = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('A')))
      .should()
      .satisfy(holds<MdTaskItem>())
      .violations()
    expect(finding?.message).toContain(
      'the section scope selected 2 sections in 2 of 2 documents, and they hold none of the 1 task items the rest of this rule selects',
    )
  })

  it('on notExist() a misspelt section is green, and its guard reds', () => {
    const c = of({ 'plans/1.md': RECORD })
    const TYPO = /^Acceptence criteria$/i
    expect(ratchet(c, TYPO).violations()).toHaveLength(0)
    const v = guard(c, TYPO).violations()
    expect(v.examined).toBe(0)
    expect(v[0]?.message).toMatch(/^this rule examined zero units/)
  })

  it('a near miss of the section name is reported by the scan', () => {
    const c = of({
      'a.md': ['## acceptance criteria', '', '- [ ] x'],
      'b.md': ['## Acceptance criteria'],
    })
    const v = taskItems(c)
      .that()
      .satisfy(inSections(sectionsNamed('Acceptance criteria')))
      .should()
      .notExist()
      .violations()
    expect(said(v)).toEqual([
      'a.md → section "acceptance criteria" (near miss): the heading "acceptance criteria" is not the declared section "Acceptance criteria", so this rule does not read it',
    ])
  })

  it('a document whose Status cannot be read leaves its boxes undecided, reported', () => {
    const c = of({
      'plans/1.md': [
        '# P',
        '',
        '**Status:** done',
        '**Status:** open',
        '',
        '## Acceptance criteria',
        '',
        '- [ ] x',
      ],
    })
    const v = ratchet(c).violations()
    expect(v.map((x) => x.message)).toEqual([
      "Status is given twice (line 3 'done', line 4 'open'); keep one",
    ])
    expect(v[0]?.bypassFilters).toBe(true)
  })

  it('an undecided section predicate leaves the box undecided, not dropped', () => {
    const c = of({
      'a.md': ['# P', '', '**Status:** done', '**Status:** open', '', '## A', '', '- [ ] x'],
    })
    const unread = predicateHaveField({ label: 'Status', forms: ['bold'] })
    const lifted = inSections(inDocumentsOfSection(unread))
    const v = taskItems(c).that().satisfy(lifted).should().notExist().violations()
    expect(v.map((x) => x.message)).toEqual([
      "Status is given twice (line 3 'done', line 4 'open'); keep one",
    ])
  })

  it('the .excluding() key does not change when a rule gains a section scope', () => {
    const c = of({ 'a.md': ['## A', '', '- [ ] x'] })
    const plain = taskItems(c).that().areOpen().should().notExist().excluding('a.md:3').violations()
    const scoped = taskItems(c)
      .that()
      .areOpen()
      .and()
      .satisfy(inSections(sectionsNamed('A')))
      .should()
      .notExist()
      .excluding('a.md:3')
      .violations()
    expect(plain).toHaveLength(0)
    expect(scoped).toHaveLength(0)
  })

  it('two corpora with the same relPath keep their own verdicts', () => {
    const scope = inSections<MdTaskItem>(sectionsNamed('A'))
    const one = of({ 'a.md': ['## A', '', '- [ ] x'] })
    const two = of({ 'a.md': ['## B', '', '- [ ] x'] })
    expect(taskItems(one).that().satisfy(scope).should().notExist().violations()).toHaveLength(1)
    expect(taskItems(two).that().satisfy(scope).should().notExist().violations()).toHaveLength(0)
  })

  it('links agree with inSections on a document with a heading in a container', () => {
    const c = of({ 'a.md': ['## Real', '', '- ## Listed', '', '[after](b.md)'], 'b.md': ['# B'] })
    const byLinks = links(c)
      .that()
      .areInSection('Real')
      .select({ label: 'l', identify: (l) => ({ name: l.url }) }).elements.length
    const byScope = links(c)
      .that()
      .satisfy(inSections(sectionsNamed('Real')))
      .select({ label: 'l', identify: (l) => ({ name: l.url }) }).elements.length
    expect([byLinks, byScope]).toEqual([1, 1])
  })

  it('the other root section predicates select as their sections() methods do', () => {
    const c = of({
      'a.md': [
        '# Top',
        '',
        '## Phase 1',
        '',
        '### Files changed',
        '',
        '- [ ] a',
        '',
        '## Phase 2',
        '',
        '- [ ] b',
      ],
    })
    const lines = (p: Parameters<typeof inSections>[0]): number[] =>
      taskItems(c)
        .that()
        .satisfy(inSections(p))
        .select({ label: 'b', identify: (t) => ({ name: t.text }) })
        .elements.map((t) => t.line)
    expect(lines(sectionsWithSubsection('Files changed'))).toEqual([7, 11]) // `Top` holds it
    expect(lines(sectionsWithSubsection('Files changed', { depth: 3 }))).toEqual([7, 11])
    expect(lines(sectionsInSection('Phase 1'))).toEqual([7])
    expect(lines(sectionsAtDepth(2))).toEqual([7, 11])
  })
})

describe('haveTextMatching (plan 0503)', () => {
  it('as a condition, a box whose text does not match is a finding quoting it', () => {
    const c = of({ 'a.md': ['## A', '', '- [ ] x — validation-owed', '- [ ] y'] })
    const v = taskItems(c)
      .that()
      .areOpen()
      .should()
      .haveTextMatching(/validation-owed/)
      .violations()
    expect(said(v)).toEqual(['a.md:4: the box\'s text does not match /validation-owed/: "y"'])
  })

  it('done-otherwise hiding a deferral on the box’s second line is selected (bug 0507)', () => {
    const c = of({
      'records/closed/1.md': ['# R', '', '- [ ] x — done-otherwise', '', '  deferred→plan 2'],
    })
    const v = taskItems(c)
      .that()
      .satisfy(inDocuments(resideInFolder('records/closed/**')))
      .and()
      .haveTextMatching(/\bdone-otherwise\b/)
      .and()
      .haveTextMatching(/deferred\s*(?:→|->|:)/)
      .should()
      .notExist()
      .violations()
    expect(said(v)).toEqual(['records/closed/1.md:3: records/closed/1.md:3 should not exist'])
  })

  it('a g-flagged pattern reads every box', () => {
    const c = of({ 'a.md': ['- [ ] owed', '- [ ] owed', '- [ ] owed', '- [ ] owed'] })
    const v = taskItems(c).that().haveTextMatching(/owed/g).should().notExist().violations()
    expect(v).toHaveLength(4)
    const w = taskItems(c)
      .that()
      .satisfy(haveTextMatching(/owed/y))
      .should()
      .notExist()
      .violations()
    expect(w).toHaveLength(4)
  })
})

/** A section predicate built from a lifted document predicate, which can be undecided. */
function inDocumentsOfSection(
  p: ReturnType<typeof predicateHaveField>,
): Parameters<typeof inSections>[0] {
  return inDocuments(p)
}
