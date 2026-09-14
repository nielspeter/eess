import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import {
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoConsole,
} from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0305 — the `eval`, `Function` and `console` rules read the name at the site of
 * use. A global first bound to a local name — `const ev = eval`, `const F = Function`,
 * `const { log } = console` — is used under a name that is not the global's, and none
 * of the rules report it. Closing this needs the binding followed, which is the design
 * question bug 0297 raises for `const { env } = process`.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0305 turns it red. Each rule's
 * direct spelling is in the same file and asserted reported, so the test cannot pass
 * over a rule that reports nothing.
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
})
