import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { functionNoEval } from '../../src/rules/security.js'
import { functionNoSilentCatch } from '../../src/rules/errors.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0314 — the function rules read a function's body only, so a parameter's default, and the
 * defaults and computed keys of a destructured parameter, were never read: `function f(g = eval('w'))`
 * passed `functionNoEval` and the `recommended` floor. They run at each call, so they are the
 * function's code. `functionNoSilentCatch`, which walks a function itself, also skipped a concise
 * arrow's body.
 *
 * A finding in the body keeps its identity: the parameters are read after it.
 */
function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/functions.ts', [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0314: the function rules read a function’s parameter defaults', () => {
  it('functionNoEval reports eval in a default, a destructured or rest parameter and a computed key', () => {
    const p = project([
      "export function plain(g = eval('a')) { return g }", // 1
      "export function destructured({ g = eval('b') } = {}) { return g }", // 2
      "export function nested({ o: { g = eval('c') } = {} } = {}) { return g }", // 3
      "export function key({ [eval('d')]: g } = {}) { return g }", // 4
      "export const arrow = (g = eval('e')) => g", // 5
      "export class C { constructor(readonly f = eval('f')) {} }", // 6
      'export function clean(g = 1) { return g }', // 7
      "export function arr([g = eval('g')] = []) { return g }", // 8
      "export function rest(...[g = eval('h')]: unknown[]) { return g }", // 9
    ])

    const result = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0314-eval' })
      .violations()
      .map((v) => v.message)

    expect(result).toEqual([
      "plain contains call to 'eval' at line 1",
      "destructured contains call to 'eval' at line 2",
      "nested contains call to 'eval' at line 3",
      "key contains call to 'eval' at line 4",
      "arr contains call to 'eval' at line 8",
      "rest contains call to 'eval' at line 9",
      "arrow contains call to 'eval' at line 5",
      "C.constructor contains call to 'eval' at line 6",
    ])
  })

  it('a finding in the body keeps its identity, and a default’s is numbered after it', () => {
    const p = project(["export function both(g = eval('a')) {", "  return eval('b')", '}'])

    const result = functions(p)
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0314-order' })
      .violations()
      .map((v) => [Number(/at line (\d+)/.exec(v.message)?.[1]), (v.identity ?? '').slice(-2)])

    // 0.6.0 reported only the body's eval, on line 2, as #1.
    expect(result).toEqual([
      [2, '#1'],
      [1, '#2'],
    ])
  })

  it('functionNoSilentCatch reads a default and a concise arrow’s body', () => {
    const p = project([
      'export function inDefault(g = (() => { try { return 1 } catch { return 2 } })()) { return g }',
      'export const concise = () => [0].map(() => { try { return 1 } catch { return 2 } })',
      'export function inBody() { try { return 1 } catch { return 2 } }',
      'export function handled() { try { return 1 } catch (e) { return String(e) } }',
    ])

    const result = functions(p)
      .should()
      .satisfy(functionNoSilentCatch())
      .rule({ id: 'test/0314-catch' })
      .violations()
      .map((v) => v.element)

    expect(result.sort()).toEqual(['concise', 'inBody', 'inDefault'])
  })

  it('a silent catch in the body keeps its identity, and one in a default is numbered after it', () => {
    const p = project([
      'export function both(g = (() => { try { return 1 } catch { return 2 } })()) {',
      '  try { return g } catch { return 3 }',
      '}',
    ])

    const result = functions(p)
      .should()
      .satisfy(functionNoSilentCatch())
      .rule({ id: 'test/0314-catch-order' })
      .violations()
      .map((v) => [v.line, v.identity === undefined ? 'bare' : (v.identity.split('#').pop() ?? '')])

    // 0.6.0 reported only the body's catch, on line 2, under the bare identity. Two findings with one
    // subject are told apart by order — the first keeps the bare identity, the next gets `#1` — so the
    // body's catch must come first.
    expect(result).toEqual([
      [2, 'bare'],
      [1, '1'],
    ])
  })

  it('a requirement is met by a call in a default', () => {
    const p = project([
      'declare function legacy(): number',
      'export function onlyDefault(g = legacy()) { return g }',
      'export function neither(g = 1) { return g }',
    ])

    const failed = functions(p)
      .that()
      .haveNameMatching(/^(onlyDefault|neither)$/)
      .should()
      .contain(call('legacy'))
      .rule({ id: 'test/0314-requirement' })
      .violations()
      .map((v) => v.element)

    // As a class member's destructured default meets a class requirement (bug 0309).
    expect(failed).toEqual(['neither'])
  })
})
