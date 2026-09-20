import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import {
  noEval,
  noFunctionConstructor,
  noConsole,
  noConsoleLog,
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoConsole,
  functionNoConsoleLog,
  moduleNoEval,
  moduleNoConsoleLog,
} from '../../src/rules/security.js'
import { recommended } from '../../src/presets/recommended.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0301 — the `eval`, `Function` and `console` rules read the global however its
 * name is spelled without a local alias: through a global object (`globalThis`,
 * `window`, `self`, `global`), a string-keyed bracket, an indirect `(0, eval)` call,
 * and — for `Function` — with or without `new`.
 *
 * A global reached through a local alias (`const ev = eval`) was bug 0305, fixed: the names below
 * are now read through their bindings, and `security-rules-read-a-global-through-its-binding.test.ts`
 * holds that half.
 *
 * Every expectation is a set of names, not a count (ADR-009 rule 5). The lookalike
 * CONTROL is the half an over-broad fix breaks: a member NAMED `eval`, `Function` or
 * `console` on an ordinary object is not the global.
 */
const SPELLINGS = [
  "export function evalCall() { return eval('1') }",
  "export function evalOptionalCall() { return eval?.('1') }",
  "export function evalViaGlobalThis() { return globalThis.eval('1') }",
  "export function evalViaWindowBracket() { return window['eval']('1') }",
  "export function evalIndirect() { return (0, eval)('1') }",
  "export function functionNew() { return new Function('return 1')() }",
  "export function functionCall() { return Function('return 1')() }",
  "export function functionNewViaGlobalThis() { return new globalThis.Function('return 1')() }",
  "export function functionCallViaSelf() { return self.Function('return 1')() }",
  'export function consoleLog() { console.log(1) }',
  "export function consoleBracket() { console['log'](1) }",
  'export function consoleViaGlobalThis() { globalThis.console.log(1) }',
  "export function consoleViaGlobalBracket() { global['console'].log(1) }",
  '',
].join('\n')

const LOOKALIKES = [
  'const obj = {',
  '  eval: (s: string) => s,',
  '  Function: class {},',
  '  console: { log: (n: number) => n },',
  '}',
  "export function methodNamedEval() { return obj.eval('1') }",
  'export function newMemberNamedFunction() { return new obj.Function() }',
  'export function memberNamedConsole() { obj.console.log(1) }',
  "export function otherGlobal() { return globalThis.structuredClone('1') }",
  '',
].join('\n')

const EVAL_SPELLINGS = [
  'evalCall',
  'evalOptionalCall',
  'evalViaGlobalThis',
  'evalViaWindowBracket',
  'evalIndirect',
]
const FUNCTION_SPELLINGS = [
  'functionNew',
  'functionCall',
  'functionNewViaGlobalThis',
  'functionCallViaSelf',
]
const CONSOLE_SPELLINGS = [
  'consoleLog',
  'consoleBracket',
  'consoleViaGlobalThis',
  'consoleViaGlobalBracket',
]

function project(files: Readonly<Record<string, string>>): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [path, text] of Object.entries(files)) tsm.createSourceFile(path, text)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const spellings = () =>
  project({ '/src/spellings.ts': SPELLINGS, '/src/lookalikes.ts': LOOKALIKES })

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

function linesNamedIn(result: readonly { message: string }[]): Set<string> {
  return new Set(result.map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?'))
}

describe('bug 0301: the security rules read a global however it is spelled', () => {
  it('functionNoEval reports eval through a global object, a bracket, an optional call and an indirect call', () => {
    const result = functions(spellings())
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0301-eval' })
      .violations()
    expect(elements(result)).toEqual(new Set(EVAL_SPELLINGS))
  })

  it('functionNoFunctionConstructor reports Function with or without new, and through a global object', () => {
    const result = functions(spellings())
      .should()
      .satisfy(functionNoFunctionConstructor())
      .rule({ id: 'test/0301-function' })
      .violations()
    expect(elements(result)).toEqual(new Set(FUNCTION_SPELLINGS))
  })

  it('functionNoConsole and functionNoConsoleLog report console through a bracket and a global object', () => {
    const console = functions(spellings())
      .should()
      .satisfy(functionNoConsole())
      .rule({ id: 'test/0301-console' })
      .violations()
    const consoleLog = functions(spellings())
      .should()
      .satisfy(functionNoConsoleLog())
      .rule({ id: 'test/0301-console-log' })
      .violations()
    expect(elements(console)).toEqual(new Set(CONSOLE_SPELLINGS))
    expect(elements(consoleLog)).toEqual(new Set(CONSOLE_SPELLINGS))
  })

  it('the recommended floor reports every eval and Function spelling', () => {
    const result = recommended(spellings(), { report: 'return' })
    expect(elements(result)).toEqual(new Set([...EVAL_SPELLINGS, ...FUNCTION_SPELLINGS]))
  })

  it('CONTROL — a member named eval, Function or console on an ordinary object is not the global', () => {
    const p = spellings()
    const reported = new Set([
      ...elements(
        functions(p).should().satisfy(functionNoEval()).rule({ id: 'test/0301-c1' }).violations(),
      ),
      ...elements(
        functions(p)
          .should()
          .satisfy(functionNoFunctionConstructor())
          .rule({ id: 'test/0301-c2' })
          .violations(),
      ),
      ...elements(
        functions(p)
          .should()
          .satisfy(functionNoConsole())
          .rule({ id: 'test/0301-c3' })
          .violations(),
      ),
    ])
    // Positive anchor: the rules do report the real globals in the same project.
    expect(reported).toContain('evalCall')
    for (const lookalike of [
      'methodNamedEval',
      'newMemberNamedFunction',
      'memberNamedConsole',
      'otherGlobal',
    ]) {
      expect(reported).not.toContain(lookalike)
    }
  })

  it('the class and module variants read the same spellings', () => {
    const cls = project({
      '/src/uses.ts': [
        'export class Uses {', // 1
        "  a() { return globalThis.eval('1') }", // 2
        "  b() { return Function('return 1')() }", // 3
        "  c() { console['log'](1) }", // 4
        '}', // 5
        '',
      ].join('\n'),
    })
    const lines = (condition: Parameters<ReturnType<typeof classes>['satisfy']>[0], id: string) =>
      linesNamedIn(classes(cls).should().satisfy(condition).rule({ id }).violations())
    expect(lines(noEval(), 'test/0301-class-eval')).toEqual(new Set(['2']))
    expect(lines(noFunctionConstructor(), 'test/0301-class-function')).toEqual(new Set(['3']))
    expect(lines(noConsole(), 'test/0301-class-console')).toEqual(new Set(['4']))
    expect(lines(noConsoleLog(), 'test/0301-class-console-log')).toEqual(new Set(['4']))

    const mod = project({
      '/src/top.ts': ["globalThis.eval('1')", "console['log'](1)", ''].join('\n'),
    })
    expect(
      linesNamedIn(
        modules(mod)
          .should()
          .satisfy(moduleNoEval())
          .rule({ id: 'test/0301-module-eval' })
          .violations(),
      ),
    ).toEqual(new Set(['1']))
    expect(
      linesNamedIn(
        modules(mod)
          .should()
          .satisfy(moduleNoConsoleLog())
          .rule({ id: 'test/0301-module-console-log' })
          .violations(),
      ),
    ).toEqual(new Set(['2']))
  })
})
