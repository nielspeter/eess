import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { maxCyclomaticComplexity } from '../../src/rules/metrics.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0310 — `cyclomaticComplexity` counts the decisions below a body, not the body itself. A block
 * body is never a decision, but an expression body can be: `(a, b) => a && b` and
 * `(a) => a ? 1 : 2` measure 1, while the same decision one node down measures 2.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0310 turns it red. The CONTROL is the same
 * decision inside parentheses or a block, which is counted.
 */
function project(path: string, lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(path, [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0310: a decision at the root of an expression body is not counted', () => {
  it('KNOWN GAP — an expression body that is itself a decision measures complexity 1', () => {
    const p = project('/src/root.ts', [
      'export class Root {',
      '  onAnd = (a: boolean, b: boolean) => a && b',
      '  onNullish = (a?: number) => a ?? 0',
      '  onTernary = (a: boolean) => a ? 1 : 2',
      '}',
    ])

    const result = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(0))
      .rule({ id: 'test/0310-root' })
      .violations()

    // Each is measured, at 1: the decision that is the body is not counted.
    expect(result.map((v) => v.message)).toEqual([
      'Root.onAnd has cyclomatic complexity 1 (max: 0) — split into smaller methods',
      'Root.onNullish has cyclomatic complexity 1 (max: 0) — split into smaller methods',
      'Root.onTernary has cyclomatic complexity 1 (max: 0) — split into smaller methods',
    ])
  })

  it('CONTROL — the same decision one node below the body is counted', () => {
    const p = project('/src/below.ts', [
      'export class Below {',
      '  onParen = (a: boolean) => (a ? 1 : 2)',
      '  onBlock = (a: boolean) => { return a ? 1 : 2 }',
      '}',
    ])

    const result = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(1))
      .rule({ id: 'test/0310-below' })
      .violations()

    expect(result.map((v) => v.message)).toEqual([
      'Below.onParen has cyclomatic complexity 2 (max: 1) — split into smaller methods',
      'Below.onBlock has cyclomatic complexity 2 (max: 1) — split into smaller methods',
    ])
  })
})
