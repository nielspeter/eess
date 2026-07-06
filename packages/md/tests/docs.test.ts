import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, docs } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')

describe('corpus() + docs()', () => {
  it('loads markdown documents, sections and tables', () => {
    const c = corpus({ roots: ['docs/good.md', 'docs/bad.md'], cwd: fixtureRoot })
    const all = c.documents()
    expect(all.map((d) => d.relPath).sort()).toEqual(['docs/bad.md', 'docs/good.md'])

    const good = all.find((d) => d.relPath === 'docs/good.md')
    expect(good?.sections.map((s) => s.name)).toContain('Enforcement')
    expect(good?.tables[0]?.header).toEqual(['Clause', 'Tier', 'Status'])
    expect(good?.tables[0]?.sectionPath).toContain('Enforcement')
  })

  it('haveSection (condition) passes when every doc has the section', () => {
    const c = corpus({ roots: ['docs/good.md'], cwd: fixtureRoot })
    expect(() => docs(c).should().haveSection('Enforcement').check()).not.toThrow()
  })

  it('haveSection (condition) fails when a doc lacks the section', () => {
    const c = corpus({ roots: ['docs/good.md', 'docs/bad.md'], cwd: fixtureRoot })
    expect(() => docs(c).should().haveSection('Enforcement').check()).toThrow()
    const v = docs(c).should().haveSection('Enforcement').violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.element).toBe('docs/bad.md')
    expect(v[0]?.message).toMatch(/missing section/)
  })

  it('haveSection (predicate) scopes the rule to matching docs', () => {
    const c = corpus({ roots: ['docs/*.md'], cwd: fixtureRoot })
    // only docs WITH an Enforcement section must carry a Tier column — bad.md is excluded
    expect(() =>
      docs(c)
        .that()
        .haveSection('Enforcement')
        .should()
        .haveTable({ columns: [/tier/i] })
        .check(),
    ).not.toThrow()
  })

  it('haveTable fails when a required column is missing', () => {
    const c = corpus({ roots: ['docs/good.md'], cwd: fixtureRoot })
    const v = docs(c)
      .should()
      .haveTable({ columns: [/mechanism/i] })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/required columns/)
  })

  it('frozen membership defaults to completed/archived', () => {
    const c = corpus({ roots: ['docs/*.md'], cwd: fixtureRoot })
    expect(c.documents().every((d) => d.frozen === false)).toBe(true)
  })
})
