import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { ArchConfigError } from '@nielspeter/eess'
import { functions } from '../../src/builders/function-rule-builder.js'
import { collectFunctions, functionKindOf } from '../../src/models/arch-function.js'
import { areNotOfKind, areOfKind } from '../../src/predicates/function.js'
import { functionNoEval } from '../../src/rules/security.js'
import { noEmptyBodies, noStubComments } from '../../src/rules/hygiene.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0315 — the function builder collected function declarations, a variable whose initializer was
 * itself a function, and class methods. A constructor, an accessor, a class property whose value is a
 * function and a function behind parentheses, `as`, `<T>`, `satisfies` or `!` were not collected, so
 * no function rule — the `recommended` floor's included — read them.
 *
 * A class's function members are collected now, named by their class: `Class.constructor`,
 * `Class.get x` and `Class.set x` — distinct, because a getter and its setter share a name and a
 * metric's identity keys on it — and `Class.handler`. Named positions still not collected are bug 0321.
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

function sourceFile(path: string, lines: readonly string[]) {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile(
    path,
    [...lines, ''].join('\n'),
  )
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

describe('bug 0315: the function builder collects class members and wrapped functions', () => {
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
    const file = sourceFile('/src/members.ts', [
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
    ])

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

  it('a class member reports its return type', () => {
    const file = sourceFile('/src/typed.ts', [
      'export class Typed {',
      '  constructor() { work() }',
      '  get size(): number { return 1 }',
      '  set size(v: number) { work(v) }',
      '  onLoad = (): Promise<void> => Promise.resolve()',
      '}',
    ])

    const types = collectFunctions(file).map((fn) => [fn.getName(), fn.getReturnType().getText()])

    // A return-type rule written with `functions()` now judges these too: a constructor's return
    // type is its class, a setter's `void`.
    expect(types).toEqual([
      ['Typed.constructor', 'import("/src/typed").Typed'],
      ['Typed.get size', 'number'],
      ['Typed.set size', 'void'],
      ['Typed.onLoad', 'Promise<void>'],
    ])
  })

  it('a finding on a class member is reported at the member, not the read', () => {
    const result = functions(
      project('/src/lines.ts', [
        'export class Lines {', // 1
        '  @Tracked()', // 2
        '  handler = () => {', // 3
        '    work()', // 4
        "    return eval('h')", // 5
        '  }', // 6
        '  get g() {', // 7
        '    work()', // 8
        "    return eval('g')", // 9
        '  }', // 10
        '}', // 11
      ]),
    )
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-lines' })
      .violations()

    expect(
      result.map((v) => [v.line, v.message]).sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      [2, "Lines.handler contains call to 'eval' at line 5"],
      [7, "Lines.get g contains call to 'eval' at line 9"],
    ])
  })

  // The finding is reported at the function it belongs to, as for a function declaration, not at the comment.
  it('a comment above a class member belongs to the member', () => {
    const result = functions(
      project('/src/stubs.ts', [
        'export class Stubs {', // 1
        '  // TODO: handle the event', // 2
        '  handler = () => work()', // 3
        '  // TODO: compute it', // 4
        '  get g() { return 1 }', // 5
        '}', // 6
      ]),
    )
      .should()
      .satisfy(noStubComments())
      .rule({ id: 'test/0315-stubs' })
      .violations()

    expect(result.map((v) => [v.element, v.line]).sort()).toEqual([
      ['Stubs.get g', 5],
      ['Stubs.handler', 3],
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

  it('each function reports its kind, and a rule narrows by kind', () => {
    const file = sourceFile('/src/kinds.ts', [
      'export function declared() { work() }',
      'export const held = () => work()',
      'export const routes = { get() { work() }, post: () => work() }',
      'export class K {',
      '  m() { work() }',
      '  constructor() { work() }',
      '  get g() { return 1 }',
      '  set g(v: number) { work(v) }',
      '  p = () => work()',
      '}',
    ])

    expect(
      collectFunctions(file, { includeObjectLiteralFunctions: true }).map((fn) => [
        fn.getName(),
        functionKindOf(fn),
      ]),
    ).toEqual([
      ['declared', 'function'],
      ['held', 'function'],
      ['K.m', 'method'],
      ['K.constructor', 'constructor'],
      ['K.get g', 'getter'],
      ['K.set g', 'setter'],
      ['K.p', 'property'],
      ['routes.get', 'method'],
      ['routes.post', 'function'],
    ])

    const kept = functions(project('/src/shapes.ts', SHAPES))
      .that()
      .areNotOfKind('constructor', 'getter', 'setter')
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-not-of-kind' })
      .violations()
    expect(kept.map((v) => v.element).sort()).toEqual([
      'Service.cast',
      'Service.handler',
      'Service.m',
      'asserted',
      'bang',
      'plain',
      'satisfied',
      'wrapped',
    ])

    const onlyAccessors = functions(project('/src/shapes.ts', SHAPES))
      .that()
      .areOfKind('getter', 'setter')
      .should()
      .satisfy(functionNoEval())
      .rule({ id: 'test/0315-of-kind' })
      .violations()
    expect(onlyAccessors.map((v) => v.element).sort()).toEqual(['Service.get g', 'Service.set g'])

    expect(() => areOfKind()).toThrow(ArchConfigError)

    // A rule file loaded without a type check can name a kind that does not exist. A typo in a list
    // would otherwise narrow the rule to the kinds spelled right.
    // @ts-expect-error — 'seter' is not a FunctionKind
    const typo = () => areOfKind('getter', 'seter')
    expect(typo).toThrow(ArchConfigError)
    expect(typo).toThrow(/'seter' is not a function kind/)
    // @ts-expect-error — nor is 'constructors'
    expect(() => areNotOfKind('constructors')).toThrow(/'constructors' is not a function kind/)
  })

  it('noEmptyBodies reports an empty constructor only when it does nothing', () => {
    const p = project('/src/empty.ts', [
      'export class Injected { constructor(private readonly db: Db) {} }', // 1
      'export class Hidden { private constructor() {} }', // 2
      'export class Guarded { protected constructor() {} }', // 3
      'export class Useless { constructor() {} }', // 4
      'export class Unkept { constructor(db: Db) {} }', // 5
      'export class Getter { get x() {} }', // 6
      'export class Mixed { constructor(private readonly db: Db, log: Log) {} }', // 7
      'export class Dropped { private constructor(config: Config) {} }', // 8
      'export class Decorated { constructor(@Inject() db: Db) {} }', // 9
      'export class Explicit { public constructor() {} }', // 10
      'export class Widget { onChange = () => {} }', // 11
    ])

    const result = functions(p)
      .should()
      .satisfy(noEmptyBodies())
      .rule({ id: 'test/0315-empty' })
      .violations()

    // Every parameter a parameter property assigns a field for each, and a private or protected
    // constructor that takes nothing restricts who may construct the class: neither is a stub. A
    // plain parameter, decorated or not, is dropped; an empty public constructor does nothing. An empty function-valued property is reported as any
    // empty function is.
    expect(result.map((v) => v.message).sort()).toEqual([
      'Decorated.constructor has an empty body',
      'Dropped.constructor has an empty body',
      'Explicit.constructor has an empty body',
      'Getter.get x has an empty body',
      'Mixed.constructor has an empty body',
      'Unkept.constructor has an empty body',
      'Useless.constructor has an empty body',
      'Widget.onChange has an empty body',
    ])
  })
})
