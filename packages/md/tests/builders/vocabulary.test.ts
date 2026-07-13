import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus, terms, vocabulary } from '../../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'vocabulary')
const c = () => corpus({ cwd: FIXTURES, roots: ['**'] })

describe('vocabulary()', () => {
  it('derives terms from folder basenames matching the glob', () => {
    const vocab = vocabulary(c(), { fromFolders: 'domain/*-context' })
    expect([...vocab.terms].sort()).toEqual(['auth-context', 'billing-context'])
  })

  it('derives terms from headings at a given depth', () => {
    const vocab = vocabulary(c(), { fromHeadings: { files: 'meta/glossary.md', depth: 2 } })
    expect([...vocab.terms].sort()).toEqual(['Invoice', 'Ledger'])
  })

  it('unions explicit terms and applies normalize to both sides', () => {
    const vocab = vocabulary(c(), {
      terms: ['  Billing  '],
      normalize: (s) => s.trim().toLowerCase(),
    })
    expect(vocab.terms.has('billing')).toBe(true)
  })
})

describe('terms().resolveAgainst()', () => {
  it('passes when every labeled reference is a vocabulary term (green, non-vacuous)', () => {
    const vocab = vocabulary(c(), { fromFolders: 'domain/*-context' })
    const builder = terms(c(), { label: /\*\*Bounded Context:\*\*/ })
      .that()
      .resideInFile('{entity.md,domain/**}')
      .should()
      .resolveAgainst(vocab)
    const seen = builder.select({
      label: 'reference',
      identify: (t) => ({ name: t.value }),
    }).elements
    expect(seen.length).toBe(3) // entity.md + two overviews; the fenced one excluded
    expect(builder.violations()).toHaveLength(0)
  })

  it('flags a reference that names no known term (red)', () => {
    const vocab = vocabulary(c(), { fromFolders: 'domain/*-context' })
    const violations = terms(c(), { label: /\*\*Bounded Context:\*\*/ })
      .should()
      .resolveAgainst(vocab)
      .rule({ id: 'vocab/bounded-context' })
      .violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain("'ordering-context' does not resolve")
    expect(violations[0]?.file.endsWith('bad-entity.md')).toBe(true)
  })

  it('resolves glossary references against heading-derived terms', () => {
    const vocab = vocabulary(c(), { fromHeadings: { files: 'meta/glossary.md', depth: 2 } })
    const violations = terms(c(), { label: /\*\*Glossary term:\*\*/ })
      .should()
      .resolveAgainst(vocab)
      .violations()
    expect(violations).toHaveLength(1) // 'Waybill' in bad-entity.md; 'Invoice' resolves
    expect(violations[0]?.message).toContain("'Waybill'")
  })

  it('check() throws ArchRuleError', () => {
    const vocab = vocabulary(c(), { fromFolders: 'domain/*-context' })
    expect(() =>
      terms(c(), { label: /\*\*Bounded Context:\*\*/ })
        .should()
        .resolveAgainst(vocab)
        .check(),
    ).toThrow(ArchRuleError)
  })

  it('never reads fenced code as a reference', () => {
    const all = terms(c(), { label: /\*\*Bounded Context:\*\*/ }).select({
      label: 'reference',
      identify: (t) => ({ name: t.value }),
    }).elements
    expect(all.map((t) => t.value)).not.toContain('fenced-context')
  })
})
