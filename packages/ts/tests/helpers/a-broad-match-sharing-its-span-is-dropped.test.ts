import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { expression } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0322 — `expression()` keeps only the deepest match, and drops a match whenever another
 * match lies inside it. When two or more nodes cover exactly the same text, each lies inside
 * the others, so every one of them is dropped and nothing is reported. A call or an assignment
 * written as a statement without a semicolon is one such tie — the statement, its expression
 * and the block's `SyntaxList` share a span — and so are a shorthand property, a destructured
 * binding, a variable declared without a value and a type annotation.
 *
 * Each test asserts today's behaviour, so the fix turns it red.
 */
function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/shapes.ts', [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const PRELUDE = [
  'declare function legacy(n: number): { done(): void }',
  'declare function use(v: unknown): void',
  'declare const source: { gamma: number }',
  'declare const alpha: number, beta: number',
  'declare const Zeta: { one: number }',
  'declare let state: number',
  'interface Epsilon { e: number }',
]

// One function per shape, each read by its own pattern.
const SHAPES: readonly (readonly [name: string, body: string, pattern: RegExp])[] = [
  ['statementNoSemicolon', 'legacy(1)', /legacy\(1\)/],
  ['statementSemicolon', 'legacy(2);', /legacy\(2\)/],
  ['chained', 'legacy(3).done()', /legacy\(3\)/],
  ['returned', 'return legacy(4)', /legacy\(4\)/],
  ['assignmentNoSemicolon', 'state = 5', /state = 5/],
  ['shorthand', 'return { alpha }', /\balpha\b/],
  ['longhand', 'return { key: beta }', /\bbeta\b/],
  ['destructured', 'const { gamma } = source', /\bgamma\b/],
  ['declaredOnly', 'let delta', /\bdelta\b/],
  ['typeAnnotation', 'let x: Epsilon | undefined', /\bEpsilon\b/],
  ['propertyRead', 'use(Zeta.one)', /\bZeta\b/],
]

describe('bug 0322: two broad matches with one span remove each other', () => {
  it('KNOWN GAP — notContain(expression()) reports none of six shapes whose match shares its span', () => {
    const p = project([
      ...PRELUDE,
      ...SHAPES.map(([name, body]) => `export function ${name}() {\n  ${body}\n}`),
    ])

    const reported = Object.fromEntries(
      SHAPES.map(([name, , pattern]) => [
        name,
        functions(p)
          .should()
          .notContain(expression(pattern))
          .rule({ id: 'test/0322-shapes' })
          .violations()
          .map((v) => v.element),
      ]),
    )

    // The controls are reported; the six ties are not, although each body matches its pattern.
    expect(reported).toEqual({
      statementNoSemicolon: [],
      statementSemicolon: ['statementSemicolon'],
      chained: ['chained'],
      returned: ['returned'],
      assignmentNoSemicolon: [],
      shorthand: [],
      longhand: ['longhand'],
      destructured: [],
      declaredOnly: [],
      typeAnnotation: [],
      propertyRead: ['propertyRead'],
    })
  })

  it('KNOWN GAP — the class and module rules miss a statement without a semicolon', () => {
    const cls = project([
      ...PRELUDE,
      'export class NoSemicolon { m() {\n  legacy(7)\n} }',
      'export class Semicolon { m() {\n  legacy(8);\n} }',
    ])
    const classElements = (pattern: RegExp): string[] =>
      classes(cls)
        .should()
        .notContain(expression(pattern))
        .rule({ id: 'test/0322-classes' })
        .violations()
        .map((v) => v.element)

    expect(classElements(/legacy\(7\)/)).toEqual([])
    expect(classElements(/legacy\(8\)/)).toEqual(['Semicolon'])

    const moduleElements = (statement: string): string[] =>
      modules(project([...PRELUDE, statement]))
        .should()
        .notContain(expression(/legacy\(9\)/))
        .rule({ id: 'test/0322-modules' })
        .violations()
        .map((v) => v.element)

    expect(moduleElements('legacy(9)')).toEqual([])
    expect(moduleElements('legacy(9);')).toEqual(['shapes.ts'])
  })

  it('KNOWN GAP — contain(expression()) fails a function whose only match has no semicolon', () => {
    const p = project([
      ...PRELUDE,
      'export function meets() {\n  legacy(10)\n}',
      'export function meetsWithSemicolon() {\n  legacy(10);\n}',
    ])

    const failed = functions(p)
      .that()
      .haveNameMatching(/^meets/)
      .should()
      .contain(expression(/legacy\(10\)/))
      .rule({ id: 'test/0322-requirement' })
      .violations()
      .map((v) => v.element)

    // Both functions contain the call; the one without a semicolon is reported as missing it.
    expect(failed).toEqual(['meets'])
  })
})
