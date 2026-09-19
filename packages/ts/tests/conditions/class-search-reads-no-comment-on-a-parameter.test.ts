import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { comment } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0325 — the class body search reads a parameter's default as code, but reads no comment on the
 * parameter itself, nor one written inline in its default: `m(g = /* TODO *\/ 1)` passes
 * `classes().should().notContain(comment(/TODO/))`. The function search, which starts a comment
 * matcher at the declaration, reads both, so the two disagree on one member.
 *
 * Each test asserts today's behaviour, so the fix turns it red.
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
  '  m(g = /* TODO */ 1) { return g }',
  '  m(\n    // TODO\n    g = 1,\n  ) { return g }',
] as const

describe('bug 0325: the class search reads no comment on a parameter', () => {
  it('KNOWN GAP — a comment on a parameter or inline in its default passes a class comment rule', () => {
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

    expect(SHAPES.map(classFindings)).toEqual([0, 0])
    // The function rules read both, and the class rules read a comment in the member's body.
    expect(SHAPES.map(functionFindings)).toEqual([1, 1])
    expect(classFindings('  m() { const x = /* TODO */ 1; return x }')).toBe(1)
    // And a comment on its own line inside a default, which the class search reads already — what a
    // fix must not report twice.
    expect(classFindings('  m(\n    g =\n      // TODO\n      1,\n  ) { return g }')).toBe(1)
  })
})
