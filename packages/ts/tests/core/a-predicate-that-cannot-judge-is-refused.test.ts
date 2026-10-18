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
    // A true branch decides or(): every class is selected, nothing is refused.
    const decided = classes(p).that().satisfy(or(always, cannotJudge)).should().notExist()
    expect(decided.violations().length).toBeGreaterThan(0)
    // and() with a true branch leaves the subject undecided, and the builder refuses it.
    const undecided = classes(p).that().satisfy(and(always, cannotJudge)).should().notExist()
    expect(() => undecided.violations()).toThrow(/status cannot be read/)
  })
})
