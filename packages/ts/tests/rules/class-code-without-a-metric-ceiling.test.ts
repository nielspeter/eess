import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { maxCyclomaticComplexity, maxMethodLines } from '../../src/rules/metrics.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0312 — the class metrics rules measure callable members: declared methods, constructors and
 * accessors, and properties whose value is a function (bug 0306). A static block, a function passed
 * through a call in a property's value and a method of an object in a property's value are code the
 * class runs, and no ceiling measures them.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0312 turns it red. `onDirect`, the same
 * function as the whole value of a property, is measured, and is the test's control.
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

function namesMeasured(result: readonly { message: string }[]): string[] {
  return result.map((v) => /^(\S+) has /.exec(v.message)?.[1] ?? '?').sort()
}

describe('bug 0312: code a class runs that no metric ceiling measures', () => {
  it('KNOWN GAP — a static block and a function nested in a property value have no complexity or line ceiling', () => {
    const p = project('/src/unmeasured.ts', [
      'export class Unmeasured {',
      '  static { if (A) {} if (B) {} if (C) {} }',
      '  onDebounced = debounce((a: number) => { if (a) {} if (!a) {} if (a > 1) {} })',
      '  handlers = { onEvent(a: number) { if (a) {} if (!a) {} if (a > 1) {} } }',
      '  onDirect = (a: number) => { if (a) {} if (!a) {} if (a > 1) {} }',
      '}',
    ])

    const complexity = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(2))
      .rule({ id: 'test/0312-cc' })
      .violations()
    const lines = classes(p)
      .should()
      .satisfy(maxMethodLines(0))
      .rule({ id: 'test/0312-lines' })
      .violations()

    expect(namesMeasured(complexity)).toEqual(['Unmeasured.onDirect'])
    expect(namesMeasured(lines)).toEqual(['Unmeasured.onDirect'])
  })
})
