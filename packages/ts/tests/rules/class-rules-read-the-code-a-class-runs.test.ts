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
 * `noSilentCatch` and `noMagicNumbers` forbid something, so they read all the code a class runs.
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

  it('noMagicNumbers reports a magic number wherever the class runs it, named by its member', () => {
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
        '}', // 13
      ]),
    )
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0306-magic-numbers' })
      .violations()

    // A method's finding keeps the message it had; 100 is in the default allowed list. A number that is
    // the whole value of a property or a parameter default is named by it (lines 8-10 and 12); one
    // inside a larger initializer or default is not (lines 4 and 11).
    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Tuning contains magic number 4040',
      'Tuning.[4646] contains magic number 4646',
      'Tuning.arrow contains magic number 4242',
      'Tuning.constructor contains magic number 4444',
      'Tuning.method contains magic number 4545',
      'Tuning.scaled contains magic number 4747',
      'Tuning.static contains magic number 4343',
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

    expect(namesMeasured(complexity)).toEqual(['Handlers.onEvent', 'Handlers.onLegacy'])
    expect(namesMeasured(parameters)).toEqual(['Handlers.onEvent'])
    expect(namesMeasured(lines)).toEqual(['Handlers.onEvent'])
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
