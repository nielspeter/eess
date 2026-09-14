import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noProcessEnv } from '../../src/rules/security.js'
import { classContain, classNotContain } from '../../src/conditions/body-analysis.js'
import { call, comment } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0307 — the class body search walked the code each member runs (bug 0300), but not the code a
 * class supplies outside its members, which runs when the class is defined: decorator arguments,
 * computed member names and the arguments of `extends`. A framework module reading its
 * configuration in a class decorator passed `noProcessEnv`.
 *
 * The ruling: the search reads what the class SUPPLIES — decorator arguments on the class, its
 * members, accessors and parameters (every call of a decorator factory chain), computed member
 * names, and the arguments of calls in `extends`. It does not read the WIRING — the decorator or
 * base class itself, which `haveDecorator()` and `extend()` select on — nor `implements`, which is
 * type-only. Counting the wiring would let a must-contain rule pass on a class that only carries
 * `@Validate()`; the second test pins both halves.
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

describe('bug 0307: the class body search reads what a class supplies outside its members', () => {
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

    // Line 7 reads twice: both calls of a decorator factory chain supply arguments.
    expect(linesNamedIn(result)).toEqual(['1', '2', '3', '4', '5', '6', '7', '7', '8', '9', '10'])
  })

  it('a decorator or base class is wiring, not body code, but a call in its arguments is', () => {
    // `classContain` reports each class that does NOT contain the call. The first three carry a
    // /validate/ name only as wiring — a decorator, a mixin called in `extends`, an interface —
    // so they do not contain it. The fourth supplies `validate()` as a decorator argument, so it
    // does.
    const result = classes(
      project('/src/wiring.ts', [
        '@Validate() export class OnlyDecorated { run() { return 1 } }',
        'export class OnlyExtends extends ValidatedMixin(Base) { run() { return 1 } }',
        'export class OnlyImplements implements Validating { run() { return 1 } }',
        '@Wrap(validate()) export class SuppliesACall { run() { return 1 } }',
      ]),
    )
      .should()
      .satisfy(classContain(call(/validate/i)))
      .rule({ id: 'test/0307-wiring' })
      .violations()

    expect(result.map((v) => v.element).sort()).toEqual([
      'OnlyDecorated',
      'OnlyExtends',
      'OnlyImplements',
    ])
  })

  it('a match outside the members is numbered after the matches its declaration already had', () => {
    // A baseline identity is numbered within the enclosing declaration. A class decorator's
    // arguments share the class with a static block; a member decorator's share the member with
    // its body. The walk before bug 0307 numbered the static block and the body #1, so they keep
    // #1 and the decorator arguments are #2.
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
        '}', // 10
      ]),
    )
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0307-ordinals' })
      .violations()

    const byLine = new Map(result.map((v) => [lineOf(v), v.identity ?? '']))
    expect([...byLine.keys()].sort()).toEqual(['1', '4', '6', '8'])
    const scope = (identity: string): string => identity.replace(/#\d+$/, '')
    expect(scope(byLine.get('1') ?? '')).toBe(scope(byLine.get('4') ?? ''))
    expect(scope(byLine.get('6') ?? '')).toBe(scope(byLine.get('8') ?? ''))
    expect(byLine.get('4')?.endsWith('#1')).toBe(true)
    expect(byLine.get('1')?.endsWith('#2')).toBe(true)
    expect(byLine.get('8')?.endsWith('#1')).toBe(true)
    expect(byLine.get('6')?.endsWith('#2')).toBe(true)
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
})
