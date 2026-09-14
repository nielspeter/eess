import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noProcessEnv } from '../../src/rules/security.js'
import { classContain, classNotContain } from '../../src/conditions/body-analysis.js'
import { call, comment, expression } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0307 — the class body search walked the code each member runs (bug 0300), but not the code a
 * class runs outside its members when it is defined: decorators, computed member names and the
 * `extends` expression. A framework module reading its configuration in a class decorator passed
 * `noProcessEnv`.
 *
 * The search fails closed in each direction. A rule for what a class must NOT contain reads all of
 * it — every decorator expression, computed name and the whole `extends` expression — because
 * reading more can only report more. A rule for what a class MUST contain reads member code only,
 * because a decorator, a DI token or a base class is wiring, and letting it satisfy
 * `classMustCall(/Repository/)` would pass a service that never delegates.
 *
 * Expectations are sorted lists, so a read reported twice shows.
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

function lineOf(v: { message: string }): string {
  return /at line (\d+)/.exec(v.message)?.[1] ?? '?'
}

function linesNamedIn(result: readonly { message: string }[]): string[] {
  return result.map(lineOf).sort((a, b) => Number(a) - Number(b))
}

// Each class carries a /validate/ call in one place only; `Behaves` in its behaviour.
const WIRING = [
  '@Validate() export class OnlyDecorated { run() { return 1 } }',
  'export class OnlyExtends extends ValidatedMixin(Base) { run() { return 1 } }',
  '@Wrap(validate()) export class DecoratorArgument { run() { return 1 } }',
  'export class DiToken { constructor(@Inject(validateToken()) private readonly v: unknown) {} run() { return 1 } }',
  'export class ComputedName { [validateKey()]() { return 1 } }',
  'export class Behaves { run() { return validate() } }',
]

