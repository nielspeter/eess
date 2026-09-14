import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noSilentCatch } from '../../src/rules/errors.js'
import { noMagicNumbers } from '../../src/rules/code-quality.js'
import { maxCyclomaticComplexity, maxMethodLines, maxParameters } from '../../src/rules/metrics.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0306 — `noSilentCatch`, `noMagicNumbers` and the class metrics rules did not use the class
 * body search (bugs 0300, 0307). Each walked its own list of members, so a silent `catch` in an
 * arrow-function property, a magic number in a static block and an arrow-function property of any
 * complexity all passed.
 *
 * `noSilentCatch` forbids something, so it reads all the code a class runs. `noMagicNumbers` reads the
 * class's member code: a number in a decorator is named by the decorator that takes it.
 * The metrics rules measure callable members, and a property whose value is a function is one.
 *
 * Expectations are sorted lists, so a finding reported twice shows.
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

describe('bug 0306: class rules with their own walk read the code a class runs', () => {
  it('noSilentCatch reports a silent catch wherever the class runs it', () => {
    const result = classes(
      project('/src/worker.ts', [
        'export class Worker {', // 1
        '  handler = () => { try { work() } catch (e) {} }', // 2
        '  static { try { work() } catch (e) {} }', // 3
        '  method() { try { work() } catch (e) {} }', // 4
        '  retry(onFail = () => { try { work() } catch {} }) { return onFail }', // 5
        '  @Hook(() => { try { work() } catch (e) {} }) hooked = 1', // 6
        '  logs() { try { work() } catch (e) { log(e) } }', // 7
        '}', // 8
      ]),
    )
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0306-silent-catch' })
      .violations()

    // Line 7 references the error, so it is not silent.
    expect(result.map((v) => String(v.line)).sort((a, b) => Number(a) - Number(b))).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
  })

  it('noMagicNumbers reports a magic number anywhere in member code, named by its member', () => {
    const result = classes(
      project('/src/tuning.ts', [
        '@Retry(4040) export class Tuning {', // 1
        '  arrow = () => 4242', // 2
        '  static { void 4343 }', // 3
        '  constructor(x = 4444 * 2) {}', // 4
        '  method() { return 4545 }', // 5
        '  [4646]() { return 1 }', // 6
        '  allowed() { return 100 }', // 7
        '  static readonly TIMEOUT_MS = 5000', // 8
        '  private readonly offset = -6000', // 9
        '  retries = 4848', // 10
        '  scaled = 4747 * 10', // 11
        '  retry(attempts = 4949) { return attempts }', // 12
        '  flags = ~9696', // 13
        '  bonus = +7171', // 14
        '  get limit() { return 4141 }', // 15
        '  asConst = 4250 as const', // 16
        '  parens = (4251)', // 17
        '  satisfied = 4252 satisfies number', // 18
        '  asserted = <number>4253', // 19
        '  bang = 4254!', // 20
        '  signedAsConst = -4255 as const', // 21
        '  separated() { return 4_256 }', // 22
        '}', // 23
      ]),
    )
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0306-magic-numbers' })
      .violations()

    // A method's finding keeps the message it had; 100 is in the default allowed list. The rule reads
    // member code only, so the decorator's 4040 and the computed name's 4646 are not reported. A number
    // that is the whole value of the class's own property or parameter is named by it (lines 8-10, 12
    // and 14), through a sign, parentheses, `as`, `<T>`, `satisfies` or `!` (lines 16-21); one inside a
    // larger initializer or default, or behind `~`, is not (lines 4, 11 and 13). An accessor's number
    // is named by the accessor, and `4_256` is read as its value.
    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Tuning.arrow contains magic number 4242',
      'Tuning.constructor contains magic number 4444',
      'Tuning.flags contains magic number 9696',
      'Tuning.limit contains magic number 4141',
      'Tuning.method contains magic number 4545',
      'Tuning.scaled contains magic number 4747',
      'Tuning.separated contains magic number 4256',
      'Tuning.static contains magic number 4343',
    ])
  })

  it('noMagicNumbers reads a number by its value, so a numeric separator matches the allowed list', () => {
    const result = classes(
      project('/src/separated.ts', [
        'export class Separated {', // 1
        '  a() { return 5_000 }', // 2
        '  b() { return 6_000 }', // 3
        '}', // 4
      ]),
    )
      .should()
      .satisfy(noMagicNumbers({ allowed: [5000] }))
      .rule({ id: 'test/0306-separators' })
      .violations()

    expect(result.map((v) => v.message)).toEqual([
      'Separated.b contains magic number 6000 — extract to a named constant',
    ])
  })

  it("noMagicNumbers exempts the class's own named values, not those of a function or class nested in a member", () => {
    // The method walk before bug 0306 reported a number in a nested function's default or a nested
    // class's field; those are not the class's names, so they are still reported.
    const result = classes(
      project('/src/nested.ts', [
        'export class Nested {', // 1
        '  m() { const f = (x = 5000) => x; return f(0) }', // 2
        '  n() { return class { t = 6000 } }', // 3
        '  o() { function g(y = -7000) { return y } return g() }', // 4
        '  own = 8000', // 5
        '  p(z = 9000) { return z }', // 6
        '}', // 7
      ]),
    )
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0306-nested-named-values' })
      .violations()

    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Nested.m contains magic number 5000',
      'Nested.n contains magic number 6000',
      'Nested.o contains magic number 7000',
    ])
  })

  it('the class metrics rules measure a function-valued property as a member', () => {
    const p = project('/src/handlers.ts', [
      'export class Handlers {',
      '  onEvent = (a: number, b: number, c: number) => {',
      '    if (a) { return 1 }',
      '    if (b) { return 2 }',
      '    if (c) { return 3 }',
      '    return 4',
      '  }',
      '  onLegacy = function (a: number) { if (a) { return 1 } if (!a) { return 2 } return 3 }',
      '  onWrapped = ((a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 }) as Handler',
      '  onSatisfies = ((a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 }) satisfies Handler',
      '  onAsserted = <Handler>((a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 })',
      '  onNonNull = ((a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 })!',
      '  plain = 5',
      '  small() { return 1 }',
      '}',
    ])
    const complexity = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(2))
      .rule({ id: 'test/0306-cc' })
      .violations()
    const parameters = classes(p)
      .should()
      .satisfy(maxParameters(2))
      .rule({ id: 'test/0306-params' })
      .violations()
    const lines = classes(p)
      .should()
      .satisfy(maxMethodLines(3))
      .rule({ id: 'test/0306-lines' })
      .violations()

    expect(namesMeasured(complexity)).toEqual([
      'Handlers.onAsserted',
      'Handlers.onEvent',
      'Handlers.onLegacy',
      'Handlers.onNonNull',
      'Handlers.onSatisfies',
      'Handlers.onWrapped',
    ])
    expect(namesMeasured(parameters)).toEqual(['Handlers.onEvent'])
    expect(namesMeasured(lines)).toEqual(['Handlers.onEvent'])
  })

  it('the metrics rules list declared members before function-valued properties, and anchor a property finding at the property', () => {
    const p = project('/src/order.ts', [
      'export class Order {', // 1
      '  onFirst =', // 2
      '    (a: number) => { if (a) { return 1 } if (!a) { return 2 } return 3 }', // 3
      '  later(a: number) { if (a) { return 1 } if (!a) { return 2 } return 3 }', // 4
      '}', // 5
    ])
    const result = classes(p)
      .should()
      .satisfy(maxCyclomaticComplexity(2))
      .rule({ id: 'test/0306-order' })
      .violations()

    // Not sorted: the declared member the old walk reported comes first, wherever the property sits.
    expect(result.map((v) => [v.line, v.message])).toEqual([
      [4, 'Order.later has cyclomatic complexity 3 (max: 2) — split into smaller methods'],
      [2, 'Order.onFirst has cyclomatic complexity 3 (max: 2) — split into smaller methods'],
    ])
  })

  it('CONTROL — a property that is not a function, and a static block, are not members a metric measures', () => {
    const p = project('/src/data.ts', [
      'export class Data {',
      '  values = [',
      '    1,',
      '    2,',
      '    3,',
      '  ]',
      '  static {',
      '    void 1',
      '    void 2',
      '  }',
      '  small() { return 1 }',
      '}',
    ])
    const lines = classes(p)
      .should()
      .satisfy(maxMethodLines(1))
      .rule({ id: 'test/0306-control' })
      .violations()

    expect(namesMeasured(lines)).toEqual([])
  })
})
