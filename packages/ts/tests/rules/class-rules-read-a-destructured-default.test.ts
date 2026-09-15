import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noEval } from '../../src/rules/security.js'
import { noSilentCatch } from '../../src/rules/errors.js'
import { noMagicNumbers } from '../../src/rules/code-quality.js'
import { classContain } from '../../src/conditions/body-analysis.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0309 — the class body search read a parameter's default, but not a default inside a
 * destructured parameter: `m({ a = eval('x') } = {})`. Every class rule over that search missed it.
 *
 * A destructured parameter runs code at each call: a binding element's default, a computed key, and
 * the same again in a nested pattern. The search reads all three, after everything it read before.
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

describe('bug 0309: the class rules read a default inside a destructured parameter', () => {
  it('the class rules read a default inside a destructured parameter', () => {
    const p = project('/src/destructured.ts', [
      'export class Destructured {', // 1
      "  m({ a = eval('x') } = {}) { return a }", // 2
      "  n([, b = eval('y')] = []) { return b }", // 3
      '  q({ e = 4242 * 2 } = {}) { return e }', // 4
      '  r({ f = () => { try { work() } catch (err) {} } } = {}) { return f }', // 5
      "  s({ outer: { inner = eval('w') } = {} } = {}) { return inner }", // 6
      "  t({ [eval('k')]: key } = {}) { return key }", // 7
      "  set v({ w = eval('v') }) {}", // 8
      '}', // 9
    ])

    const evals = classes(p).should().satisfy(noEval()).rule({ id: 'test/0309-eval' }).violations()
    const numbers = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-magic' })
      .violations()
    const catches = classes(p)
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0309-catch' })
      .violations()

    // An object pattern, an array pattern with a hole, a nested pattern, a computed key and a
    // setter's parameter.
    expect(evals.map((v) => v.message)).toEqual([
      "Destructured contains call to 'eval' at line 2",
      "Destructured contains call to 'eval' at line 3",
      "Destructured contains call to 'eval' at line 6",
      "Destructured contains call to 'eval' at line 7",
      "Destructured contains call to 'eval' at line 8",
    ])
    expect(numbers.map((v) => v.message)).toEqual([
      'Destructured.q contains magic number 4242 — extract to a named constant',
    ])
    expect(catches.map((v) => v.line)).toEqual([5])
  })

  it("noMagicNumbers exempts a whole default inside the class's own destructured parameter, not a nested function's", () => {
    const p = project('/src/named.ts', [
      'export class Named {', // 1
      '  retry({ attempts = 4949 } = {}) { return attempts }', // 2
      '  signed({ offset = -4545 } = {}) { return offset }', // 3
      '  deep({ o: { p = 4848 } = {} } = {}) { return p }', // 4
      '  scaled({ s = 4747 * 10 } = {}) { return s }', // 5
      '  keyed({ [4646]: k } = {}) { return k }', // 6
      '  m() { const f = ({ x = 5000 }) => x; return f({}) }', // 7
      '  pair([first = 4343] = []) { return first }', // 8
      '}', // 9
    ])

    const result = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-named' })
      .violations()

    // A binding element names its whole default as a parameter does (lines 2-4 and 8); a number inside a
    // larger default, in a computed key, or in a function nested in a member is reported (5-7).
    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Named.keyed contains magic number 4646',
      'Named.m contains magic number 5000',
      'Named.scaled contains magic number 4747',
    ])
  })

  it('a match in a destructured default is numbered after every match the search read before in that member', () => {
    // A baseline identity is numbered within the enclosing member. The body's match and the plain
    // defaults' matches keep the ordinals the search gave them before bug 0309 — #1, #2 and #3 — so a
    // baseline that accepted them still does, and the new match in the destructured default is #4.
    const p = project('/src/ordered.ts', [
      'export class Ordered {', // 1
      '  m(', // 2
      "    x = eval('a'),", // 3
      "    { y = eval('b') } = {},", // 4
      "    z = eval('c'),", // 5
      '  ) {', // 6
      "    return eval('d')", // 7
      '  }', // 8
      '}', // 9
    ])
    const result = classes(p)
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0309-ordinals' })
      .violations()

    const ordinalByLine = result.map((v) => [
      /at line (\d+)/.exec(v.message)?.[1],
      /#(\d+)$/.exec(v.identity ?? '')?.[1],
    ])
    const scopes = new Set(result.map((v) => (v.identity ?? '').replace(/#\d+$/, '')))
    expect(scopes.size).toBe(1)
    expect(ordinalByLine.sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      ['3', '2'],
      ['4', '4'],
      ['5', '3'],
      ['7', '1'],
    ])
  })

  it('classContain counts a call in a destructured default as the class containing it', () => {
    // A destructured default is member code, so a must-contain rule is satisfied by a call there, as
    // it is by a call in a plain default.
    const p = project('/src/registry.ts', [
      "export class Tracked { m({ tracker = register('tracked') } = {}) { return tracker } }",
      'export class Untracked { m({ value = 1 } = {}) { return value } }',
    ])
    const result = classes(p)
      .should()
      .satisfy(classContain(call('register')))
      .rule({ id: 'test/0309-contain' })
      .violations()

    expect(result.map((v) => v.element)).toEqual(['Untracked'])
  })

  it('CONTROL — a plain parameter default and a whole pattern default are read as before', () => {
    const p = project('/src/plain.ts', [
      'export class Plain {', // 1
      "  m(a = eval('x')) { return a }", // 2
      '  q(e = 4242 * 2) { return e }', // 3
      '  r(f = () => { try { work() } catch (err) {} }) { return f }', // 4
      "  o({ c } = { c: eval('z') }) { return c }", // 5
      '}', // 6
    ])

    const evals = classes(p)
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0309-eval-c' })
      .violations()
    const numbers = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-magic-c' })
      .violations()
    const catches = classes(p)
      .should()
      .satisfy(noSilentCatch())
      .rule({ id: 'test/0309-catch-c' })
      .violations()

    expect(evals.map((v) => v.message)).toEqual([
      "Plain contains call to 'eval' at line 2",
      "Plain contains call to 'eval' at line 5",
    ])
    expect(numbers.map((v) => v.message)).toEqual([
      'Plain.q contains magic number 4242 — extract to a named constant',
    ])
    expect(catches.map((v) => v.line)).toEqual([4])
  })
})
