import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functionNoEval, noEval } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0321 — since 0315 the function builder collects a class declaration's function members and a
 * function behind a wrapper. It still does not collect a class expression's members, a namespace
 * class's, an object literal's accessors, a static block, or a function a variable holds through a
 * call or a conditional, even with object-literal functions asked for, or a callback passed to a call
 * outside any function. No function rule reads them, and the class rules miss a class expression and a
 * namespace class as well.
 */
function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/positions.ts', [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const POSITIONS = [
  "export function control() { eval('control') }", // 1
  "export const Expr = class { m() { eval('class expression') } }", // 2
  "export namespace N { export class Inner { m() { eval('namespace class') } } }", // 3
  "export const o = { get x() { return eval('object getter') }, set x(v: string) { eval(v) } }", // 4
  "export class S { static { eval('static block') } }", // 5
  'declare function memo<T>(f: T): T', // 6
  "export const memoised = memo(() => eval('call argument'))", // 7
  'declare const flag: boolean', // 8
  "export const chosen = flag ? () => eval('conditional') : () => 0", // 9
  'declare const app: { get(path: string, handler: () => unknown): void }', // 10
  "app.get('/', () => eval('module-level callback'))", // 11
]

describe('bug 0321: named function positions the builder does not collect', () => {
  it('KNOWN GAP — eval in a class expression, a namespace class, an object accessor, a static block, a call or a conditional is not reported', () => {
    const result = functions(project(POSITIONS), { includeObjectLiteralFunctions: true })
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0321-positions' })
      .violations()

    // Only the control: lines 2 to 11 hold eight more reads of eval, and none is reported.
    expect(result.map((v) => [v.element, v.line])).toEqual([['control', 1]])
  })

  it('KNOWN GAP — the class rules read neither a class expression nor a namespace class', () => {
    const result = classes(project(POSITIONS))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0321-classes' })
      .violations()

    // The control: the class rules read a static block, so S is reported. Expr and N.Inner are not.
    expect(result.map((v) => [v.element, v.line])).toEqual([['S', 5]])
  })
})
