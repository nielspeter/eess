import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { functionNoEval, noEval, moduleNoEval } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0321 — the function builder collected a file's top-level functions, variables and classes, so
 * `eval` passed `functionNoEval` and the `recommended` floor in every position below that is not one
 * of those three: a class EXPRESSION's members, anything inside a NAMESPACE, and an object literal's
 * ACCESSORS. It now reads a namespace as it reads a file, a class expression as it reads a class,
 * and an accessor as it reads a method.
 *
 * **What is ruled OUT, and why**, each pinned here so the ruling is falsifiable rather than a
 * sentence in a record: a static block and a class field that holds no function are code a CLASS
 * runs, not functions, and the class rules read both; a function passed to a call, chosen by a
 * conditional, or handed to a call outside any function is an anonymous inline function, which bug
 * 0315 left out on purpose, and module rules read the module-scope ones.
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
  "export class F { x = eval('field') }", // 12
  "export namespace N2 { export function g() { eval('namespace function') } }", // 13
  "export namespace N3 { export const h = () => eval('namespace arrow') }", // 14
]

describe('bug 0321: the positions a function rule reads', () => {
  it('reads a class expression, a namespace, and an object literal accessor', () => {
    const result = functions(project(POSITIONS), { includeObjectLiteralFunctions: true })
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0321-positions' })
      .violations()

    // Each newly read position names the function it was found in, so a fix that collected the
    // right count under the wrong names could not pass.
    expect(result.map((v) => [v.element, v.line])).toEqual([
      ['control', 1],
      ['Expr.m', 2],
      // A namespace's members carry its path, so two namespaces may hold the same class name.
      ['N.Inner.m', 3],
      ['N2.g', 13],
      ['N3.h', 14],
      // An object literal's accessor is named by its key, bracketed as any non-identifier key is.
      ['o["get x"]', 4],
      ['o["set x"]', 4],
    ])
  })

  it('leaves a static block, a class field and an inline callback to the class and module rules', () => {
    // The ruling, measured from both sides: `functions()` does not read them …
    const read = functions(project(POSITIONS), { includeObjectLiteralFunctions: true })
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0321-ruled-out' })
      .violations()
      .map((v) => v.line)
    expect(read).not.toContain(5) // a static block
    expect(read).not.toContain(12) // a class field that holds no function
    expect(read).not.toContain(7) // a function passed to a call
    expect(read).not.toContain(9) // a function a conditional chooses
    expect(read).not.toContain(11) // a callback outside any function

    // … and the rules whose subject they belong to do.
    const byClasses = classes(project(POSITIONS))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0321-classes' })
      .violations()
      .map((v) => v.element)
    expect(byClasses).toContain('S') // the static block
    expect(byClasses).toContain('F') // the field

    const byModules = modules(project(POSITIONS))
      .should()
      .satisfy(moduleNoEval())
      .rule({ id: 'test/0321-modules' })
      .violations()
    expect(byModules.length).toBeGreaterThan(0)
  })

  it('reads a namespace class with the class rules too', () => {
    const result = classes(project(POSITIONS))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0321-namespace-class' })
      .violations()
      .map((v) => v.element)

    // `N.Inner` is an ordinary class declaration that `sourceFile.getClasses()` did not answer for.
    expect(result).toContain('Inner')
    // A class EXPRESSION is still not a subject of `classes()` — bug 0334 — though its members are
    // read by the function rules above.
    expect(result).not.toContain('Expr')
  })

  it('reports one finding for a class or a namespace inside a function, not two', () => {
    // The enclosing function's body already covers them, so collecting the nested declaration
    // again would report the same `eval` twice — which is why a namespace inside a function is not
    // a scope of its own.
    const inAFunction = (source: string): { element: string; line: number }[] =>
      functions(project([source]))
        .should()
        .satisfy(functionNoEval())
        .rule({ id: 'test/0321-nested' })
        .violations()
        .map((v) => ({ element: v.element ?? '', line: v.line ?? 0 }))

    expect(
      inAFunction(
        "export function outer() { class Inner { m() { eval('nested') } } return Inner }",
      ),
    ).toEqual([{ element: 'outer', line: 1 }])
    expect(
      inAFunction("export function outer2() { namespace N { export function g() { eval('x') } } }"),
    ).toEqual([{ element: 'outer2', line: 1 }])
  })
})
