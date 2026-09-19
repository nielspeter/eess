import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { calls } from '../../src/builders/call-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { access, call, expression } from '../../src/helpers/matchers.js'
import type { ExpressionMatcher } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0323 — the call conditions searched an argument, or a callback's body, with
 * `findMatchesInNode`, which tests a node's descendants and never the node itself. An argument that
 * is the match — `use(legacy(1))` — and a concise callback whose body is the match —
 * `use(() => legacy(1))` — were not seen, with `call()` as with `expression()`.
 *
 * They now test the node itself too, unless it is a block: a block is searched below its root, as a
 * function's own body is. One test per call site, so a fix that misses one stays red. Within one call,
 * a root's match is numbered after the matches below it; a module-scope initializer, searched the same
 * way under `scopeToModule`, is tested itself too.
 */
function project(statement: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/calls.ts',
    [
      'declare function legacy(n: unknown): number',
      'declare function use(...v: unknown[]): void',
      'declare const process: { env: Record<string, string> }',
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

type Condition =
  | 'notHaveArgumentContaining'
  | 'notHaveCallbackContaining'
  | 'haveArgumentContaining'
  | 'haveCallbackContaining'

function findings(statement: string, condition: Condition, matcher: ExpressionMatcher): number {
  const should = calls(project(statement)).that().withMethod('use').should()
  return should[condition](matcher).rule({ id: 'test/0323' }).violations().length
}

function byMatcher(statement: string, condition: Condition): Record<string, number> {
  return Object.fromEntries(
    MATCHERS.map(([label, matcher]) => [label, findings(statement, condition, matcher)]),
  )
}

describe('bug 0323: the call conditions test the root they search', () => {
  it('notHaveArgumentContaining reports an argument that is the match', () => {
    expect(byMatcher('use(legacy(1));', 'notHaveArgumentContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
    // The control, one level down, is unchanged.
    expect(byMatcher('use(0 + legacy(1));', 'notHaveArgumentContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
    // Two calls are two findings under call(); one broad match is one finding, not the match and
    // the argument around it.
    expect(byMatcher('use(legacy(legacy(1)));', 'notHaveArgumentContaining')).toEqual({
      'call()': 2,
      'expression()': 1,
    })
  })

  it('notHaveCallbackContaining reports a concise callback whose body is the match', () => {
    expect(byMatcher('use(() => legacy(1));', 'notHaveCallbackContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
    // The control: the same call in a block body.
    expect(byMatcher('use(() => { return legacy(1) });', 'notHaveCallbackContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
    expect(byMatcher('use(() => legacy(legacy(1)));', 'notHaveCallbackContaining')).toEqual({
      'call()': 2,
      'expression()': 1,
    })
  })

  it('haveArgumentContaining passes an argument that is the match', () => {
    expect(byMatcher('use(legacy(1));', 'haveArgumentContaining')).toEqual({
      'call()': 0,
      'expression()': 0,
    })
    // The control: an argument without the call still fails.
    expect(byMatcher('use(1);', 'haveArgumentContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
  })

  it('haveCallbackContaining passes a concise callback whose body is the match', () => {
    expect(byMatcher('use(() => legacy(1));', 'haveCallbackContaining')).toEqual({
      'call()': 0,
      'expression()': 0,
    })
    // The control: a callback without the call still fails.
    expect(byMatcher('use(() => 1);', 'haveCallbackContaining')).toEqual({
      'call()': 1,
      'expression()': 1,
    })
  })

  it("a callback's block body is searched below its root, as a function's is", () => {
    // `{}` is the whole block. Testing the block itself would report every empty callback under a
    // pattern for braces — the over-match `searchFunctionBody` avoids for a function's own body.
    expect(findings('use(() => {});', 'notHaveCallbackContaining', expression(/\{\s*\}/))).toBe(0)
    // The control: an empty object argument inside a block body is found.
    expect(
      findings('use(() => { legacy({}) });', 'notHaveCallbackContaining', expression(/\{\s*\}/)),
    ).toBe(1)
    // The same boundary at the requirement's site, where reading more fails open: the block itself
    // does not satisfy the pattern, and neither does a parameter's default — the body is searched,
    // not the whole callback.
    expect(findings('use(() => {});', 'haveCallbackContaining', expression(/\{\s*\}/))).toBe(1)
    expect(findings('use((n = legacy(1)) => 1);', 'haveCallbackContaining', call('legacy'))).toBe(1)
  })

  it('a match at the root is numbered after the matches below it in the same call', () => {
    // 0.5.1 reported only the inner call, as #1. The outer call, newly reported, takes #2, and the
    // accepted #1 still names the inner call.
    const ordinals = (statement: string, condition: Condition): [number, string][] =>
      calls(project(statement))
        .that()
        .withMethod('use')
        .should()
        [condition](call('legacy'))
        .rule({ id: 'test/0323-order' })
        .violations()
        .map((v) => [Number(/at line (\d+)/.exec(v.message)?.[1]), (v.identity ?? '').slice(-2)])

    // Each finding names its match's line: line 4 holds the outer call, line 5 the inner one.
    expect(ordinals('use(legacy(\n  legacy(1)));', 'notHaveArgumentContaining')).toEqual([
      [5, '#1'],
      [4, '#2'],
    ])
    expect(ordinals('use(() => legacy(\n  legacy(1)));', 'notHaveCallbackContaining')).toEqual([
      [5, '#1'],
      [4, '#2'],
    ])
  })

  it('a module-scope initializer that is the match is found under scopeToModule', () => {
    const found = (statement: string, matcher: ExpressionMatcher): number =>
      modules(project(statement))
        .should()
        .notContain(matcher, { scopeToModule: true })
        .rule({ id: 'test/0323-module' })
        .violations().length

    expect(found('const x = legacy(1);', call('legacy'))).toBe(1)
    expect(found('const e = process.env;', access('process.env'))).toBe(1)
    // The control, one level down, is unchanged.
    expect(found('const x = 0 + legacy(1);', call('legacy'))).toBe(1)
  })
})
