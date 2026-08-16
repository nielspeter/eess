import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import { project } from '../../src/core/project.js'
import { smells } from '../../src/smells/index.js'
import { call } from '../../src/helpers/matchers.js'
import { ArchRuleError } from '@nielspeter/eess'

const dupFixturesDir = path.resolve(import.meta.dirname, '../fixtures/smells/duplicate-bodies')
const sibFixturesDir = path.resolve(import.meta.dirname, '../fixtures/smells/inconsistent-siblings')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SmellBuilder.ignoreTests()', () => {
  it('ignoreTests on duplicateBodies does not crash', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const builder = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).ignoreTests()
    // The fixture dir has no test files so ignoreTests is a no-op but should not error
    expect(() => builder.check()).toThrow(ArchRuleError)
  })

  it('ignoreTests on inconsistentSiblings does not crash', () => {
    const p = project(path.join(sibFixturesDir, 'tsconfig.json'))
    const builder = smells
      .inconsistentSiblings(p)
      .forPattern(call('this.extractCount'))
      .minLines(2)
      .ignoreTests()
    expect(() => builder.check()).toThrow(ArchRuleError)
  })
})

describe('SmellBuilder.ignorePaths()', () => {
  it('ignorePaths excludes matching files from duplicateBodies — ignoring everything is a dead selector', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    // Ignoring all .ts files should result in no functions to compare
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .ignorePaths('**/*.ts')
    try {
      builder.check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]!.message).toMatch(/examined zero units/)
    }
  })

  it('ignorePaths excludes matching files from duplicateBodies — passes when declared with .expectEmpty()', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .ignorePaths('**/*.ts')
      .expectEmpty()
    expect(() => builder.check()).not.toThrow()
  })

  it('ignorePaths excludes matching files from inconsistentSiblings — ignoring everything is a dead selector', () => {
    const p = project(path.join(sibFixturesDir, 'tsconfig.json'))
    const builder = smells
      .inconsistentSiblings(p)
      .forPattern(call('this.extractCount'))
      .minLines(2)
      .ignorePaths('**/*.ts')
    try {
      builder.check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]!.message).toMatch(/examined zero units/)
    }
  })

  it('ignorePaths excludes matching files from inconsistentSiblings — passes when declared with .expectEmpty()', () => {
    const p = project(path.join(sibFixturesDir, 'tsconfig.json'))
    const builder = smells
      .inconsistentSiblings(p)
      .forPattern(call('this.extractCount'))
      .minLines(2)
      .ignorePaths('**/*.ts')
      .expectEmpty()
    expect(() => builder.check()).not.toThrow()
  })

  it('branches from a held selection via .because() do not leak scoping into each other', () => {
    // Regression for the copy() shallow-copy trap (plan 0088 Phase 4 review):
    // without its own copy() override, SmellBuilder's _ignorePaths array is
    // shared by reference across two .because()-derived branches. file-a.ts
    // and file-b.ts are a genuine near-duplicate pair (see "flags
    // near-identical function bodies above threshold"); branch A legitimately
    // excludes file-b.ts to make ITS OWN check pass — if that exclusion
    // leaked into branch B, branch B would silently miss the same duplicate
    // it never asked to ignore.
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const base = smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8)
    const a = base.because('branch A').ignorePaths('**/file-b.ts')
    const b = base.because('branch B')
    // Branch A's own exclusion took effect (plan 0147: ignorePaths() itself
    // must copy, not mutate `this`, or this assertion is meaningless — the
    // chain call above returning a discarded value would leave `a` and `b`
    // both pointed at the SAME underlying builder).
    expect(() => a.check()).not.toThrow()
    expect(() => b.check()).toThrow(ArchRuleError)
  })

  it('ignorePaths can be called multiple times', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .ignorePaths('**/nonexistent/**')
      .ignorePaths('**/also-nonexistent/**')
    // No paths match so original violations still apply
    expect(() => builder.check()).toThrow(ArchRuleError)
  })
})

describe('SmellBuilder.inFolder()', () => {
  it('inFolder restricts scope to matching files — a folder with no matches is a dead selector', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .inFolder('**/nonexistent/**')
    try {
      builder.check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]!.message).toMatch(/examined zero units/)
    }
  })

  it('inFolder restricts scope to matching files — passes when declared with .expectEmpty()', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const builder = smells
      .duplicateBodies(p)
      .minLines(3)
      .withMinSimilarity(0.8)
      .inFolder('**/nonexistent/**')
      .expectEmpty()
    expect(() => builder.check()).not.toThrow()
  })
})

describe('SmellBuilder.warn() output formats', () => {
  it('warn with json format outputs JSON', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).warn({ format: 'json' })
    expect(warnSpy).toHaveBeenCalled()
    // JSON output should start with [ or { or be valid JSON
    const output = String(warnSpy.mock.calls[0]?.[0] ?? '')
    expect(output.startsWith('[') || output.startsWith('{')).toBe(true)
  })

  it('warn with github format writes to stdout', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).warn({ format: 'github' })
    expect(writeSpy).toHaveBeenCalled()
    const output = String(writeSpy.mock.calls[0]?.[0] ?? '')
    expect(output).toContain('::warning')
  })

  it('warn with terminal format outputs to console.warn', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).warn({ format: 'terminal' })
    expect(warnSpy).toHaveBeenCalled()
  })

  it('warn does nothing when no violations', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    // minLines(1000) excludes every function — declare the empty result
    // intentional so the zero-examined finding doesn't itself warn.
    smells.duplicateBodies(p).minLines(1000).withMinSimilarity(0.5).expectEmpty().warn()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('SmellBuilder.check() output formats', () => {
  it('check with github format writes annotations before throwing', () => {
    const p = project(path.join(dupFixturesDir, 'tsconfig.json'))
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(() => {
      smells.duplicateBodies(p).minLines(3).withMinSimilarity(0.8).check({ format: 'github' })
    }).toThrow(ArchRuleError)
    expect(writeSpy).toHaveBeenCalled()
    const output = String(writeSpy.mock.calls[0]?.[0] ?? '')
    expect(output).toContain('::error')
  })
})
