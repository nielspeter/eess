import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { comment } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0329 — bug 0325's fix reads the comments in a member's parameter LIST, by walking each
 * parameter. A comment attached to no parameter is still unread: one in an empty parameter list, one
 * in a return type, and one between `)` and `{`. The function rules report all three on the same
 * member, because a trivia matcher there starts at the declaration — which a class search may not
 * do, since that walk reaches the member's docstring, and bug 0307 ruled a docstring is not code.
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

const SHAPES = [
  '  m(/* TODO */) { return 1 }',
  '  m(): /* TODO */ number { return 1 }',
  '  m() /* TODO */ { return 1 }',
] as const

describe('bug 0329: the class search reads no comment outside a member parameter', () => {
  it('KNOWN GAP — a comment in an empty parameter list, a return type or before the body passes a class comment rule', () => {
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

    expect(SHAPES.map(classFindings)).toEqual([0, 0, 0])
    // The function rules read all three, so the gap is a disagreement on one member, not a matcher
    // that finds nothing.
    expect(SHAPES.map(functionFindings)).toEqual([1, 1, 1])
    // And the class search does read a comment ON a parameter (bug 0325) and after the body, so a
    // fix that reported nothing anywhere could not pass this test.
    expect(classFindings('  m(g = /* TODO */ 1) { return g }')).toBe(1)
    expect(classFindings('  m() { return 1 } /* TODO */')).toBe(1)
  })
})
