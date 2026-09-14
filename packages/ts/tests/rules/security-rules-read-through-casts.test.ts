import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import {
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoConsole,
  functionNoConsoleLog,
  functionNoProcessEnv,
} from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0308 — the security rules read a global's name through parentheses, a string-keyed bracket
 * and one leading global object (bugs 0301, 0297), but not through a type assertion (`as`, `<T>`),
 * a `satisfies` expression or a non-null assertion (`!`), none of which changes the value at run
 * time; and they dropped only one leading global object, so `window.self.eval` read as
 * `self.eval`. Without Node's types, `(globalThis as any).process.env` is the ordinary TypeScript
 * spelling of the global-object read.
 *
 * One test per rule, each an exact sorted list of the functions reported, over every wrapper and a
 * doubled global object; each fixture's first function is the direct spelling. The CONTROL pins
 * what the rules must still not read as a global: a cast of a local or of `this`, a global
 * object's name after the first segment, and a method of a cast object.
 */
function project(source: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/casts.ts', [...source, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function elements(result: readonly { element: string }[]): string[] {
  return result.map((v) => v.element).sort()
}

describe('bug 0308: the security rules read a global through a cast', () => {
  it('functionNoProcessEnv reads process.env through a type assertion, a non-null assertion and a second global object', () => {
    const p = project([
      'export function envDot() { return process.env.A }',
      'export function envAs() { return (globalThis as any).process.env.B }',
      'export function envAngle() { return (<any>globalThis).process.env.C }',
      'export function envSatisfies() { return (process satisfies object).env }',
      'export function envProcessCast() { return (process as { env: object }).env }',
      'export function envNonNull() { return process!.env.D }',
      'export function envDoubledGlobal() { return window.self.process.env.E }',
    ])
    const result = functions(p)
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0308-env' })
      .violations()

    expect(elements(result)).toEqual([
      'envAngle',
      'envAs',
      'envDot',
      'envDoubledGlobal',
      'envNonNull',
      'envProcessCast',
      'envSatisfies',
    ])
  })

  it('functionNoEval reads eval through a type assertion, a non-null assertion and a second global object', () => {
    const p = project([
      "export function evalDirect() { return eval('1') }",
      "export function evalAsGlobal() { return (globalThis as any).eval('1') }",
      "export function evalAsCallee() { return (eval as any)('1') }",
      "export function evalNonNull() { return eval!('1') }",
      "export function evalDoubledGlobal() { return window.self.eval('1') }",
    ])
    const result = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0308-eval' })
      .violations()

    expect(elements(result)).toEqual([
      'evalAsCallee',
      'evalAsGlobal',
      'evalDirect',
      'evalDoubledGlobal',
      'evalNonNull',
    ])
  })

  it('functionNoFunctionConstructor reads Function through a type assertion, a non-null assertion and a second global object', () => {
    const p = project([
      "export function fnNew() { return new Function('return 1') }",
      "export function fnAsGlobal() { return new (globalThis as any).Function('return 1') }",
      "export function fnNonNullCall() { return Function!('return 1') }",
      "export function fnDoubledGlobal() { return self.window.Function('return 1') }",
    ])
    const result = functions(p)
      .should()
      .satisfy(functionNoFunctionConstructor())
      .rule({ id: 'test/0308-function' })
      .violations()

    expect(elements(result)).toEqual(['fnAsGlobal', 'fnDoubledGlobal', 'fnNew', 'fnNonNullCall'])
  })

  it('functionNoConsole and functionNoConsoleLog read console through a type assertion, a non-null assertion and a second global object', () => {
    const p = project([
      'export function logDirect() { console.log(1) }',
      'export function logAsGlobal() { (globalThis as any).console.log(1) }',
      'export function logNonNull() { console!.log(1) }',
      'export function logDoubledGlobal() { window.self.console.log(1) }',
    ])
    const expected = ['logAsGlobal', 'logDirect', 'logDoubledGlobal', 'logNonNull']
    const consoleResult = functions(p)
      .should()
      .satisfy(functionNoConsole())
      .rule({ id: 'test/0308-console' })
      .violations()
    const logResult = functions(p)
      .should()
      .satisfy(functionNoConsoleLog())
      .rule({ id: 'test/0308-console-log' })
      .violations()

    expect(elements(consoleResult)).toEqual(expected)
    expect(elements(logResult)).toEqual(expected)
  })

  it('CONTROL — a cast of a local or of this, a global name after the first segment, and a method of a cast object are not the global', () => {
    const p = project([
      'export function castOfLocal(settings: { env: object }) { return (settings as any).env }',
      'export function castOfThis() { return (this as any).process.env }',
      'export function globalAfterFirst(settings: { window: { process: { env: object } } }) { return settings.window.process.env }',
      "export function methodOfCast(obj: { eval(s: string): void }) { return (obj as any).eval('1') }",
    ])
    const env = functions(p)
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0308-control-env' })
      .violations()
    const evals = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0308-control-eval' })
      .violations()

    expect(elements(env)).toEqual([])
    expect(elements(evals)).toEqual([])
  })
})
