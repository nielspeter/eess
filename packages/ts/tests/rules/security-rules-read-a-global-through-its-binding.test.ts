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

  it('reports the environment however the process module is imported', () => {
    // The architecture review of this fix measured the hole: only a NAMED import was followed, and
    // every other import shape fell through to "a local, not the global" — so
    // `import process from 'node:process'` reported nothing where 0.6.0 reported it. An import is
    // not a shadow; it is a binding this file does not spell out, and those fall back to the name.
    const readsEnv = (source: string): number =>
      functions(projectOf({ '/src/imports.ts': source }))
        .should()
        .satisfy(functionNoProcessEnv())
        .rule({ id: 'test/0305-imports' })
        .violations()
        .filter((v) => !v.message.includes('examined 0 subjects')).length

    expect(
      readsEnv("import process from 'node:process'\nexport function f() { return process.env.A }"),
    ).toBe(1)
    expect(
      readsEnv(
        "import * as process from 'node:process'\nexport function f() { return process.env.A }",
      ),
    ).toBe(1)
    // RENAMED, which is what makes the import branch load-bearing rather than covered by the
    // fallback: the name at the use site is not `process`, so only resolving the import finds it.
    expect(
      readsEnv("import proc from 'node:process'\nexport function f() { return proc.env.A }"),
    ).toBe(1)
    expect(
      readsEnv("import * as proc from 'node:process'\nexport function f() { return proc.env.A }"),
    ).toBe(1)
    expect(
      readsEnv("import { env } from 'node:process'\nexport function f() { return env.A }"),
    ).toBe(1)
    // A `process` imported from somewhere else is not known to be the global — and is reported
    // anyway, because an unfollowable binding falls back to the name as written (ADR-009). The
    // false red is the direction this project chooses; the named limit is in the record.
    expect(
      readsEnv("import process from './shim'\nexport function f() { return process.env.A }"),
    ).toBe(1)
  })

  it('reads a global through a variable that holds it, and not through an object that wraps it', () => {
    // The limit these matchers have by their own description: they read a member ACCESS. A global
    // bound to a name and then used as one is followed; a global stored as a property of something
    // else and reached through that thing is not, and was not before this fix either.
    const p = projectOf({
      '/src/held.ts': [
        'export function throughAVariable() { const c = console; c.log(1) }',
        'export function throughAnObject() { const o = { console }; o.console.log(1) }',
        '',
      ].join('\n'),
    })
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoConsole())
          .rule({ id: 'test/0305-held' })
          .violations(),
      ),
    ).toEqual(new Set(['throughAVariable']))
  })

  it('reads a global declared inside a declare global block as the global', () => {
    // The `declare` keyword can sit on an ANCESTOR of the declaration: a function declared inside
    // `declare global {}` has none of its own, so asking the declaration alone reads a global as a
    // local shadow and reports nothing. Measured here with `eval` itself, which is the only way the
    // walk is falsifiable — a name the rules do not match would pass either way.
    const p = projectOf({
      '/src/ambient-global.ts': [
        'declare global { function eval(source: string): unknown }',
        "export function usesEval() { return eval('1') }",
        '',
      ].join('\n'),
    })
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoEval())
          .rule({ id: 'test/0305-ambient-ancestor' })
          .violations(),
      ),
    ).toEqual(new Set(['usesEval']))
  })

  it('reports a global reached through a binding it cannot follow', () => {
    // The distinction ADR-009 turns on: "I followed this and it is not a global" is an answer,
    // "I cannot follow this" is not. The enforcement review measured the two conflated —
    // `const process = require('node:process')` reported nothing where 0.6.0 reported it.
    const reported = (source: string, condition: 'env' | 'console'): string[] =>
      functions(projectOf({ '/src/opaque.ts': source }))
        .should()
        .satisfy(condition === 'env' ? functionNoProcessEnv() : functionNoConsole())
        .rule({ id: 'test/0305-opaque' })
        .violations()
        .filter((v) => !v.message.includes('examined 0 subjects'))
        .map((v) => v.element)

    expect(
      reported(
        "declare function require(m: string): any\nconst process = require('node:process')\nexport function f() { return process.env.A }",
        'env',
      ),
    ).toEqual(['f'])
    expect(
      reported(
        "import process = require('node:process')\nexport function f() { return process.env.A }",
        'env',
      ),
    ).toEqual(['f'])
    expect(
      reported(
        "import console from 'node:console'\nexport function f() { console.log(1) }",
        'console',
      ),
    ).toEqual(['f'])

    // A local declared with no initializer is an unknown too: nothing says what is assigned to it
    // later, and for a prohibition the uncertain direction is the one that reports.
    expect(
      reported(
        'let process: { env: Record<string, string> }\nexport function f() { return process.env.A }',
        'env',
      ),
    ).toEqual(['f'])

    // And the other side of the distinction, unchanged: a source that could not BE a global — an
    // object literal, a parameter — still answers "not the global".
    expect(
      reported(
        'export function f() { const console = { log: (n: number) => n }; console.log(1) }',
        'console',
      ),
    ).toEqual([])
  })

  it('reports a global in a project with no lib files at all', () => {
    // The fail-closed branch — no declaration anywhere — was unreachable in every other test,
    // because ts-morph loads its bundled lib files even in memory, so `eval` always resolved to an
    // ambient declaration. Measured by the enforcement review; this is the fixture that reaches it.
    const tsm = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true })
    tsm.createSourceFile('/src/nolib.ts', "export function f() { return eval('1') }\n")
    const p: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    expect(
      elements(
        functions(p)
          .should()
          .satisfy(functionNoEval())
          .rule({ id: 'test/0305-nolib' })
          .violations(),
      ),
    ).toEqual(new Set(['f']))
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
