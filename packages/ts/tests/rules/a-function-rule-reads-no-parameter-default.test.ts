import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { functionNoEval } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0314 — the function rules read a function's body only, so they read no parameter default,
 * plain or destructured: `function f(g = eval('w'))` passes `functionNoEval`.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0314 turns it red. The CONTROL is a read in a
 * function's body, which is reported. An empty list is a real verdict here: a function the rule never
 * examined would come back as a configuration finding, not as nothing.
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

describe('bug 0314: the function rules read no parameter default', () => {
  it('KNOWN GAP — the function rules read no parameter default, plain or destructured', () => {
    const p = project('/src/functions.ts', [
      "export function plain(g = eval('w')) { return g }", // 1
      "export function destructured({ g = eval('w') } = {}) { return g }", // 2
    ])

    const result = functions(p)
      .that()
      .haveNameMatching(/^(plain|destructured)$/)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0314-function-eval' })
      .violations()

    expect(result.map((v) => v.message)).toEqual([])
  })

  it('CONTROL — a read in a function body is reported', () => {
    const p = project('/src/body.ts', [
      "export function body() { return eval('v') }", // 1
    ])

    const result = functions(p)
      .that()
      .haveNameMatching(/^body$/)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0314-function-eval-c' })
      .violations()

    expect(result.map((v) => v.message)).toEqual(["body contains call to 'eval' at line 1"])
  })
})
