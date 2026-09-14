import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noMagicNumbers } from '../../src/rules/code-quality.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0317 — `noMagicNumbers` exempts a number that is the whole value of the class's own property
 * or parameter (bug 0306). A number named another way is still reported: a value in a keyed table a
 * property holds, an array element, the default of a function-valued property's parameter, and a
 * local constant in a member. Where the line belongs is a design question.
 *
 * The KNOWN GAP test asserts today's behaviour; a ruling that exempts any of these turns it red.
 * `LIMIT`, the whole value of the class's own property, is exempt and is the test's control.
 */
function project(path: string, lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(path, [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

describe('bug 0317: numbers named other than by a property or parameter of the class', () => {
  it('KNOWN GAP — a keyed table, an array element, an arrow property default and a local constant are reported', () => {
    const p = project('/src/named.ts', [
      'export class Named {', // 1
      '  static readonly Status = { OK: 4200, NotFound: 4404 }', // 2
      '  private readonly delays = [4250, 4500]', // 3
      '  handler = (retries = 4003) => retries', // 4
      '  method() { const TIMEOUT_MS = 4005; return TIMEOUT_MS }', // 5
      '  static readonly LIMIT = 4999', // 6
      '}', // 7
    ])

    const result = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0317-named-values' })
      .violations()

    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Named.Status contains magic number 4200',
      'Named.Status contains magic number 4404',
      'Named.delays contains magic number 4250',
      'Named.delays contains magic number 4500',
      'Named.handler contains magic number 4003',
      'Named.method contains magic number 4005',
    ])
  })
})
