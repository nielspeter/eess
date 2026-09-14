import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { noEval, functionNoEval } from '../../src/rules/security.js'
import { noSilentCatch } from '../../src/rules/errors.js'
import { noMagicNumbers } from '../../src/rules/code-quality.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0309 — the class body search reads a parameter's default, but not a default inside a
 * destructured parameter: `m({ a = eval('x') } = {})`. The function rules read a function's body
 * only, so they read no parameter default at all.
 *
 * The KNOWN GAP tests assert today's behaviour; fixing 0309 turns them red. The CONTROL is a plain
 * default in a class and a read in a function's body, which are reported. An empty list is a real
 * verdict here: a class or function the rule never examined would come back as a configuration
 * finding, not as nothing.
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

describe('bug 0309: a parameter default is not read', () => {
  it('KNOWN GAP — a default inside a destructured parameter passes the class rules', () => {
    const p = project('/src/destructured.ts', [
      'export class Destructured {', // 1
      "  m({ a = eval('x') } = {}) { return a }", // 2
      "  n([b = eval('y')] = []) { return b }", // 3
      '  q({ e = 4242 } = {}) { return e }', // 4
      '  r({ f = () => { try { work() } catch (err) {} } } = {}) { return f }', // 5
      '}', // 6
    ])

    const evals = classes(p).should().satisfy(noEval()).rule({ id: 'test/0309-eval' }).violations()
    const numbers = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-magic' })
      .violations()
    const catches = classes(p)
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0309-catch' })
      .violations()

    expect(evals.map((v) => v.message)).toEqual([])
    expect(numbers.map((v) => v.message)).toEqual([])
    expect(catches.map((v) => v.message)).toEqual([])
  })

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
      .rule({ id: 'test/0309-function-eval' })
      .violations()

    expect(result.map((v) => v.message)).toEqual([])
  })

  it('CONTROL — a plain default in a class and a read in a function body are reported', () => {
    const p = project('/src/plain.ts', [
      'export class Plain {', // 1
      "  m(a = eval('x')) { return a }", // 2
      '  q(e = 4242 * 2) { return e }', // 3
      '  r(f = () => { try { work() } catch (err) {} }) { return f }', // 4
      '}', // 5
      "export function body() { return eval('v') }", // 6
    ])

    const evals = classes(p)
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0309-eval-c' })
      .violations()
    const numbers = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-magic-c' })
      .violations()
    const catches = classes(p)
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0309-catch-c' })
      .violations()
    const functionEvals = functions(p)
      .that()
      .haveNameMatching(/^body$/)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0309-function-eval-c' })
      .violations()

    expect(evals.map((v) => v.message)).toEqual(["Plain contains call to 'eval' at line 2"])
    expect(numbers.map((v) => v.message)).toEqual([
      'Plain.q contains magic number 4242 — extract to a named constant',
    ])
    expect(catches.map((v) => v.line)).toEqual([4])
    expect(functionEvals.map((v) => v.message)).toEqual(["body contains call to 'eval' at line 6"])
  })
})
