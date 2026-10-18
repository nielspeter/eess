/**
 * ADR-021 (plan 0486): eess-ts's own `not`/`and`/`or` carry `undecided` from the kernel's one truth
 * table, and eess-ts's builders, which hand back no undecided findings of their own, refuse an
 * undecided subject through the kernel's `matchingElements` rather than drop it.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import type { ClassDeclaration } from 'ts-morph'
import { project, classes, not, and, or, type Predicate } from '../../src/index.js'

const tsconfig = path.resolve(import.meta.dirname, '../fixtures/architecture/tsconfig.json')
const cannotJudge: Predicate<ClassDeclaration> = {
  description: 'have a readable status',
  undecided: (c) => [
    {
      file: 'status.md',
      line: 1,
      element: c.getName() ?? '<anonymous>',
      message: 'status cannot be read',
    },
  ],
  test: () => {
    throw new Error('test() called on an undecided subject')
  },
}
const always: Predicate<ClassDeclaration> = { description: 'always', test: () => true }

describe('eess-ts refuses an undecided subject (ADR-021)', () => {
  it('not() carries undecided, and the builder refuses naming the cause', () => {
    expect(not(cannotJudge).undecided).toBeDefined()
    const rule = classes(project(tsconfig)).that().satisfy(not(cannotJudge)).should().notExist()
    expect(() => rule.violations()).toThrow(/status cannot be read/)
    // The refusal names this door and a remedy true here, not the kernel's reporting terminals.
    expect(() => rule.violations()).toThrow(
      /^an eess-ts rule cannot answer.*refuse an undecided subject/s,
    )
  })
  it('and() and or() decide from the kernel truth table', () => {
    const p = project(tsconfig)
    const never: Predicate<ClassDeclaration> = { description: 'never', test: () => false }
    // A decided branch decides: or(true, ?) selects every class, and(false, ?) selects none.
    const all = classes(p).that().satisfy(or(always, cannotJudge)).should().notExist()
    expect(all.violations().every((v) => v.message.includes('should not exist'))).toBe(true)
    expect(all.violations().length).toBeGreaterThan(0)
    const none = classes(p).that().satisfy(and(never, cannotJudge)).should().notExist()
    expect(() => none.violations()).not.toThrow()
    // An undecided branch the other does not decide is refused.
    const andTrue = classes(p).that().satisfy(and(always, cannotJudge)).should().notExist()
    expect(() => andTrue.violations()).toThrow(/status cannot be read/)
    const orFalse = classes(p).that().satisfy(or(never, cannotJudge)).should().notExist()
    expect(() => orFalse.violations()).toThrow(/status cannot be read/)
  })
  it('select() refuses with a remedy that is true in eess-ts', () => {
    const rule = classes(project(tsconfig)).that().satisfy(cannotJudge)
    const select = () =>
      rule.select({ label: 'class', identify: (c) => ({ name: c.getName() ?? '' }) })
    expect(select).toThrow(/^select\(\) cannot answer.*refuse an undecided subject/s)
    expect(select).not.toThrow(/check\(\)/)
  })
})
