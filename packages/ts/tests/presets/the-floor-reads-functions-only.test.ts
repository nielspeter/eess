import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { recommended } from '../../src/presets/recommended.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0333 — every rule the `recommended` floor builds is built with `functions(p, …)`. Code a
 * CLASS runs outside a function member (a static block, a field initializer) and code a MODULE runs
 * outside any function (a callback handed to a call at top level) is therefore checked by no rule in
 * the preset, though `classes()` and `modules()` rules for the same conditions exist and read both.
 *
 * Bug 0321 ruled that those positions belong to the class and module rules rather than to the
 * function collection; this test pins what that ruling leaves: the floor an adopter installs does
 * not run those rules, so `eval` in either position passes it.
 *
 * The test asserts today's behaviour, so closing 0333 turns it red.
 */
function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/floor.ts', [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0333: the recommended floor reads functions only', () => {
  it('KNOWN GAP — eval in a static block or a module-level callback passes the floor', () => {
    const findings = (source: readonly string[]): string[] =>
      [...recommended(project(source), { include: '**/src/**', report: 'return' })]
        .filter((v) => v.ruleId === 'preset/recommended/no-eval')
        .map((v) => v.element ?? '')

    // The control: the floor does read a function, so a floor gone dead could not pass this.
    expect(
      findings([
        'declare function eval(s: string): unknown',
        "export function reads() { eval('1') }",
      ]),
    ).toEqual(['reads'])

    // Code a class runs outside a member, and code a module runs outside any function.
    expect(
      findings([
        'declare function eval(s: string): unknown',
        "export class S { static { eval('static block') } }",
      ]),
    ).toEqual([])
    expect(
      findings([
        'declare function eval(s: string): unknown',
        'declare const app: { get(p: string, h: () => unknown): void }',
        "app.get('/', () => eval('module-level callback'))",
      ]),
    ).toEqual([])
  })
})
