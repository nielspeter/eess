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
 * Bug 0305 — the `eval`, `Function`, `console` and `process.env` rules read the name at the site of
 * use, not what it was bound to, and that failed both ways. A global first bound to a local name —
 * `const ev = eval`, `const { log } = console`, `import { env } from 'node:process'` — was used
 * under a name that is not the global's, and no rule reported it: a false GREEN on an ordinary
 * refactor. A local declaration that keeps a global's name — `function Function() {}`,
 * `const console = {…}`, a parameter called `process` — was reported as the global: a false RED on
 * code that touches no global.
 *
 * Both directions now go through the binding (`helpers/global-binding.ts`). The fallback is
 * fail-closed: a name whose binding cannot be resolved is read as written, so a missing type
 * definition cannot turn a rule off (ADR-009).
 */
function projectOf(files: Readonly<Record<string, string>>): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [path, text] of Object.entries(files)) tsm.createSourceFile(path, text)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

const ALIASES = [
  "export function evalCall() { return eval('1') }",
  "export function evalAliased() { const ev = eval; return ev('1') }",
  "export function evalTwoHops() { const ev = eval; const ev2 = ev; return ev2('1') }",
  "export function evalLet() { let ev = eval; return ev('1') }",
  "export function functionNew() { return new Function('return 1')() }",
  "export function functionAliased() { const F = Function; return F('return 1')() }",
  'export function consoleLog() { console.log(1) }',
  'export function consoleDestructured() { const { log } = console; log(1) }',
  'export function consoleRenamed() { const { log: write } = console; write(1) }',
  '',
].join('\n')

describe('bug 0305: a global is read through its binding', () => {
  it('reports a global reached through a local alias or a destructuring', () => {
    const p = projectOf({ '/src/aliases.ts': ALIASES })
    expect(
      elements(
        functions(p).should().satisfy(functionNoEval()).rule({ id: 'test/0305-eval' }).violations(),
      ),
    ).toEqual(new Set(['evalCall', 'evalAliased', 'evalTwoHops', 'evalLet']))

    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoFunctionConstructor())
          .rule({ id: 'test/0305-function' })
          .violations(),
      ),
    ).toEqual(new Set(['functionNew', 'functionAliased']))

    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoConsole())
          .rule({ id: 'test/0305-console' })
          .violations(),
      ),
    ).toEqual(new Set(['consoleLog', 'consoleDestructured', 'consoleRenamed']))
  })

  it('reports an environment read through destructuring or the node:process import', () => {
    // Split from bug 0297, which fixed the bracketed and global-object spellings.
    const p = projectOf({
      '/src/globals.d.ts': [
        'declare var process: { env: Record<string, string | undefined> }',
        "declare module 'node:process' {",
        '  export const env: Record<string, string | undefined>',
        '}',
        '',
      ].join('\n'),
      '/src/env.ts': [
        'export function viaDot() { return process.env.A }',
        'export function viaDestructure() { const { env } = process; return env.B }',
        "import { env as nodeEnv } from 'node:process'",
        'export function viaNodeProcess() { return nodeEnv.C }',
        '',
      ].join('\n'),
    })

    expect(
      elements(
        functions(p)
          .that()
          .resideInFile('**/env.ts')
          .should()
          .satisfy(functionNoProcessEnv())
          .rule({ id: 'test/0305-process-env' })
          .violations(),
      ),
    ).toEqual(new Set(['viaDot', 'viaDestructure', 'viaNodeProcess']))
  })

  it('reports nothing for a local named process, global, window or self', () => {
    // None of these reads the environment. `global`, `window` and `self` became reportable when
    // 0297 read `process.env` through a global object; a `process` parameter was reported before.
    const p = projectOf({
      '/src/env-shadows.ts': [
        'export function shadowProcess(process: { env: object }) { return process.env }',
        'export function shadowGlobal(global: { process: { env: object } }) { return global.process.env }',
        'export function shadowWindow(window: { process: { env: object } }) { return window.process.env }',
        'export function shadowSelf(host: { process: { env: object } }) { const self = host; return self.process.env }',
        'declare const process: { env: Record<string, string> }',
        'export function readsTheRealOne() { return process.env.A }',
        '',
      ].join('\n'),
    })

    // Named, not counted: the file also holds a function that DOES read the environment, so a
    // rule gone dead — which reports nothing too — cannot pass this.
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoProcessEnv())
          .rule({ id: 'test/0305-env-shadow' })
          .violations(),
      ),
    ).toEqual(new Set(['readsTheRealOne']))
  })

  it('reports nothing for a local declaration that shadows Function or console', () => {
    const p = projectOf({
      '/src/shadows.ts': [
        'export function shadowedFunctionCall() { function Function(a: number) { return a } return Function(1) }',
        'export function shadowedFunctionNew() { class Function { constructor(public a: number) {} } return new Function(1) }',
        'export function shadowedConsole() { const console = { log: (n: number) => n }; console.log(1) }',
        'export function unrelated() { return 1 }',
        '',
      ].join('\n'),
    })

    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoFunctionConstructor())
          .rule({ id: 'test/0305-shadow-function' })
          .violations(),
      ),
    ).toEqual(new Set())
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoConsole())
          .rule({ id: 'test/0305-shadow-console' })
          .violations(),
      ),
    ).toEqual(new Set())
  })

  it('reads an ambient declaration as the global, however it is declared', () => {
    // The common case, and the one that must not change: a global declared by the lib, by a `.d.ts`
    // or by a `declare` in a source file is the global. The `declare const` shape is the one that
    // regressed while this fix was being built — the keyword sits on the statement, not on the
    // declaration — and it took the `process.env` control to zero.
    const p = projectOf({
      '/src/ambient.ts': [
        'declare const process: { env: Record<string, string> }',
        'declare function eval(source: string): unknown',
        'export function reads() { return process.env.A }',
        "export function calls() { return eval('1') }",
        '',
      ].join('\n'),
    })

    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoProcessEnv())
          .rule({ id: 'test/0305-ambient-env' })
          .violations(),
      ),
    ).toEqual(new Set(['reads']))
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoEval())
          .rule({ id: 'test/0305-ambient-eval' })
          .violations(),
      ),
    ).toEqual(new Set(['calls']))
  })

  it('reports a global once, not once per name it is read under', () => {
    // `console.log(1)` is a property access AND two identifiers; only the access reads the chain,
    // so widening the matcher to identifiers must not double-report. Asserted by line and element
    // rather than by count: one finding is also what a rule that never ran produces.
    const p = projectOf({
      '/src/once.ts': [
        'export function f() { console.log(1) }',
        'export function g() { const { log } = console; log(2) }',
        '',
      ].join('\n'),
    })
    expect(
      functions(p)
        .should()
        .satisfy(functionNoConsole())
        .rule({ id: 'test/0305-once' })
        .violations()
        .map((v) => [v.element, v.line]),
    ).toEqual([
      ['f', 1],
      ['g', 2],
    ])
  })
})
