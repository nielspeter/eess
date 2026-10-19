/**
 * Bug 0502: links read a heading inside a list or blockquote the way tables and sections do. A
 * heading in a container does not start a section, so it scopes no link, inside its container or
 * after it; the rule names it instead. Every row drives `links()` and `docs()` over a throwaway tree.
 */
import { describe, it, expect } from 'vitest'
import { corpus, docs, links, sections, type ArchViolation, type MdLink } from '../src/index.js'
import { tree } from './helpers/tree.js'

const of = (files: Readonly<Record<string, string>>) =>
  corpus({ cwd: tree({ 'b.md': '# B\n', ...files }), roots: ['**/*.md'] })

const DROP = [
  '# Top',
  '',
  '## Real',
  '',
  '### Sub',
  '',
  '[before](b.md)',
  '',
  '- ## Listed',
  '',
  '  text',
  '',
  '[after](b.md)',
  '',
  '| t   |',
  '| --- |',
  '| 1   |',
  '',
].join('\n')

const OVER = [
  '# Top',
  '',
  '> ## Quoted',
  '>',
  '> [x](b.md)',
  '',
  '- ## Listed',
  '',
  '  [y](b.md)',
  '',
  '[z](b.md)',
  '',
].join('\n')

/** The links an `areInSection(name)` rule selects, by text and line. */
const inSection = (c: ReturnType<typeof of>, name: string): string[] =>
  links(c)
    .that()
    .areInSection(name)
    .select({ label: 'link', identify: (l) => ({ name: l.text }) })
    .elements.map((l: MdLink) => `${l.text}@${String(l.line)}`)

const said = (vs: readonly ArchViolation[]): string[] => vs.map((v) => `${v.element}: ${v.message}`)

describe('bug 0502: links read the section index', () => {
  it('the drop direction: a link under a real section after a listed heading keeps the section', () => {
    const c = of({ 'a.md': DROP })
    expect(inSection(c, 'Sub')).toEqual(['before@7', 'after@13'])
    expect(inSection(c, 'Real')).toEqual(['before@7', 'after@13'])
  })

  it('the over-selection direction: a heading in a container scopes no link after it', () => {
    const c = of({ 'a.md': OVER })
    expect(inSection(c, 'Listed')).not.toContain('z@11')
    expect(inSection(c, 'Quoted')).toEqual([])
  })

  it('a link and the table under one heading report the same sectionPath', () => {
    const c = of({ 'a.md': DROP })
    const after = links(c)
      .that()
      .satisfy({ description: 'after', test: (l: MdLink) => l.text === 'after' })
      .select({ label: 'link', identify: (l) => ({ name: l.text }) }).elements[0]
    const [doc] = docs(c)
      .that()
      .resideInFile('a.md')
      .select({ label: 'doc', identify: (d) => ({ name: d.relPath }) }).elements
    expect(after?.sectionPath).toEqual(['Top', 'Real', 'Sub'])
    expect(after?.sectionPath).toEqual(doc?.tables[0]?.sectionPath)
  })

  it('a link inside the container is not in the container’s heading either; the rule names it', () => {
    // Decided from ADR-009 (one word, one meaning across the package): `areInSection` reads sections,
    // and a heading in a container is not one. No links-only exception: the rule says why it reads
    // nothing instead of selecting by a different walk.
    const c = of({ 'a.md': OVER })
    expect(inSection(c, 'Listed')).toEqual([])
    const v = links(c).that().areInSection('Listed').should().notExist().violations()
    expect(said(v)).toEqual([
      'a.md → section "Listed" (in a list item): the heading "Listed" at line 7 is inside a list item, which does not start a section, so this rule does not read it',
    ])
  })

  it('links and sections agree on what areInSection selects', () => {
    const c = of({ 'a.md': DROP })
    const sectionNames = sections(c)
      .that()
      .areInSection('Real')
      .select({ label: 's', identify: (s) => ({ name: s.name }) })
      .elements.map((s) => s.name)
    expect(sectionNames).toEqual(['Sub'])
    expect(inSection(c, 'Listed')).toEqual([])
  })
})
