import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import {
  functionNoEval,
  functionNoFunctionConstructor,
  functionNoConsole,
  functionNoConsoleLog,
} from '../../src/rules/security.js'
import { recommended } from '../../src/presets/recommended.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0301 — the `eval`, `Function` and `console` rules are lexical matchers, and the
 * `recommended` floor uses two of them. One function per spelling; the first of each
 * group is the spelling the rule catches.
 *
 * The KNOWN GAP tests assert today's behaviour. Fixing 0301 turns them red: invert
 * them in the same change, and say so in the record. Each asserts the canonical
 * spelling IS reported, so none can pass over a rule that reports nothing.
 */
const SPELLINGS = [
  "export function evalCall() { return eval('1') }",
  "export function evalViaGlobalThis() { return globalThis.eval('1') }",
  "export function evalIndirect() { return (0, eval)('1') }",
  "export function evalAliased() { const ev = eval; return ev('1') }",
  "export function functionNew() { return new Function('return 1')() }",
  "export function functionCall() { return Function('return 1')() }",
  "export function functionNewViaGlobalThis() { return new globalThis.Function('return 1')() }",
  'export function consoleLog() { console.log(1) }',
  'export function consoleDestructured() { const { log } = console; log(1) }',
  "export function consoleBracket() { console['log'](1) }",
  'export function consoleViaGlobalThis() { globalThis.console.log(1) }',
  '',
].join('\n')

function spellingProject(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/spellings.ts', SPELLINGS)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

describe('bug 0301: the security rules match one spelling', () => {
  it('KNOWN GAP — functionNoEval reports eval() and none of globalThis.eval, an indirect call or an alias', () => {
    const result = functions(spellingProject())
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0301-eval' })
      .violations()
    expect(elements(result)).toEqual(new Set(['evalCall']))
  })

  it('KNOWN GAP — functionNoFunctionConstructor reports new Function() and neither Function() nor new globalThis.Function()', () => {
    const result = functions(spellingProject())
      .should()
      .satisfy(functionNoFunctionConstructor())
      .rule({ id: 'test/0301-function' })
      .violations()
    expect(elements(result)).toEqual(new Set(['functionNew']))
  })

  it('KNOWN GAP — functionNoConsole and functionNoConsoleLog report console.log and no other spelling', () => {
    const console = functions(spellingProject())
      .should()
      .satisfy(functionNoConsole())
      .rule({ id: 'test/0301-console' })
      .violations()
    const consoleLog = functions(spellingProject())
      .should()
      .satisfy(functionNoConsoleLog())
      .rule({ id: 'test/0301-console-log' })
      .violations()
    expect(elements(console)).toEqual(new Set(['consoleLog']))
    expect(elements(consoleLog)).toEqual(new Set(['consoleLog']))
  })

  it('KNOWN GAP — the recommended floor lets Function() and globalThis.eval through', () => {
    const result = recommended(spellingProject(), { report: 'return' })
    expect(elements(result)).toEqual(new Set(['evalCall', 'functionNew']))
  })
})
