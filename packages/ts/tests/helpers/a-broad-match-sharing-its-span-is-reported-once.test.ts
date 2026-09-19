import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { calls } from '../../src/builders/call-rule-builder.js'
import { expression } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0322 — `expression()` keeps only the deepest match. Several nodes can share one span: a
 * statement without a semicolon and its expression, a shorthand property and its name, a binding
 * or a declaration and its name, a type reference and its type name, and the only item of a list —
 * a call's only argument, an array's only element, a block's only statement — and the
 * `SyntaxList` holding it. Each lies inside the others, and the filter used to drop every one of
 * them, so nothing was reported. It now keeps one, the deepest.
 *
 * Every shape is reported exactly once. Breaking the tie by `getAncestors()` reports some twice,
 * because it cannot see the `SyntaxList`, and so did adding a concise arrow's body beside a broad
 * match inside it. Which node of a tie is kept shows in a finding's identity, so that is pinned too.
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
  'declare function modern(n: number): void',
  'declare function use(...v: unknown[]): void',
  'declare const source: { gamma: number }',
  'declare const alpha: number, beta: number, eta: number, iota: number',
  'declare const Zeta: { one: number }',
  'declare const Theta: { two: number }',
  'declare let state: number',
  'interface Epsilon { e: number }',
]

// One function per shape, each read by a pattern no other function matches.
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
  ['onlyArgument', 'use(eta);', /\beta\b/],
  ['onlyArgumentAccess', 'use(Theta.two);', /Theta\.two/],
  ['onlyArrayElement', 'return [iota];', /\biota\b/],
  ['callAsOnlyArgument', 'use(legacy(12));', /legacy\(12\)/],
]

