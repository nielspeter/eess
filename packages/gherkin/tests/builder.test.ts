import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ArchRuleError } from '@nielspeter/eess'
import { features, scenarios } from '../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('scenarios() rule builder', () => {
  it('flags duplicate scenario titles within one feature file (red)', () => {
    const set = features({ cwd: FIXTURES, roots: ['duplicate-titles.feature'] })
    const violations = scenarios(set)
      .should()
      .haveUniqueTitles()
      .rule({ id: 'gherkin/unique-titles' })
      .violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('duplicate scenario title "Same name"')
    expect(violations[0]?.line).toBe(4)
  })

  it('passes a corpus with unique titles (green, non-vacuous)', () => {
    const set = features({
      cwd: FIXTURES,
      roots: ['job-management.feature', 'docstring-guard.feature'],
    })
    const builder = scenarios(set).should().haveUniqueTitles()
    expect(
      builder.select({ label: 'scenario', identify: (s) => ({ name: s.title }) }).elements.length,
    ).toBe(4)
    expect(builder.violations()).toHaveLength(0)
  })

  it('check() throws ArchRuleError on violation', () => {
    const set = features({ cwd: FIXTURES, roots: ['duplicate-titles.feature'] })
    expect(() => scenarios(set).should().haveUniqueTitles().check()).toThrow(ArchRuleError)
  })

  it('haveTag and resideInFeatureFile filter scenarios', () => {
    const set = features({ cwd: FIXTURES, roots: ['**/*.feature'] })
    const tagged = scenarios(set).that().haveTag('slow')
    expect(
      tagged
        .select({ label: 'scenario', identify: (s) => ({ name: s.title }) })
        .elements.map((s) => s.title),
    ).toEqual(['Trigger job manually'])
    const inFile = scenarios(set).that().resideInFeatureFile('duplicate-titles.feature')
    expect(
      inFile.select({ label: 'scenario', identify: (s) => ({ name: s.title }) }).elements,
    ).toHaveLength(2)
  })
})
