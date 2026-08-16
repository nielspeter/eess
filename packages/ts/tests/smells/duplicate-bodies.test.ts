import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import { project } from '../../src/core/project.js'
import { smells } from '../../src/smells/index.js'
import { ArchRuleError } from '@nielspeter/eess'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/smells/duplicate-bodies')

describe('smells.duplicateBodies()', () => {
  const p = project(path.join(fixturesDir, 'tsconfig.json'))

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('flags near-identical function bodies above threshold', () => {
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    expect(() => builder.check()).toThrow(ArchRuleError)
  })

  it('violation message contains similarity percentage', () => {
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    try {
      builder.check()
      expect.fail('Expected ArchRuleError')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ArchRuleError)
      const archErr = err as ArchRuleError
      expect(archErr.violations.length).toBeGreaterThan(0)
      expect(archErr.violations[0]!.message).toMatch(/\d+% similar to/)
    }
  })

  it('does not flag different functions below threshold', () => {
    // With threshold 1.0, only exact structural matches are flagged
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(1.0)
    expect(() => builder.check()).not.toThrow()
  })

  it('respects minLines filter — a minLines high enough to exclude everything is a dead selector', () => {
    // With a very high minLines, no functions qualify
    const builder = smells.duplicateBodies(p).minLines(1000).withMinSimilarity(0.5)
    try {
      builder.check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]!.message).toMatch(/examined zero units/)
    }
  })

  it('respects minLines filter — passes when declared with .expectEmpty()', () => {
    const builder = smells.duplicateBodies(p).minLines(1000).withMinSimilarity(0.5).expectEmpty()
    expect(() => builder.check()).not.toThrow()
  })

  it('.warn() logs but does not throw', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).warn()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('.check() throws ArchRuleError with violations', () => {
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    try {
      builder.check()
      expect.fail('Expected ArchRuleError')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ArchRuleError)
      const archErr = err as ArchRuleError
      expect(archErr.violations.length).toBeGreaterThan(0)
    }
  })

  it('withMinSimilarity(1.0) only flags exact structural matches', () => {
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(1.0)
    // file-a and file-b are near-clones but not identical structure
    expect(() => builder.check()).not.toThrow()
  })

  it('describe() reflects the configured threshold', () => {
    const builder = smells.duplicateBodies(p).withMinSimilarity(0.9)
    // Access describe via check error message
    try {
      builder.minLines(3).check()
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ArchRuleError)
      const archErr = err as ArchRuleError
      expect(archErr.violations[0]!.rule).toContain('0.9')
    }
  })

  it('minDistinctVocabulary() rejects a pair whose shape matches but has too little vocabulary to be evidence of anything', () => {
    // A prohibitively high floor makes even this genuine near-duplicate pair
    // uninformative by definition — proves the floor is consulted at all.
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .minDistinctVocabulary(1000)
    expect(() => builder.check()).not.toThrow()
  })

  it('minDistinctVocabulary() defaults low enough that the fixture pair still flags', () => {
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    expect(() => builder.check()).toThrow(ArchRuleError)
  })

  it('withMinSimilarity()/minDistinctVocabulary() copy, not mutate — a held builder is unaffected by a later call on it', () => {
    // Bug-0016 class (plan 0147): both setters must copy `this`, or a second
    // rule built from the same held selection silently inherits the first
    // rule's threshold.
    const held = smells.duplicateBodies(p).minLines(3)
    const strict = held.withMinSimilarity(1.0) // exact matches only — passes
    held.withMinSimilarity(0.5) // mutates only if the bug is back
    expect(() => strict.check()).not.toThrow()
  })

  it('.because() includes reason in violations', () => {
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .because('Extract shared logic')

    try {
      builder.check()
      expect.fail('Expected ArchRuleError')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ArchRuleError)
      const archErr = err as ArchRuleError
      expect(archErr.violations[0]!.because).toBe('Extract shared logic')
    }
  })

  it('groupByFolder() does not change violation count', () => {
    const builderPlain = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    const builderGrouped = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .groupByFolder()

    let plainCount = 0
    let groupedCount = 0

    try {
      builderPlain.check()
    } catch (err: unknown) {
      const archErr = err as ArchRuleError
      plainCount = archErr.violations.length
    }

    try {
      builderGrouped.check()
    } catch (err: unknown) {
      const archErr = err as ArchRuleError
      groupedCount = archErr.violations.length
    }

    expect(groupedCount).toBe(plainCount)
    expect(plainCount).toBeGreaterThan(0)
  })
})
