import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { collectFunctions } from '../../src/models/arch-function.js'
import { functionNoEval } from '../../src/rules/security.js'
import { noEmptyBodies } from '../../src/rules/hygiene.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0315 — the function builder collected function declarations, a variable whose initializer was
 * itself a function, and class methods. A constructor, an accessor, a class property whose value is a
 * function and a function behind parentheses, `as`, `<T>`, `satisfies` or `!` were not collected, so
 * no function rule — the `recommended` floor's included — read them.
 *
 * Every named function is collected now. A class member is named by its class: `Class.constructor`,
 * `Class.get x` and `Class.set x` — distinct, because a getter and its setter share a name and a
 * metric's identity keys on it — and `Class.handler`.
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

const SHAPES = [
  'export class Service {', // 1
  "  m() { return eval('m') }", // 2
  "  constructor() { eval('c') }", // 3
  "  get g() { return eval('g') }", // 4
  '  set g(v: string) { eval(v) }', // 5
  "  handler = () => eval('h')", // 6
  '  cast = ((x: string) => eval(x)) as (x: string) => unknown', // 7
  '}', // 8
  'export const wrapped = ((x: string) => eval(x)) as (x: string) => unknown', // 9
  'export const satisfied = ((x: string) => eval(x)) satisfies (x: string) => unknown', // 10
  'export const asserted = <(x: string) => unknown>((x: string) => eval(x))', // 11
  'export const bang = ((x: string) => eval(x))!', // 12
  'export const plain = (x: string) => eval(x)', // 13
]

describe('bug 0315: the function builder collects every named function', () => {
  it('collects a constructor, accessors, a function-valued property and a wrapped function', () => {
    const result = functions(project('/src/shapes.ts', SHAPES))
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-shapes' })
      .violations()

    expect(result.map((v) => v.message).sort()).toEqual([
      "Service.cast contains call to 'eval' at line 7",
      "Service.constructor contains call to 'eval' at line 3",
      "Service.get g contains call to 'eval' at line 4",
      "Service.handler contains call to 'eval' at line 6",
      "Service.m contains call to 'eval' at line 2",
      "Service.set g contains call to 'eval' at line 5",
      "asserted contains call to 'eval' at line 11",
      "bang contains call to 'eval' at line 12",
      "plain contains call to 'eval' at line 13",
      "satisfied contains call to 'eval' at line 10",
      "wrapped contains call to 'eval' at line 9",
    ])
  })

  it("a class member reports its class's export, its own access modifier, async and parameters", () => {
    const tsm = new Project({ useInMemoryFileSystem: true })
    const file = tsm.createSourceFile(
      '/src/members.ts',
      [
        'export class Open {',
        '  protected constructor() { work() }',
        '  private get secret() { return 1 }',
        '  set value(v: number) { work(v) }',
        '  private handler = async (e: Event) => work(e)',
        '}',
        'class Closed {',
        '  onClick = () => work()',
        '  constructor(a: string)',
        '  constructor(a?: string) { work(a) }',
        '}',
        'declare class Ambient {',
        '  constructor(a: string)',
        '  get size(): number',
        '}',
        '',
      ].join('\n'),
    )

    const collected = collectFunctions(file)
      .filter((fn) => fn.getName()?.includes('.'))
      .map((fn) => [
        fn.getName(),
        fn.getScope(),
        fn.isExported(),
        fn.isAsync(),
        fn.getParameters().length,
      ])

    // One `Closed.constructor`: the implementation is the function, not its overload signature. An
    // ambient class's constructor has no body and is not collected; its accessor is, as a method is.
    expect(collected).toEqual([
      ['Open.constructor', 'protected', true, false, 0],
      ['Open.get secret', 'private', true, false, 0],
      ['Open.set value', 'public', true, false, 1],
      ['Open.handler', 'private', true, true, 1],
      ['Closed.constructor', 'public', false, false, 1],
      ['Closed.onClick', 'public', false, false, 0],
      ['Ambient.get size', 'public', false, false, 0],
    ])
  })

  it('includeMethods: false leaves out every class member, and still reads a wrapped variable', () => {
    const result = functions(project('/src/shapes.ts', SHAPES), { includeMethods: false })
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-no-members' })
      .violations()

    expect(result.map((v) => v.message).sort()).toEqual([
      "asserted contains call to 'eval' at line 11",
      "bang contains call to 'eval' at line 12",
      "plain contains call to 'eval' at line 13",
      "satisfied contains call to 'eval' at line 10",
      "wrapped contains call to 'eval' at line 9",
    ])
  })

  it('noEmptyBodies reports an empty constructor only when it does nothing', () => {
    const p = project('/src/empty.ts', [
      'export class Injected { constructor(private readonly db: Db) {} }', // 1
      'export class Hidden { private constructor() {} }', // 2
      'export class Guarded { protected constructor() {} }', // 3
      'export class Useless { constructor() {} }', // 4
      'export class Unkept { constructor(db: Db) {} }', // 5
      'export class Getter { get x() {} }', // 6
    ])

    const result = functions(p)
      .should()
      .satisfy(noEmptyBodies())
      .rule({ id: 'test/0315-empty' })
      .violations()

    // A parameter property assigns a field, and a private or protected constructor restricts who may
    // construct: neither body is a stub. An empty public constructor without them does nothing.
    expect(result.map((v) => v.message).sort()).toEqual([
      'Getter.get x has an empty body',
      'Unkept.constructor has an empty body',
      'Useless.constructor has an empty body',
    ])
  })
})
