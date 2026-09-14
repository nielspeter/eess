import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { functionNoEval } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0315 — the function builder collects function declarations, a variable whose initializer is
 * itself a function, and class methods. It does not collect a constructor, an accessor, a class
 * property whose value is a function, or a variable whose function sits inside parentheses or behind
 * `as`, so no function rule reads them.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0315 turns it red. The method `m` and the
 * variable `plain` are collected, and are the test's control.
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

describe('bug 0315: the function builder collects some function shapes', () => {
  it('KNOWN GAP — a constructor, an accessor, a function-valued property and a wrapped function are not collected', () => {
    const p = project('/src/shapes.ts', [
      'export class Service {', // 1
      "  m() { return eval('m') }", // 2
      "  constructor() { eval('c') }", // 3
      "  get g() { return eval('g') }", // 4
      "  handler = () => eval('h')", // 5
      '}', // 6
      'export const wrapped = ((x: string) => eval(x)) as (x: string) => unknown', // 7
      'export const plain = (x: string) => eval(x)', // 8
    ])

    const result = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-shapes' })
      .violations()

    expect(result.map((v) => v.message)).toEqual([
      "plain contains call to 'eval' at line 8",
      "Service.m contains call to 'eval' at line 2",
    ])
  })
})
