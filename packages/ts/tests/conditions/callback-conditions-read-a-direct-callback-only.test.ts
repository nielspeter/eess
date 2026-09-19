import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { calls } from '../../src/builders/call-rule-builder.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0324 — the callback conditions take a callback only when an argument IS an arrow function or a
 * function expression (`getFunctionBody`). A callback in an object literal — `{ handler: () => … }`,
 * or a method shorthand — and a callback behind parentheses are not searched, although `within()`
 * extracts the object-literal ones and the argument conditions read all three.
 *
 * Each test asserts today's behaviour, so the fix turns it red.
 */
function project(statement: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/calls.ts',
    [
      'declare function legacy(n: number): number',
      'declare function use(...v: unknown[]): void',
      statement,
      '',
    ].join('\n'),
  )
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const SHAPES = [
  'use({ handler: () => legacy(1) });',
  'use({ handler() { return legacy(1) } });',
  'use((() => legacy(1)));',
] as const

describe('bug 0324: the callback conditions read a direct callback only', () => {
  it('KNOWN GAP — notHaveCallbackContaining misses a callback in an object literal or in parentheses', () => {
    const callback = (statement: string): number =>
      calls(project(statement))
        .that()
        .withMethod('use')
        .should()
        .notHaveCallbackContaining(call('legacy'))
        .rule({ id: 'test/0324-callback' })
        .violations().length
    const argument = (statement: string): number =>
      calls(project(statement))
        .that()
        .withMethod('use')
        .should()
        .notHaveArgumentContaining(call('legacy'))
        .rule({ id: 'test/0324-argument' })
        .violations().length

    expect(SHAPES.map(callback)).toEqual([0, 0, 0])
    // The argument condition reads all three, and a direct callback is read by both.
    expect(SHAPES.map(argument)).toEqual([1, 1, 1])
    expect(callback('use(() => legacy(1));')).toBe(1)
  })

  it('KNOWN GAP — haveCallbackContaining reports a call whose callback is in an object literal as missing it', () => {
    const missing = calls(project('use({ handler: () => legacy(1) });'))
      .that()
      .withMethod('use')
      .should()
      .haveCallbackContaining(call('legacy'))
      .rule({ id: 'test/0324-requirement' })
      .violations()
      .map((v) => v.element)

    expect(missing).toEqual(['use'])
  })
})
