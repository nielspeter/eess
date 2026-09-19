import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { calls } from '../../src/builders/call-rule-builder.js'
import { call, expression } from '../../src/helpers/matchers.js'
import type { ExpressionMatcher } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0323 — the call conditions search an argument, or a callback's body, with
 * `findMatchesInNode`, which tests a node's descendants and never the node itself. An argument
 * that is the match — `use(legacy(1))` — and a concise callback whose body is the match —
 * `use(() => legacy(1))` — are not seen, with `call()` as with `expression()`. One level down,
 * both are found.
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

const MATCHERS: readonly (readonly [label: string, matcher: ExpressionMatcher])[] = [
  ['call()', call('legacy')],
  ['expression()', expression(/legacy\(1\)/)],
]

function reports(statement: string, search: 'argument' | 'callback'): Record<string, number> {
  return Object.fromEntries(
    MATCHERS.map(([label, matcher]) => {
      const should = calls(project(statement)).that().withMethod('use').should()
      const rule =
        search === 'argument'
          ? should.notHaveArgumentContaining(matcher)
          : should.notHaveCallbackContaining(matcher)
      return [label, rule.rule({ id: 'test/0323' }).violations().length]
    }),
  )
}

describe('bug 0323: the call conditions search below the root', () => {
  it('KNOWN GAP — notHaveArgumentContaining misses an argument that is the match', () => {
    expect(reports('use(legacy(1));', 'argument')).toEqual({ 'call()': 0, 'expression()': 0 })
    // The control: one level down, inside the argument, the call is found.
    expect(reports('use(0 + legacy(1));', 'argument')).toEqual({ 'call()': 1, 'expression()': 1 })
  })

  it('KNOWN GAP — notHaveCallbackContaining misses a concise callback whose body is the match', () => {
    expect(reports('use(() => legacy(1));', 'callback')).toEqual({ 'call()': 0, 'expression()': 0 })
    // The control: the same call in a block body is found.
    expect(reports('use(() => { return legacy(1) });', 'callback')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
  })

  it('KNOWN GAP — haveArgumentContaining reports an argument that is the match as missing', () => {
    const missing = calls(project('use(legacy(1));'))
      .that()
      .withMethod('use')
      .should()
      .haveArgumentContaining(call('legacy'))
      .rule({ id: 'test/0323-requirement' })
      .violations()
      .map((v) => v.element)

    expect(missing).toEqual(['use'])
  })
})
