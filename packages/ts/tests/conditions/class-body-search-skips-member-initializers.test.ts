import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noProcessEnv, noEval } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0300 — `searchClassBody` walks method bodies, the last constructor's body and
 * accessors, and nothing else. Every class-level body rule misses a field
 * initializer, a static field, a parameter default, a static block and an arrow
 * property.
 *
 * Every read is spelled `process.env.X`, so this is not bug 0297. The KNOWN GAP
 * tests assert today's behaviour; fixing 0300 turns them red. Each asserts the
 * method-body read IS caught, so neither can pass over a rule that catches nothing.
 */
const SERVICE = [
  'export class Service {', // 1
  '  field = process.env.FIELD', // 2
  '  static stat = process.env.STATIC', // 3
  '  constructor(private host = process.env.PARAM) {}', // 4
  '  static {', // 5
  '    void process.env.BLOCK', // 6
  '  }', // 7
  '  arrow = () => process.env.ARROW', // 8
  '  get getter() { return process.env.GETTER }', // 9
  '  method() { return process.env.METHOD }', // 10
  '}', // 11
  '',
].join('\n')

const EVALUATOR = [
  'export class Evaluator {', // 1
  "  field = eval('1')", // 2
  "  method() { return eval('2') }", // 3
  '}', // 4
  '',
].join('\n')

function project(path: string, text: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(path, text)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function linesNamedIn(result: readonly { message: string }[]): Set<string> {
  return new Set(result.map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?'))
}

describe('bug 0300: class-body search reads methods, constructors and accessors only', () => {
  it('KNOWN GAP — noProcessEnv on a class misses every position that is not a method, constructor body or accessor', () => {
    const result = classes(project('/src/service.ts', SERVICE))
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0300-positions' })
      .violations()

    // Reported: the getter (9) and the method (10). Missed: lines 2, 3, 4, 6 and 8.
    expect(linesNamedIn(result)).toEqual(new Set(['9', '10']))
  })

  it('KNOWN GAP — noEval on a class misses eval in a field initializer', () => {
    const result = classes(project('/src/evaluator.ts', EVALUATOR))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0300-eval-field' })
      .violations()

    expect(linesNamedIn(result)).toEqual(new Set(['3']))
  })
})
