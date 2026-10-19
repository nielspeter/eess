/**
 * Plan 0522: the rest of proposal 017's blocks 3 and 14. A document's title, and what a section
 * holds, each with a clean and a violating case, through `docs()` and `sections()` over a throwaway
 * tree.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  inSections,
  pointers,
  sections,
  sectionsNamed,
  type ArchViolation,
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

describe('haveTitle (block 3)', () => {
  it('a document whose first heading is a depth-1 title passes; the pattern matches it', () => {
    const c = of({ 'a.md': ['# Plan 0001: x', '', '## A'] })
    expect(docs(c).should().haveTitle().violations()).toHaveLength(0)
    expect(
      docs(c)
        .should()
        .haveTitle(/^Plan \d{4}: /)
        .violations(),
    ).toHaveLength(0)
  })

  it('no heading at all', () => {
    const c = of({ 'a.md': ['text only'] })
    expect(said(docs(c).should().haveTitle().violations())).toEqual([
      'a.md: no title: the document has no heading',
    ])
  })

  it('a first heading at depth 2 is no title', () => {
    const c = of({ 'a.md': ['intro', '', '## Status', '', '# Late title'] })
    expect(said(docs(c).should().haveTitle().violations())).toEqual([
      'a.md: no title: the first heading, "Status" at line 3, is at depth 2',
    ])
  })

  it('a title that does not match the pattern', () => {
    const c = of({ 'a.md': ['# Notes'] })
    expect(
      said(
        docs(c)
          .should()
          .haveTitle(/^Plan \d{4}: /)
          .violations(),
      ),
    ).toEqual(['a.md: the title "Notes" (line 1) is not "/^Plan \\d{4}: /"'])
  })

  it('a heading in a list item before the real title is not the title', () => {
    const c = of({ 'a.md': ['- # Listed', '', '# Real'] })
    expect(docs(c).should().haveTitle('Real').violations()).toHaveLength(0)
  })

  it('a g-flagged pattern reads every document', () => {
    const c = of({ 'a.md': ['# Plan'], 'b.md': ['# Plan'], 'c.md': ['# Plan'], 'd.md': ['# Plan'] })
    expect(
      docs(c)
        .should()
        .haveTitle(/^Plan$/g)
        .violations(),
    ).toHaveLength(0)
  })

  it('after .that(), the documents with the title', () => {
    const c = of({ 'a.md': ['# Plan'], 'b.md': ['## Not a title'] })
    const v = docs(c).that().haveTitle('Plan').should().notExist().violations()
    expect(said(v)).toEqual(['a.md: a.md should not exist'])
  })
})

/** One rule: every section named `A` holds what the condition says. */
const A = (c: ReturnType<typeof of>) => sections(c).that().areNamed('A').should()

