/**
 * Plan 0505: a field read inside a named section. `region: { section, depth? }` bounds the reader,
 * the resolver and the unnamed-form scan alike; a record without the section, or with the field
 * outside it, is its own cause. Every row drives `docs().haveField()` or `fields()`.
 */
import { describe, it, expect } from 'vitest'
import { corpus, docs, fields, type ArchViolation, type HaveFieldOptions } from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const of = (files: Readonly<Record<string, readonly string[]>>) =>
  corpus({
    cwd: tree(
      Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [...v, ''].join('\n')])),
    ),
    roots: ['**/*.md'],
  })
const said = (found: readonly ArchViolation[]): string[] =>
  found.map((v) => `${v.element}: ${v.message}`)

const STATE: HaveFieldOptions = {
  label: 'State',
  aliases: ['Status'],
  forms: ['bold'],
  region: { section: 'Status' },
}

/** Adopter 3's shape: the State under `## Status`, and a feedback register of Status items. */
const RECORD = [
  '# Bug 0001: x',
  '',
  '## Status',
  '',
  '- **State:** open',
  '',
  '## Feedback',
  '',
  '- **Status:** open — the first note',
  '- **Status:** closed — the second note',
]

const values = (c: ReturnType<typeof of>, s: HaveFieldOptions): string[] =>
  fields(c, s)
    .select({ label: 'f', identify: (t) => ({ name: t.value }) })
    .elements.map((t) => `${t.doc.relPath}:${String(t.line)} ${t.value}`)

describe('a field read inside a named section (plan 0505)', () => {
  it('adopter 3’s shape resolves inside the section, and conflicts without the region', () => {
    const c = of({ 'bugs/0001.md': RECORD })
    expect(said(docs(c).should().haveField(STATE).violations())).toEqual([])
    expect(values(c, STATE)).toEqual(['bugs/0001.md:5 open'])
    const whole = { ...STATE, region: undefined }
    expect(said(docs(c).should().haveField(whole).violations())).toEqual([
      "bugs/0001.md:5,9,10: State is given 3 times (line 5 'open', line 9 'open — the first note', line 10 'closed — the second note'); keep one",
    ])
  })

  it('no such section is its own cause, never "no field"', () => {
    const c = of({ 'bugs/0001.md': ['# Bug 0001: x', '', '## Symptom', '', 'It breaks.'] })
    expect(said(docs(c).should().haveField(STATE).violations())).toEqual([
      'bugs/0001.md: no section "Status" to read State from (region)',
    ])
  })

  it('a section of the name at another depth is named', () => {
    const c = of({ 'bugs/0001.md': ['# Bug 0001: x', '', '### Status', '', '- **State:** open'] })
    const s = { ...STATE, region: { section: 'Status', depth: 2 } }
    expect(said(docs(c).should().haveField(s).violations())).toEqual([
      'bugs/0001.md: no section "Status" at depth 2 to read State from (region); "Status" at line 3 is at depth 3',
    ])
  })

  it('a State outside the section is reported, as one outside the header is', () => {
    const c = of({
      'bugs/0001.md': [
        '# Bug 0001: x',
        '',
        '## Status',
        '',
        'Open.',
        '',
        '## Symptom',
        '',
        '**State:** open',
      ],
    })
    expect(said(docs(c).should().haveField(STATE).violations())).toEqual([
      'bugs/0001.md:9: State at line 9 is outside the "Status" section (region); move it into the section, or change the region',
    ])
  })

  it('two Status sections with different values conflict at both lines', () => {
    const c = of({
      'bugs/0001.md': [
        '# Bug',
        '',
        '## Status',
        '',
        '**State:** open',
        '',
        '## Status',
        '',
        '**State:** fixed',
      ],
    })
    expect(said(docs(c).should().haveField(STATE).violations())).toEqual([
      "bugs/0001.md:5,9: State is given twice (line 5 'open', line 9 'fixed'); keep one",
    ])
  })

  it('the unnamed-form scan is bounded by the region', () => {
    const c = of({
      'bugs/0001.md': ['# Bug', '', '## State: open', '', '## Status', '', '**State:** open'],
    })
    // `## State: open` is a heading form this rule does not read, outside the region: not a finding.
    expect(said(fields(c, STATE).should().resolveAgainst(/open/).violations())).toEqual([])
    // Without the region it is read as a form the rule does not name.
    const whole = { ...STATE, region: undefined }
    expect(said(fields(c, whole).should().resolveAgainst(/open/).violations())).toEqual([
      "bugs/0001.md:3: found `## State: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line",
    ])
  })

  it('a g-flagged section name reads every record', () => {
    const files = Object.fromEntries(
      [1, 2, 3, 4].map((n) => [
        `bugs/000${String(n)}.md`,
        ['# B', '', '## Status', '', '**State:** open'],
      ]),
    )
    const c = of(files)
    const s = { ...STATE, region: { section: /^Status$/g } }
    const v = docs(c).that().haveField(s).should().haveField(s).violations()
    expect(v.examined).toBe(4)
    expect(values(c, s)).toHaveLength(4)
  })

  it('a Status heading inside a list item is named by the section-name scan', () => {
    const c = of({ 'bugs/0001.md': ['# Bug', '', '- ## Status', '', '  **State:** open'] })
    expect(said(docs(c).should().haveField(STATE).violations())).toEqual([
      'bugs/0001.md: no section "Status" to read State from (region); the heading "Status" at line 3 is inside a list item, which does not start a section',
    ])
    // `fields()` reads nothing there: its zero-examined finding, and the scan says why.
    const v = said(fields(c, STATE).should().resolveAgainst(/open/).violations())
    expect(v).toHaveLength(2)
    expect(v).toContain(
      'bugs/0001.md → section "Status" (in a list item): the heading "Status" at line 3 is inside a list item, which does not start a section, so this rule does not read it',
    )
  })

  it('a region that is neither the header nor a section is refused', () => {
    const c = of({ 'a.md': ['# A'] })
    const bad = { label: 'State', forms: ['bold'], region: 'footer' }
    // @ts-expect-error -- a JavaScript caller's typo, refused at the call
    expect(() => fields(c, bad)).toThrow(/region must be 'header' or \{ section/)
  })
})
