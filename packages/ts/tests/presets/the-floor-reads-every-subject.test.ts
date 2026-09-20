import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { recommended } from '../../src/presets/recommended.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0333 — every rule the `recommended` floor built read a FUNCTION, so the floor said nothing
 * about code outside one. Measured on a file holding eleven positions, only `eval` inside a
 * function was reported: a bare `eval('x')` at top level, one in a class's static block, one in a
 * field initializer and one in a callback all passed a preset whose rule is named `no-eval`.
 *
 * Each rule now reads the broadest subject its condition has a variant for. The subject kinds NEST
 * — a module's search reads the whole file — so a rule reads exactly one of them, and no call is
 * reported twice. `no-empty-bodies` keeps its function subject: an empty body is a fact about a
 * function and has no meaning at module scope.
 */
const PRELUDE = [
  'declare function eval(s: string): unknown',
  'declare const app: { get(p: string, h: () => unknown): void }',
  'declare function memo<T>(f: T): T',
  'declare const flag: boolean',
]

function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/floor.ts', [...PRELUDE, ...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

/** The elements the floor reports `no-eval` on, which names WHERE as well as how many. */
const evalFindings = (lines: readonly string[]): string[] =>
  [...recommended(project(lines), { include: '**/src/**', report: 'return' })]
    .filter((v) => v.ruleId === 'preset/recommended/no-eval')
    .map((v) => v.element ?? '')

describe('bug 0333: the floor reads every subject its rules have a variant for', () => {
  it('reports eval wherever it is written, not only inside a function', () => {
    // Each row names its enclosing declaration, so a fix that reported the right COUNT under the
    // wrong subject could not pass. The last two have no enclosing declaration and name the file.
    expect(evalFindings(["export function c() { eval('x') }"])).toEqual(['c'])
    expect(evalFindings(["export class S { static { eval('x') } }"])).toEqual(['S'])
    // A field initializer names the property it initialises, not just its class.
    expect(evalFindings(["export class F { x = eval('x') }"])).toEqual(['F.x'])
    expect(evalFindings(["export const m = memo(() => eval('x'))"])).toEqual(['floor.ts'])
    expect(evalFindings(["app.get('/', () => eval('x'))"])).toEqual(['floor.ts'])
    expect(evalFindings(["eval('x')"])).toEqual(['floor.ts'])
  })

  it('reports one finding per call, not one per subject kind that could read it', () => {
    // The reason a rule reads exactly one subject: a module search reads the whole file, so a rule
    // built over both functions and modules would report a call in a function twice.
    expect(
      evalFindings([
        "export function c() { eval('one') }",
        "export class S { static { eval('two') } }",
        "eval('three')",
      ]),
    ).toEqual(['c', 'S', 'floor.ts'])
  })

  it('keeps the empty-body rule on its function subject', () => {
    // `no-empty-bodies` is a fact about a function. The floor still reports one, and reports
    // nothing for a file that merely has no functions.
    const empties = (lines: readonly string[]): string[] =>
      [...recommended(project(lines), { include: '**/src/**', report: 'return' })]
        .filter((v) => v.ruleId === 'preset/recommended/no-empty-bodies')
        .map((v) => v.element ?? '')

    expect(empties(['export function hollow() {}'])).toEqual(['hollow'])
    // A file with no function at all: the rule has no subject, which is the empty-selection state
    // ADR-010 reports rather than a finding about the code.
    expect(empties(['export type T = number']).length).toBe(0)
  })
})