describe('what a section holds (block 14)', () => {
  it('haveContent: a paragraph counts; only a subsection heading and a comment do not', () => {
    expect(
      A(of({ 'a.md': ['## A', '', 'text'] }))
        .haveContent()
        .violations(),
    ).toHaveLength(0)
    const empty = of({ 'a.md': ['## A', '', '<!-- todo -->', '', '### B', '', '## C', '', 'text'] })
    expect(said(A(empty).haveContent().violations())).toEqual(['a.md:1: section "A" is empty'])
    // Content in a subsection is the section's content too.
    const deep = of({ 'a.md': ['## A', '', '### B', '', 'text'] })
    expect(A(deep).haveContent().violations()).toHaveLength(0)
  })

  it('haveCodeBlock: any fence, a tag in any letter case, and never the next section’s', () => {
    const fenced = of({ 'a.md': ['## A', '', '```mermaid', 'graph TD', '```'] })
    expect(A(fenced).haveCodeBlock().violations()).toHaveLength(0)
    expect(A(fenced).haveCodeBlock({ lang: 'MERMAID' }).violations()).toHaveLength(0)
    expect(said(A(fenced).haveCodeBlock({ lang: 'ts' }).violations())).toEqual([
      'a.md:1: section "A" holds no code block tagged "ts"',
    ])
    const next = of({ 'a.md': ['## A', '', 'text', '', '## B', '', '```ts', 'x', '```'] })
    expect(said(A(next).haveCodeBlock().violations())).toEqual([
      'a.md:1: section "A" holds no code block',
    ])
  })

  it('haveListItem: a nested item counts; one in the next section does not', () => {
    expect(
      A(of({ 'a.md': ['## A', '', '> - quoted item'] }))
        .haveListItem()
        .violations(),
    ).toHaveLength(0)
    const next = of({ 'a.md': ['## A', '', 'text', '', '## B', '', '- item'] })
    expect(said(A(next).haveListItem().violations())).toEqual([
      'a.md:1: section "A" holds no list item',
    ])
  })

  it('haveLink: present, and absent when only the next section has one', () => {
    expect(
      A(of({ 'a.md': ['## A', '', 'See [b](b.md).'], 'b.md': ['# B'] }))
        .haveLink()
        .violations(),
    ).toHaveLength(0)
    const next = of({ 'a.md': ['## A', '', 'text', '', '## B', '', '[b](b.md)'], 'b.md': ['# B'] })
    expect(said(A(next).haveLink().violations())).toEqual(['a.md:1: section "A" holds no link'])
  })

  it('haveCodePointer: present, and absent when only the next section has one', () => {
    const c = of({ 'a.md': ['## A', '', 'Read `src/x.ts:3`.'] })
    expect(A(c).haveCodePointer().violations()).toHaveLength(0)
    const next = of({ 'a.md': ['## A', '', 'text', '', '## B', '', 'Read `src/x.ts:3`.'] })
    expect(said(A(next).haveCodePointer().violations())).toEqual([
      'a.md:1: section "A" holds no code pointer',
    ])
  })

  it('after .that(), the sections that hold it', () => {
    const c = of({ 'a.md': ['## A', '', '- item', '', '## B', '', 'text'] })
    const v = sections(c).that().haveListItem().should().notExist().violations()
    expect(said(v)).toEqual(['a.md:1: a.md:1 should not exist'])
  })
})

describe('block 3: a live code pointer under a named section, as three rules', () => {
  const ENFORCEMENT = 'Enforcement'
  const present = (c: ReturnType<typeof of>) =>
    sections(c).that().areNamed(ENFORCEMENT).should().haveCodePointer()
  const held = (c: ReturnType<typeof of>) => docs(c).should().haveSection(ENFORCEMENT)
  const live = (c: ReturnType<typeof of>) =>
    pointers(c)
      .that()
      .satisfy(inSections(sectionsNamed(ENFORCEMENT)))
      .should()
      .resolve()
  const SOURCE = { 'src/x.ts': ['export const a = 1', 'export const b = 2'] }

  it('a live pointer in the section: both rules pass', () => {
    const c = of({ ...SOURCE, 'a.md': ['## Enforcement', '', 'See `src/x.ts:2`.'] })
    expect(present(c).violations()).toHaveLength(0)
    expect(live(c).violations()).toHaveLength(0)
  })

  it('a stale pointer in the section: the presence rule passes and the liveness rule reds', () => {
    const c = of({ ...SOURCE, 'a.md': ['## Enforcement', '', 'See `src/x.ts:40`.'] })
    expect(present(c).violations()).toHaveLength(0)
    expect(live(c).violations()).toHaveLength(1)
  })

  it('no pointer in the section: the presence rule reds, which the liveness rule alone cannot', () => {
    const c = of({
      ...SOURCE,
      'a.md': ['## Enforcement', '', 'Nothing cited.', '', '## Other', '', 'See `src/x.ts:2`.'],
    })
    expect(said(present(c).violations())).toEqual([
      'a.md:1: section "Enforcement" holds no code pointer',
    ])
    expect(live(c).violations().examined).toBe(0)
  })

  it('a document without the section fails the recipe', () => {
    const c = of({
      ...SOURCE,
      'a.md': ['## Enforcement', '', 'See `src/x.ts:2`.'],
      'b.md': ['# B', '', 'No enforcement section.'],
    })
    // The two section rules see nothing of b.md, and stay green.
    expect(present(c).violations()).toHaveLength(0)
    expect(live(c).violations()).toHaveLength(0)
    // The document rule is the one that names it.
    expect(said(held(c).violations())).toEqual(['b.md: missing section "Enforcement"'])
  })
})