describe('bug 0322: a broad match that shares its span is reported once', () => {
  it('notContain(expression()) reports each shape once, whether or not its match shares a span', () => {
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

    expect(reported).toEqual(Object.fromEntries(SHAPES.map(([name]) => [name, [name]])))
  })

  it('the class and module rules report a statement without a semicolon once', () => {
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

    expect(classElements(/legacy\(7\)/)).toEqual(['NoSemicolon'])
    expect(classElements(/legacy\(8\)/)).toEqual(['Semicolon'])

    const moduleElements = (statement: string): string[] =>
      modules(project([...PRELUDE, statement]))
        .should()
        .notContain(expression(/legacy\(9\)/))
        .rule({ id: 'test/0322-modules' })
        .violations()
        .map((v) => v.element)

    expect(moduleElements('legacy(9)')).toEqual(['shapes.ts'])
    expect(moduleElements('legacy(9);')).toEqual(['shapes.ts'])
  })

  it('contain(expression()) passes a function whose only match has no semicolon', () => {
    const p = project([
      ...PRELUDE,
      'export function meets() {\n  legacy(10)\n}',
      'export function meetsWithSemicolon() {\n  legacy(10);\n}',
      'export function misses() {\n  legacy(11)\n}',
    ])

    const failed = functions(p)
      .that()
      .haveNameMatching(/^(meets|misses)/)
      .should()
      .contain(expression(/legacy\(10\)/))
      .rule({ id: 'test/0322-requirement' })
      .violations()
      .map((v) => v.element)

    // The control: the function without the call is still reported.
    expect(failed).toEqual(['misses'])
  })

  it('useInsteadOf reports a bad match that shares its span, once', () => {
    const p = project([...PRELUDE, 'export function f() {\n  legacy(1)\n}'])

    const kinds = functions(p)
      .that()
      .haveNameMatching(/^f$/)
      .should()
      .useInsteadOf(expression(/legacy\(1\)/), expression(/modern\(1\)/))
      .rule({ id: 'test/0322-instead' })
      .violations()
      .map((v) => (v.message.includes(' does not contain ') ? 'good missing' : 'bad found'))

    expect(kinds).toEqual(['bad found', 'good missing'])
  })

  it('notHaveArgumentContaining reports a match that shares its span inside an argument, once', () => {
    const found = (statement: string): number =>
      calls(project([...PRELUDE, statement]))
        .that()
        .withMethod('use')
        .should()
        .notHaveArgumentContaining(expression(/\balpha\b/))
        .rule({ id: 'test/0322-arguments' })
        .violations()
        .filter((v) => v.message.includes('alpha')).length

    // A shorthand property, and a callback whose only statement reads the name as its only
    // argument — with and without a semicolon.
    expect([
      found('use({ alpha });'),
      found('use(() => { legacy(alpha) });'),
      found('use(() => { legacy(alpha); });'),
      found('use({ key: alpha });'),
    ]).toEqual([1, 1, 1, 1])
  })

  it('notHaveCallbackContaining reports a match that shares its span inside a callback, once', () => {
    const found = (statement: string): number =>
      calls(project([...PRELUDE, statement]))
        .that()
        .withMethod('use')
        .should()
        .notHaveCallbackContaining(expression(/\balpha\b/))
        .rule({ id: 'test/0322-callbacks' })
        .violations().length

    // The callback's only statement, without a semicolon and with one; then a shorthand property.
    expect([
      found('use(() => { legacy(alpha) });'),
      found('use(() => { legacy(alpha); });'),
      found('use(() => { return { alpha } });'),
    ]).toEqual([1, 1, 1])
  })

  it('the requirement conditions pass a body whose only match shares its span', () => {
    const useCalls = (statement: string) =>
      calls(project([...PRELUDE, statement]))
        .that()
        .withMethod('use')
        .should()
    const failing = (statement: string, condition: 'argument' | 'callback'): readonly string[] => {
      const should = useCalls(statement)
      const rule =
        condition === 'argument'
          ? should.haveArgumentContaining(expression(/\balpha\b/))
          : should.haveCallbackContaining(expression(/\balpha\b/))
      return rule
        .rule({ id: 'test/0322-requires' })
        .violations()
        .map((v) => v.element)
    }

    expect(failing('use({ alpha });', 'argument')).toEqual([])
    expect(failing('use(() => { legacy(alpha) });', 'callback')).toEqual([])
    // The controls: a call without the name still fails both.
    expect(failing('use({ key: beta });', 'argument')).toEqual(['use'])
    expect(failing('use(() => { legacy(beta) });', 'callback')).toEqual(['use'])

    // useInsteadOf's good side: the good call, written without a semicolon, is found.
    const insteadOf = functions(project([...PRELUDE, 'export function g() {\n  modern(1)\n}']))
      .that()
      .haveNameMatching(/^g$/)
      .should()
      .useInsteadOf(expression(/legacy\(1\)/), expression(/modern\(1\)/))
      .rule({ id: 'test/0322-instead-good' })
      .violations()
    expect(insteadOf.map((v) => v.element)).toEqual([])
  })

  it('a concise arrow whose body holds a broad match reports it once', () => {
    const elements = (declaration: string, pattern: RegExp): string[] =>
      functions(project([...PRELUDE, declaration]))
        .that()
        .haveNameMatching(/^arrow$/)
        .should()
        .notContain(expression(pattern))
        .rule({ id: 'test/0322-concise' })
        .violations()
        .map((v) => v.element)

    // A tie inside the body, a shorthand property, and a match strictly inside the body: each is
    // one finding, not the match and the body around it.
    expect(elements('export const arrow = () => use(legacy(12))', /legacy\(12\)/)).toEqual([
      'arrow',
    ])
    expect(elements('export const arrow = () => ({ alpha })', /\balpha\b/)).toEqual(['arrow'])
    expect(elements('export const arrow = () => legacy(1)', /legacy/)).toEqual(['arrow'])
  })

  it('of a tie, the deepest node is kept, which a finding names in its identity', () => {
    const identities = modules(project(['export class C { delta }']))
      .should()
      .notContain(expression(/\bdelta\b/))
      .rule({ id: 'test/0322-identity' })
      .violations()
      .map((v) => (v.identity ?? '').split('::')[2])

    // The property's name is the deepest node of the tie; the class's member list around it would
    // be named for the class, `C`.
    expect(identities).toEqual(['C.delta'])
  })
})
