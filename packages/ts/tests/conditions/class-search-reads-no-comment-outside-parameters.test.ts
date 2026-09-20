import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { comment } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0329 — bug 0325's fix reads the comments written inside a member's parameter LIST, the span
 * between `(` and `)`. A comment outside that span but still in the member's signature is unread: in
 * the return type, and between `)` and the body. An overload signature's parameter list is unread
 * too, for a different reason — ts-morph's `getClasses().getMethods()` yields only the
 * implementation — and there the function rules agree, so it is the one row that is not a
 * disagreement.
 *
 * The class search may not simply start at the declaration: that walk reaches the member's
 * docstring, which bug 0307 ruled is not code.
 *
 * This test asserts today's behaviour, so the fix turns it red.
 */
function project(member: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/c.ts', ['export class C {', member, '}', ''].join('\n'))
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
    .rule({ id: 'test/0329-class' })
    .violations().length

const functionFindings = (member: string): number =>
  functions(project(member))
    .should()
    .notContain(comment(/TODO/))
    .rule({ id: 'test/0329-function' })
    .violations().length

/** Outside the parens, and reported by the function rules on the same member. */
const OUTSIDE_THE_PARENS = [
  '  m(): /* TODO */ number { return 1 }',
  '  m() /* TODO */ { return 1 }',
] as const

describe('bug 0329: the class search reads no comment outside a member parameter list', () => {
  it('KNOWN GAP — a comment in a return type or before the body passes a class comment rule', () => {
    expect(OUTSIDE_THE_PARENS.map(classFindings)).toEqual([0, 0])
    // The function rules read both, so the gap is a disagreement on one member, not a matcher that
    // finds nothing.
    expect(OUTSIDE_THE_PARENS.map(functionFindings)).toEqual([1, 1])
    // And the class search does read the parameter list (bug 0325) and the body, so a fix that
    // reported nothing anywhere could not pass this test.
    expect(classFindings('  m(/* TODO */ g = 1) { return g }')).toBe(1)
    expect(classFindings('  m(/* TODO */) { return 1 }')).toBe(1)
    expect(classFindings('  m() { return 1 } /* TODO */')).toBe(1)
  })

  it('KNOWN GAP — an overload signature parameter list is read by neither search', () => {
    const overload = '  m(a: /* TODO */ number): void\n  m(a?: number): void { return }'
    expect(classFindings(overload)).toBe(0)
    // Measured: unlike the rows above, the function rules do not read it either — `getMethods()`
    // yields the implementation only — so closing this one closes it for both or for neither.
    expect(functionFindings(overload)).toBe(0)
    // The implementation's own parameter list is read, by both.
    const implementation = '  m(a: number): void\n  m(a: /* TODO */ number): void { return }'
    expect(classFindings(implementation)).toBe(1)
    expect(functionFindings(implementation)).toBe(1)
  })
})
