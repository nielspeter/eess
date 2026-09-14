import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import {
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoConsole,
  functionNoProcessEnv,
} from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0305 — the `eval`, `Function` and `console` rules read the name at the site of
 * use, not what it is bound to, and that fails both ways. A global first bound to a local
 * name — `const ev = eval`, `const F = Function`, `const { log } = console` — is used under
 * a name that is not the global's, and none of the rules report it. A local declaration
 * that shadows a global — `function Function() {}`, `const console = {…}` — keeps the
 * global's name, and the rules report it. Closing either needs the binding followed, which
 * is the design question bug 0297 raises for `const { env } = process`.
 *
 * The KNOWN GAP tests assert today's behaviour; fixing 0305 turns them red. The alias test
 * asserts each rule's direct spelling IS reported, so it cannot pass over a rule that
 * reports nothing.
 */
const ALIASES = [
  "export function evalCall() { return eval('1') }",
  "export function evalAliased() { const ev = eval; return ev('1') }",
  "export function functionNew() { return new Function('return 1')() }",
  "export function functionAliased() { const F = Function; return F('return 1')() }",
  'export function consoleLog() { console.log(1) }',
  'export function consoleDestructured() { const { log } = console; log(1) }',
  '',
].join('\n')

function aliasProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/aliases.ts', ALIASES)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

describe('bug 0305: a global reached through a local alias', () => {
  it('KNOWN GAP — an eval, Function or console reached through a local alias or destructuring is not reported', () => {
    const p = aliasProject()
    const evalReported = elements(
      functions(p).should().satisfy(functionNoEval()).rule({ id: 'test/0305-eval' }).violations(),
    )
    const functionReported = elements(
      functions(p)
        .should()
        .satisfy(functionNoFunctionConstructor())
        .rule({ id: 'test/0305-function' })
        .violations(),
    )
    const consoleReported = elements(
      functions(p)
        .should()
        .satisfy(functionNoConsole())
        .rule({ id: 'test/0305-console' })
        .violations(),
    )

    expect(evalReported).toEqual(new Set(['evalCall']))
    expect(functionReported).toEqual(new Set(['functionNew']))
    expect(consoleReported).toEqual(new Set(['consoleLog']))
  })

  it('KNOWN GAP — an environment read through destructuring or the node:process import is not reported', () => {
    // Split from bug 0297, which fixed the bracketed and global-object spellings.
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile(
      '/src/globals.d.ts',
      [
        'declare var process: { env: Record<string, string | undefined> }',
        "declare module 'node:process' {",
        '  export const env: Record<string, string | undefined>',
        '}',
        '',
      ].join('\n'),
    )
    tsm.createSourceFile(
      '/src/env.ts',
      [
        'export function viaDot() { return process.env.A }',
        'export function viaDestructure() { const { env } = process; return env.B }',
        "import { env as nodeEnv } from 'node:process'",
        'export function viaNodeProcess() { return nodeEnv.C }',
        '',
      ].join('\n'),
    )
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    const reported = elements(
      functions(p)
        .that()
        .resideInFile('**/env.ts')
        .should()
        .satisfy(functionNoProcessEnv())
        .rule({ id: 'test/0305-process-env' })
        .violations(),
    )

    expect(reported).toEqual(new Set(['viaDot']))
  })

  it('KNOWN GAP — a local named process, global, window or self is read as the global by noProcessEnv', () => {
    // None of these reads the environment. `global`, `window` and `self` became reportable when
    // 0297 read `process.env` through a global object; a `process` parameter was reported before.
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile(
      '/src/env-shadows.ts',
      [
        'export function shadowProcess(process: { env: object }) { return process.env }',
        'export function shadowGlobal(global: { process: { env: object } }) { return global.process.env }',
        'export function shadowWindow(window: { process: { env: object } }) { return window.process.env }',
        'export function shadowSelf(host: { process: { env: object } }) { const self = host; return self.process.env }',
        'export function unrelated() { return 1 }',
        '',
      ].join('\n'),
    )
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    const reported = functions(p)
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0305-env-shadow' })
      .violations()

    expect(reported.map((v) => v.element).sort()).toEqual([
      'shadowGlobal',
      'shadowProcess',
      'shadowSelf',
      'shadowWindow',
    ])
  })

  it('KNOWN GAP — a local declaration that shadows Function or console is reported as the global', () => {
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile(
      '/src/shadows.ts',
      [
        'export function shadowedFunctionCall() { function Function(a: number) { return a } return Function(1) }',
        'export function shadowedFunctionNew() { class Function { constructor(public a: number) {} } return new Function(1) }',
        'export function shadowedConsole() { const console = { log: (n: number) => n }; console.log(1) }',
        'export function unrelated() { return 1 }',
        '',
      ].join('\n'),
    )
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    const functionReported = elements(
      functions(p)
        .should()
        .satisfy(functionNoFunctionConstructor())
        .rule({ id: 'test/0305-shadow-function' })
        .violations(),
    )
    const consoleReported = elements(
      functions(p)
        .should()
        .satisfy(functionNoConsole())
        .rule({ id: 'test/0305-shadow-console' })
        .violations(),
    )

    // None of these touches a global. Reporting them is the false positive this pins. The
    // bare call became reportable when 0301 matched `Function` without `new`; the other two
    // were reported before it.
    expect(functionReported).toEqual(new Set(['shadowedFunctionCall', 'shadowedFunctionNew']))
    expect(consoleReported).toEqual(new Set(['shadowedConsole']))
  })
})
