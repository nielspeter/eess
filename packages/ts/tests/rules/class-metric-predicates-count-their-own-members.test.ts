import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import type { ClassDeclaration } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { maxCyclomaticComplexity, maxMethods } from '../../src/rules/metrics.js'
import { haveCyclomaticComplexity, haveMoreMethodsThan } from '../../src/predicates/metrics.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0311 — since bug 0306, `maxCyclomaticComplexity` measures a property whose value is a function
 * as a callable member. The `haveCyclomaticComplexity` predicate still lists methods, constructors
 * and accessors, and `maxMethods` and `haveMoreMethodsThan` count `getMethods()`.
 *
 * The KNOWN GAP tests assert today's behaviour; fixing 0311 turns them red. The CONTROL is the same
 * class written with methods.
 */
function classIn(
  name: string,
  lines: readonly string[],
): { p: ArchProject; cls: ClassDeclaration } {
  const tsm = new Project({ useInMemoryFileSystem: true })
  const file = tsm.createSourceFile(`/src/${name}.ts`, [...lines, ''].join('\n'))
  return {
    p: {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    },
    cls: file.getClassOrThrow(name),
  }
}

const HANDLERS = [
  'export class Handlers {',
  '  onX = (a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 }',
  '  onY = () => 1',
  '  onZ = () => 2',
  '}',
]

const METHODS = [
  'export class Methods {',
  '  onX(a: number) { if (a) { return 1 } if (!a) { return 2 } return 3 }',
  '  onY() { return 1 }',
  '  onZ() { return 2 }',
  '}',
]

describe('bug 0311: the class metric predicates and maxMethods count their own members', () => {
  it('KNOWN GAP — haveCyclomaticComplexity does not select a class whose complex member is a function-valued property', () => {
    const { p, cls } = classIn('Handlers', HANDLERS)

    const measured = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(2))
      .rule({ id: 'test/0311-cc' })
      .violations()

    expect(measured.map((v) => v.message)).toEqual([
      'Handlers.onX has cyclomatic complexity 3 (max: 2) — split into smaller methods',
    ])
    expect(haveCyclomaticComplexity({ greaterThan: 2 }).test(cls)).toBe(false)
  })

  it('KNOWN GAP — maxMethods and haveMoreMethodsThan count declared methods only', () => {
    const { p, cls } = classIn('Handlers', HANDLERS)

    const counted = classes(p)
      .should()
      .satisfy(maxMethods(1))
      .rule({ id: 'test/0311-methods' })
      .violations()

    expect(counted.map((v) => v.message)).toEqual([])
    expect(haveMoreMethodsThan(1).test(cls)).toBe(false)
  })

  it('CONTROL — the same members declared as methods are selected and counted', () => {
    const { p, cls } = classIn('Methods', METHODS)

    const counted = classes(p)
      .should()
      .satisfy(maxMethods(1))
      .rule({ id: 'test/0311-methods-c' })
      .violations()

    expect(haveCyclomaticComplexity({ greaterThan: 2 }).test(cls)).toBe(true)
    expect(haveMoreMethodsThan(1).test(cls)).toBe(true)
    expect(counted.map((v) => v.message)).toEqual([
      'Methods has 3 methods (max: 1) — consider splitting into focused classes',
    ])
  })
})