describe('bug 0307: the class body search reads the code a class runs outside its members', () => {
  it('noProcessEnv on a class reads decorator arguments, computed member names and the arguments of extends', () => {
    const result = classes(
      project('/src/app.module.ts', [
        '@Module({ path: process.env.CLASS_DECORATOR })', // 1
        'export class AppModule extends Mixin(Base, process.env.HERITAGE) {', // 2
        '  [process.env.COMPUTED_KEY] = 1', // 3
        '  @Inject(process.env.MEMBER_DECORATOR) dep = 1', // 4
        '  withParam(@Inject(process.env.PARAMETER_DECORATOR) x: unknown) { return x }', // 5
        '  method() { return process.env.METHOD }', // 6
        '  @Outer(process.env.OUTER)(process.env.INNER) nested = 1', // 7
        '  @Cached(process.env.ACCESSOR_DECORATOR) get value() { return 1 }', // 8
        '  constructor(@Inject(process.env.CONSTRUCTOR_PARAMETER) private readonly host: string) {}', // 9
        '  [process.env.COMPUTED_METHOD]() { return 1 }', // 10
        '}', // 11
      ]),
    )
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0307-positions' })
      .violations()

    // Line 7 reads twice: both calls of a decorator factory chain.
    expect(linesNamedIn(result)).toEqual(['1', '2', '3', '4', '5', '6', '7', '7', '8', '9', '10'])
  })

  it('a must-not-contain rule reads the whole extends and decorator expressions', () => {
    const result = classes(
      project('/src/heritage.ts', [
        'export class Cast extends (Mixin(Base, process.env.CAST) as unknown as Ctor) {}', // 1
        'export class Chain extends mix(Base, process.env.CHAIN).with(Other) {}', // 2
        'export class Ternary extends (process.env.LEGACY ? OldBase : NewBase) {}', // 3
        'export class Indexed extends mixins[process.env.KIND] {}', // 4
        'export class NonNull extends registry.get(process.env.NON_NULL)! {}', // 5
        '@(process.env.FLAG ? A : B) export class DecoratorTernary {}', // 6
        '@(Dec(process.env.CHAINED).chained()) export class DecoratorChain {}', // 7
      ]),
    )
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0307-whole-expressions' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it('a must-contain rule is satisfied only by member code, never by a decorator, a DI token, a computed name or a base class', () => {
    // `classContain` reports each class that does NOT contain the call. Only `Behaves` calls
    // `validate` in its behaviour.
    const result = classes(project('/src/wiring.ts', WIRING))
      .should()
      .satisfy(classContain(call(/validate/i)))
      .rule({ id: 'test/0307-must-contain' })
      .violations()

    expect(result.map((v) => v.element).sort()).toEqual([
      'ComputedName',
      'DecoratorArgument',
      'DiToken',
      'OnlyDecorated',
      'OnlyExtends',
    ])
  })

  it('a must-not-contain rule reports the same calls wherever the class runs them', () => {
    const result = classes(project('/src/wiring.ts', WIRING))
      .should()
      .satisfy(classNotContain(call(/validate/i)))
      .rule({ id: 'test/0307-must-not-contain' })
      .violations()

    expect(result.map((v) => v.element).sort()).toEqual([
      'Behaves',
      'ComputedName',
      'DecoratorArgument',
      'DiToken',
      'OnlyDecorated',
      'OnlyExtends',
    ])
  })

  it('a finding the walk read before keeps its ordinal, even beside a member of the same name', () => {
    // A baseline identity is numbered within the enclosing declaration, known by its name: a getter
    // and its setter share one, and so do a static and an instance method of one name. Everything
    // the walk read before is numbered first, so those keep #1 and each new read is #2.
    const result = classes(
      project('/src/ordered.ts', [
        '@Mod(process.env.A)', // 1
        'export class Ordered {', // 2
        '  static {', // 3
        '    void process.env.B', // 4
        '  }', // 5
        '  @Dec(process.env.C)', // 6
        '  m() {', // 7
        '    return process.env.D', // 8
        '  }', // 9
        '  [process.env.E]() {', // 10
        '    return process.env.F', // 11
        '  }', // 12
        '  @Dec(process.env.G)', // 13
        '  get value() { return 1 }', // 14
        '  set value(v: unknown) {', // 15
        '    void process.env.H', // 16
        '  }', // 17
        '  static n(x = process.env.I) { return x }', // 18
        '  n() {', // 19
        '    return process.env.J', // 20
        '  }', // 21
        '}', // 22
      ]),
    )
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0307-ordinals' })
      .violations()

    const byLine = new Map(result.map((v) => [lineOf(v), v.identity ?? '']))
    expect([...byLine.keys()].sort((a, b) => Number(a) - Number(b))).toEqual([
      '1',
      '4',
      '6',
      '8',
      '10',
      '11',
      '13',
      '16',
      '18',
      '20',
    ])
    const scope = (line: string): string => (byLine.get(line) ?? '').replace(/#\d+$/, '')
    const ordinal = (line: string): string => /#(\d+)$/.exec(byLine.get(line) ?? '')?.[1] ?? '?'
    // [earlier read, new read] — the same declaration, #1 then #2.
    for (const [earlier, later] of [
      ['4', '1'], // static block, class decorator
      ['8', '6'], // body, member decorator
      ['11', '10'], // body, computed name
      ['16', '13'], // setter body, getter decorator
      ['20', '18'], // instance body, static default
    ] as const) {
      expect(scope(later)).toBe(scope(earlier))
      expect([ordinal(earlier), ordinal(later)]).toEqual(['1', '2'])
    }
  })

  it('CONTROL — a docstring above a decorator is still not read', () => {
    const result = classes(
      project('/src/documented.ts', [
        'export class Documented {', // 1
        '  /** TODO: document */', // 2
        '  @Dec({ a: 1 })', // 3
        '  method() {', // 4
        '    // TODO: in the body', // 5
        '    return 1', // 6
        '  }', // 7
        '}', // 8
      ]),
    )
      .should()
      .satisfy(classNotContain(comment(/TODO/)))
      .rule({ id: 'test/0307-docstring' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['5'])
  })

  it('CONTROL — implements is type-only and is not read', () => {
    const result = classes(
      project('/src/implements.ts', [
        'export class OnlyImplements implements Validating { run() { return 1 } }',
      ]),
    )
      .should()
      .satisfy(classNotContain(expression(/Validating/)))
      .rule({ id: 'test/0307-implements' })
      .violations()

    expect(linesNamedIn(result)).toEqual([])
  })
})
