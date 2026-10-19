import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ArchRuleError } from '@nielspeter/eess'
import { features, scenarios } from '../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('scenarios() rule builder', () => {
  it('flags every member of a duplicate title within one feature file (red)', () => {
    const set = features({ cwd: FIXTURES, roots: ['duplicate-titles.feature'] })
    const violations = scenarios(set)
      .should()
      .haveUniqueTitles()
      .rule({ id: 'gherkin/unique-titles' })
      .violations()
    expect(violations.map((v) => [v.element, v.line, v.ruleId, v.message])).toEqual([
      [
        'duplicate-titles.feature:2 › Same name',
        2,
        'gherkin/unique-titles',
        'duplicate-titles.feature › Same name has the same title as 1 other: ' +
          'duplicate-titles.feature:4; titles must be unique within a feature file, ' +
          'or a citation of one is ambiguous',
      ],
      [
        'duplicate-titles.feature:4 › Same name',
        4,
        'gherkin/unique-titles',
        'duplicate-titles.feature › Same name has the same title as 1 other: ' +
          'duplicate-titles.feature:2; titles must be unique within a feature file, ' +
          'or a citation of one is ambiguous',
      ],
    ])
  })

  // Plan 0459: the key is per feature file. A key without `relPath` would group these two.
  it('passes the same title in two different feature files', () => {
    const set = features({
      cwd: FIXTURES,
      roots: ['same-title-a.feature', 'same-title-b.feature'],
    })
    const builder = scenarios(set).should().haveUniqueTitles()
    expect(
      builder.select({ label: 'scenario', identify: (s) => ({ name: s.title }) }).elements.length,
    ).toBe(2)
    expect(builder.rule({ id: 'gherkin/unique-titles' }).violations()).toHaveLength(0)
  })

  // Plan 0459: each member's element carries its line, so excluding one member cannot hide the pair.
  it('excluding one member of a duplicate pair leaves the other red', () => {
    const set = features({ cwd: FIXTURES, roots: ['duplicate-titles.feature'] })
    const violations = scenarios(set)
      .should()
      .haveUniqueTitles()
      .rule({ id: 'gherkin/unique-titles' })
      .excluding('duplicate-titles.feature:4 › Same name')
      .violations()
    expect(violations.map((v) => [v.element, v.line])).toEqual([
      ['duplicate-titles.feature:2 › Same name', 2],
    ])
  })

  // The key is `relPath` + U+0000 + `title`. Testing review measured that NOTHING
  // constrained the separator: deleting it outright left all nine tests green, so
  // an agent "fixing" the raw-NUL byte could have dropped the composite key
  // entirely and every gate would have stayed green. The existing duplicate-title
  // test does not catch it — its `toHaveLength(1)` is satisfied by a key of
  // `title` alone.
  //
  // These two fixtures are the collision that separator prevents. Concatenated
  // without it both sides read `key-collision.feature.featureShared`; with any
  // separator that cannot occur in a path or a title, they differ. So this test
  // is green now and reds the moment the separator goes — which is what the
  // encoding fix in bug 0099 was quietly relying on and nothing checked.
  it('does not collide two scenarios whose path and title concatenate alike', () => {
    const set = features({
      cwd: FIXTURES,
      roots: ['key-collision.feature', 'key-collision.feature.feature'],
    })
    const builder = scenarios(set).should().haveUniqueTitles()
    // Non-vacuous: both scenarios really were examined.
    expect(
      builder.select({ label: 'scenario', identify: (s) => ({ name: s.title }) }).elements.length,
    ).toBe(2)
    expect(builder.rule({ id: 'gherkin/unique-titles' }).violations()).toHaveLength(0)
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
