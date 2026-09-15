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
 * the same again in a nested pattern. The search reads all three, after everything it read before,
 * so a finding a baseline accepted keeps its ordinal.
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

const lineOf = (v: { message: string }): string => /at line (\d+)/.exec(v.message)?.[1] ?? '?'
const ordinalOf = (v: { identity?: string }): string => /#(\d+)$/.exec(v.identity ?? '')?.[1] ?? '?'
const scopeOf = (v: { identity?: string }): string => (v.identity ?? '').replace(/#\d+$/, '')
const byLine = (pairs: string[][]): string[][] => pairs.sort((a, b) => Number(a[0]) - Number(b[0]))

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
      "  constructor({ c = eval('c') } = {}) {}", // 9
      '}', // 10
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

    // An object pattern, an array pattern with a hole, a nested pattern, a computed key, a setter's
    // parameter and a constructor's.
    expect(evals.map((v) => v.message).sort()).toEqual([
      "Destructured contains call to 'eval' at line 2",
      "Destructured contains call to 'eval' at line 3",
      "Destructured contains call to 'eval' at line 6",
      "Destructured contains call to 'eval' at line 7",
      "Destructured contains call to 'eval' at line 8",
      "Destructured contains call to 'eval' at line 9",
    ])
    expect(numbers.map((v) => v.message)).toEqual([
      'Destructured.q contains magic number 4242 — extract to a named constant',
    ])
    expect(catches.map((v) => [v.line, v.message])).toEqual([
      [5, "catch block binds 'err' but never references it — error is silently discarded"],
    ])
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
      '  constructor({ timeout = 4141 } = {}) {}', // 9
      '  outer({ timeout } = { timeout: 4040 }) { return timeout }', // 10
      '}', // 11
    ])

    const result = classes(p)
      .should()
      .satisfy(noMagicNumbers())
      .rule({ id: 'test/0309-named' })
      .violations()

    // A binding element names its whole default as a parameter does (lines 2-4, 8 and 9); a number
    // inside a larger default, in a computed key, or in a function nested in a member is reported
    // (lines 5-7 and 10).
    expect(
      result.map((v) => v.message.replace(/ — extract to a named constant$/, '')).sort(),
    ).toEqual([
      'Named.keyed contains magic number 4646',
      'Named.m contains magic number 5000',
      'Named.outer contains magic number 4040',
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

    expect(new Set(result.map(scopeOf)).size).toBe(1)
    expect(byLine(result.map((v) => [lineOf(v), ordinalOf(v)]))).toEqual([
      ['3', '2'],
      ['4', '4'],
      ['5', '3'],
      ['7', '1'],
    ])
  })

  it('a destructured-default match is numbered after a decorator, a same-named static member and a property of that name', () => {
    // Each class holds an earlier read the test above has none of, in the scope the new match joins:
    // a member decorator (read in the third pass), a static member of the same name (members of one
    // name share a scope) and a property of that name (read in the second pass, after every
    // member's defaults). Each keeps #1, and the match inside the destructured parameter is #2.
    const p = project('/src/scopes.ts', [
      'export class Decorated {', // 1
      "  @Dec(eval('a'))", // 2
      "  m({ y = eval('b') } = {}) { return y }", // 3
      '}', // 4
      'export class Shared {', // 5
      "  static m({ a = eval('s') } = {}) { return a }", // 6
      "  m(x = eval('i')) { return x }", // 7
      '}', // 8
      'export class Propertied {', // 9
      "  static m = eval('p')", // 10
      "  m({ a = eval('q') } = {}) { return a }", // 11
      '}', // 12
    ])
    const result = classes(p)
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0309-scopes' })
      .violations()

    const scope = new Map(result.map((v) => [lineOf(v), scopeOf(v)]))
    expect(scope.get('2')).toBe(scope.get('3'))
    expect(scope.get('6')).toBe(scope.get('7'))
    expect(scope.get('10')).toBe(scope.get('11'))
    expect(byLine(result.map((v) => [lineOf(v), ordinalOf(v)]))).toEqual([
      ['2', '1'],
      ['3', '2'],
      ['6', '2'],
      ['7', '1'],
      ['10', '1'],
      ['11', '2'],
    ])
  })

  it('a destructured parameter is read in the order it runs: computed key, then default, then nested pattern', () => {
    const p = project('/src/keyed.ts', [
      'export class Keyed {', // 1
      '  k({', // 2
      "    [eval('key')]:", // 3
      "      { inner = eval('inner') } =", // 4
      "        eval('dflt'),", // 5
      '  } = {}) { return 1 }', // 6
      '}', // 7
    ])
    const result = classes(p)
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0309-order' })
      .violations()

    expect(byLine(result.map((v) => [lineOf(v), ordinalOf(v)]))).toEqual([
      ['3', '1'],
      ['4', '3'],
      ['5', '2'],
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

    expect(result.map((v) => [v.element, v.message])).toEqual([
      ['Untracked', "Untracked does not contain call to 'register'"],
    ])
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
