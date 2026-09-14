import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { functionNoEval, functionNoProcessEnv } from '../../src/rules/security.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0308 — the security rules read a global's name through parentheses, a string-keyed bracket
 * and one leading global object (bugs 0301, 0297). They do not read through a type assertion, a
 * non-null assertion or a second global object, all of which leave the value unchanged at run
 * time. Without Node's types, `(globalThis as any).process.env` is the ordinary TypeScript
 * spelling of the global-object read.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0308 turns it red. It asserts each rule's
 * direct spelling IS reported, so it cannot pass over a rule that reports nothing.
 */
const SOURCE = [
  'export function envDot() { return process.env.A }',
  'export function envAsCast() { return (globalThis as any).process.env.B }',
  'export function envProcessCast() { return (process as { env: object }).env }',
  'export function envNonNull() { return process!.env.C }',
  'export function envDoubledGlobal() { return window.self.process.env.D }',
  "export function evalDirect() { return eval('1') }",
  "export function evalAsCast() { return (globalThis as any).eval('1') }",
  '',
].join('\n')

function project(): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/casts.ts', SOURCE)
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0308: a global read through a cast', () => {
  it('KNOWN GAP — a global read through a type assertion, a non-null assertion or a second global object is not reported', () => {
    const p = project()
    const env = functions(p)
      .should()
      .satisfy(functionNoProcessEnv())
      .rule({ id: 'test/0308-env' })
      .violations()
    const evals = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0308-eval' })
      .violations()

    expect(env.map((v) => v.element)).toEqual(['envDot'])
    expect(evals.map((v) => v.element)).toEqual(['evalDirect'])
  })
})
