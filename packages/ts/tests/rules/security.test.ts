import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import {
  noEval,
  noFunctionConstructor,
  noProcessEnv,
  noConsoleLog,
  noConsole,
  noJsonParse,
} from '../../src/rules/security.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/rules')

const project = new Project({
  tsConfigFilePath: path.join(fixturesDir, 'tsconfig.json'),
})

function findClass(name: string) {
  const cls = project
    .getSourceFiles()
    .flatMap((sf) => sf.getClasses())
    .find((c) => c.getName() === name)
  if (!cls) throw new Error(`Fixture class not found: ${name}`)
  return cls
}

const context = { rule: 'test rule' }

/**
 * The expected violation lines, derived from the fixture's TEXT rather than from
 * the AST the rule itself walks — ADR-009 rule 5: a derivation is unguarded until
 * a differently-derived value can disagree with it. Hand-typing `[25, 29, 34]`
 * here would agree with the rule by construction and survive any fixture edit.
 */
function fixtureLinesMatching(fileName: string, pattern: RegExp): number[] {
  const sourceFile = project.getSourceFiles().find((sf) => sf.getBaseName() === fileName)
  if (!sourceFile) throw new Error(`Fixture file not found: ${fileName}`)
  return sourceFile
    .getFullText()
    .split('\n')
    .flatMap((text, index) => (pattern.test(text) ? [index + 1] : []))
}

/** The line each violation's message names, ascending. */
function reportedLines(violations: readonly { message: string }[]): number[] {
  return violations.map((v) => Number(/at line (\d+)/.exec(v.message)?.[1])).sort((a, b) => a - b)
}

describe('security rules', () => {
  describe('noEval()', () => {
    it('detects eval() calls', () => {
      const condition = noEval()
      const violations = condition.evaluate([findClass('SecurityViolationClass')], context)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.message.includes('eval'))).toBe(true)
    })

    it('passes for clean class', () => {
      const condition = noEval()
      const violations = condition.evaluate([findClass('CleanService')], context)
      expect(violations).toHaveLength(0)
    })
  })

  describe('noFunctionConstructor()', () => {
    it('detects new Function() calls', () => {
      const condition = noFunctionConstructor()
      const violations = condition.evaluate([findClass('SecurityViolationClass')], context)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.message.includes('Function'))).toBe(true)
    })

    it('passes for clean class', () => {
      const condition = noFunctionConstructor()
      const violations = condition.evaluate([findClass('CleanService')], context)
      expect(violations).toHaveLength(0)
    })
  })

  describe('noProcessEnv()', () => {
    it('detects process.env access', () => {
      const condition = noProcessEnv()
      const violations = condition.evaluate([findClass('SecurityViolationClass')], context)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.message.includes('process.env'))).toBe(true)
    })

    it('passes for clean class', () => {
      const condition = noProcessEnv()
      const violations = condition.evaluate([findClass('CleanService')], context)
      expect(violations).toHaveLength(0)
    })
  })

  describe('noConsoleLog()', () => {
    it('detects console.log calls', () => {
      const condition = noConsoleLog()
      const violations = condition.evaluate([findClass('SecurityViolationClass')], context)
      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.message.includes('console.log'))).toBe(true)
    })

    it('passes for clean class', () => {
      const condition = noConsoleLog()
      const violations = condition.evaluate([findClass('CleanService')], context)
      expect(violations).toHaveLength(0)
    })
  })
  /**
   * Bug 0186. Both rules below shipped as exported, documented public API while
   * being **unfalsifiable**: gutting either so it could never report left all
   * 3510 tests green. `noConsoleLog` and `noEval` covered the shared
   * `classNotContain` plumbing; what nothing pinned was each rule's own
   * discriminating argument, which is the whole of what it contributes.
   */
  describe('noConsole()', () => {
    it('flags every console access, at the lines the fixture text independently says', () => {
      const expectedLines = fixtureLinesMatching('console-json-class.ts', /console\./)
      // Guards the derivation itself: an empty scan would make the comparison
      // below pass against zero violations — the exact vacuous green this bug is
      // about (ADR-010).
      expect(expectedLines).toHaveLength(3)

      const violations = noConsole().evaluate([findClass('NonLogConsoleClass')], context)
      expect(reportedLines(violations)).toEqual(expectedLines)
    })

    it('flags an access that is never called — a call matcher cannot see it', () => {
      const neverCalled = fixtureLinesMatching('console-json-class.ts', /console\.table/)
      expect(neverCalled).toHaveLength(1)

      const violations = noConsole().evaluate([findClass('NonLogConsoleClass')], context)
      expect(reportedLines(violations)).toContain(neverCalled[0])
    })

    it('is not interchangeable with noConsoleLog() — same class, opposite verdicts', () => {
      const cls = findClass('NonLogConsoleClass')
      expect(noConsole().evaluate([cls], context).length).toBeGreaterThan(0)
      expect(noConsoleLog().evaluate([cls], context)).toHaveLength(0)
    })

    it('passes for clean class', () => {
      expect(noConsole().evaluate([findClass('CleanService')], context)).toHaveLength(0)
    })

    it('describes itself by its matcher — the string baselines hash on', () => {
      // `description` becomes `violation.rule`, and `hashViolation` keys on
      // `rule::subject`. Changing this string silently moves every baselined
      // entry for this rule, so it is frozen deliberately rather than left to
      // drift. It is also the only place output distinguishes this rule from
      // `noConsoleLog`.
      expect(noConsole().description).toBe('not contain access matching /^console\\./')
      expect(noConsole().description).not.toBe(noConsoleLog().description)
    })
  })

  describe('noJsonParse()', () => {
    it('detects JSON.parse at the line the fixture text independently says', () => {
      const expectedLines = fixtureLinesMatching('console-json-class.ts', /JSON\.parse/)
      expect(expectedLines).toHaveLength(1)

      const violations = noJsonParse().evaluate([findClass('JsonRoundTripClass')], context)
      expect(reportedLines(violations)).toEqual(expectedLines)
      expect(violations[0]?.message).toContain('JSON.parse')
    })

    it('stays quiet on a class that only writes JSON — the member name is load-bearing', () => {
      expect(noJsonParse().evaluate([findClass('JsonWriterClass')], context)).toHaveLength(0)
    })

    it('passes for clean class', () => {
      expect(noJsonParse().evaluate([findClass('CleanService')], context)).toHaveLength(0)
    })

    it('describes itself by its matcher — the string baselines hash on', () => {
      expect(noJsonParse().description).toBe("not contain call to 'JSON.parse'")
    })
  })
})
