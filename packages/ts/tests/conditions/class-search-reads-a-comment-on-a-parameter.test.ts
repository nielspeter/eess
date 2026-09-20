import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { comment } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0325 — the class search read a member's parameters as CODE: each default, and a destructured
 * parameter's defaults and computed keys. A comment matcher searching those expressions missed a
 * comment attached to the parameter itself, and one written inline between `=` and the default,
 * which TypeScript counts as leading trivia of neither. Measured on 0.6.1: `m(g = /* TODO *\/ 1)`
 * was 0 for a class comment rule and 1 for a function one, on the same member.
 *
 * The class search now reads the comments in a member's parameter list as a final pass. Three
 * things the fix must keep, each with its own test below: a member's own DOCSTRING is still not
 * read (bug 0307), a comment inside a parameter's DECORATOR does not satisfy a must-contain rule
 * (bug 0307's reach), and a comment the default's search already found is reported ONCE, with the
 * ordinal a baseline accepted.
 */
function project(member: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/c.ts',
    [
      'declare function Inject(t: unknown): ParameterDecorator',
      'declare const T: unknown',
      'export class C {',
      member,
      '}',
      '',
    ].join('\n'),
  )
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const classFindings = (member: string): number =>
  classes(project(member))
    .should()
    .notContain(comment(/TODO/))
    .rule({ id: 'test/0325-class' })
    .violations().length

const functionFindings = (member: string): number =>
  functions(project(member))
    .should()
    .notContain(comment(/TODO/))
    .rule({ id: 'test/0325-function' })
    .violations().length

/** Whether a must-contain rule — which reads member code only — is satisfied by the member. */
const memberCodeSees = (member: string): boolean =>
  classes(project(member))
    .should()
    .contain(comment(/TODO/))
    .rule({ id: 'test/0325-must-contain' })
    .violations().length === 0

/** The shapes bug 0325 measured at 0 for the class rules, one per row of its table. */
const PARAMETER_SHAPES = [
  // inline between `=` and the default — leading trivia of neither
  '  m(g = /* TODO */ 1) { return g }',
  // on its own line before the parameter
  '  m(\n    // TODO\n    g = 1,\n  ) { return g }',
  // inside a destructured parameter's default
  '  m({ a = /* TODO */ 1 }: { a?: number }) { return a }',
  // in a parameter's type annotation
  '  m(g: /* TODO */ number) { return g }',
] as const

/** The shapes the class search already read, which must keep reading as one finding each. */
const ALREADY_READ = [
  '  m() { const x = /* TODO */ 1; return x }',
  '  m(\n    g =\n      // TODO\n      1,\n  ) { return g }',
  '  m(g = 1 /* TODO */) { return g }',
  '  m(g = {\n    // TODO\n    a: 1,\n  }) { return g }',
] as const

describe('bug 0325: the class search reads a comment on a parameter', () => {
  it('reports every comment in a parameter list, as the function rules do', () => {
    expect(PARAMETER_SHAPES.map(classFindings)).toEqual([1, 1, 1, 1])
    // The two searches now agree on the same member, which is what the bug was about.
    expect(PARAMETER_SHAPES.map(functionFindings)).toEqual([1, 1, 1, 1])
  })

  it('reports a comment the class search already read exactly once', () => {
    // Each is found by the body or the default search; the parameter pass must not report it again.
    expect(ALREADY_READ.map(classFindings)).toEqual([1, 1, 1, 1])
    // Two parameters, two comments — one finding each, not one per pass.
    expect(classFindings('  m(a = /* TODO one */ 1, b = /* TODO two */ 2) { return a + b }')).toBe(
      2,
    )
  })

  it('still reads no docstring on the member itself (bug 0307)', () => {
    expect(classFindings('  /** TODO */\n  m() { return 1 }')).toBe(0)
    expect(classFindings('  // TODO\n  m() { return 1 }')).toBe(0)
    // The function rules read both, and the disagreement above the member is bug 0307's ruling,
    // not this fix's: a docstring is not code.
    expect(functionFindings('  /** TODO */\n  m() { return 1 }')).toBe(1)
  })

  it('does not let a comment in a parameter decorator satisfy a must-contain rule', () => {
    const inDecorator = '  m(@Inject(/* TODO */ T) g: number) { return g }'
    const aboveDecorator = '  m(\n    // TODO\n    @Inject(T) g: number,\n  ) { return g }'
    // A rule for what a class must NOT contain reads all of it, decorators included.
    expect(classFindings(inDecorator)).toBe(1)
    expect(classFindings(aboveDecorator)).toBe(1)
    // A must-contain rule reads member code only (bug 0307), so wiring cannot satisfy it — a
    // comment above the decorator is the decorator's, as a docstring is the member's.
    expect(memberCodeSees(inDecorator)).toBe(false)
    expect(memberCodeSees(aboveDecorator)).toBe(false)
    // Between the decorator and the parameter is the parameter's, and member code sees it.
    expect(memberCodeSees('  m(@Inject(T) /* TODO */ g: number) { return g }')).toBe(true)
    expect(memberCodeSees('  m(g = /* TODO */ 1) { return g }')).toBe(true)
  })

  it('numbers a comment in the parameter list after the ones read before it', () => {
    // The body comment was reported at 0.6.1 as #1; the parameter one is new and takes #2, so a
    // baseline that accepted the body finding still names it.
    const ordinals = classes(
      project('  m(g = /* TODO param */ 1) {\n    // TODO body\n    return g\n  }'),
    )
      .should()
      .notContain(comment(/TODO/))
      .rule({ id: 'test/0325-order' })
      .violations()
      .map((v) => [Number(/at line (\d+)/.exec(v.message)?.[1]), (v.identity ?? '').slice(-2)])

    // Line 4 carries the parameter comment, line 5 the body one.
    expect(ordinals).toEqual([
      [5, '#1'],
      [4, '#2'],
    ])
  })
})
