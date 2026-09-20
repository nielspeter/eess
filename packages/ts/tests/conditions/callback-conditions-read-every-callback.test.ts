import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { calls } from '../../src/builders/call-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { within } from '../../src/builders/within.js'
import { call, expression } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0324 — `notHaveCallbackContaining` and `haveCallbackContaining` took an argument as a callback
 * only when it WAS an arrow function or a function expression. A handler in an options object —
 * `use({ handler: () => … })`, the shape the builder's own example is written for — a method
 * shorthand, and a callback behind parentheses were searched by nothing: the prohibition passed and
 * the requirement failed, both silently, while `notHaveArgumentContaining` reported all three.
 *
 * The cause was two definitions of "a callback": these conditions read an argument's body
 * themselves, and `within()` used `extractCallbacks`. There is now one — the conditions take
 * `extractCallbacks`, and it reads through the wrappers the function collector already reads a
 * variable's initializer through (bug 0315), so `within()` gains the parenthesized shape with them.
 *
 * Its limits are the shared definition's, and pinned below rather than left to be discovered: a
 * callback a NAME refers to is not resolved, and an object literal is searched three levels deep.
 */
function project(statement: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(
    '/src/calls.ts',
    [
      'declare function legacy(n: number): number',
      'declare function use(...v: unknown[]): void',
      'declare const handler: () => number',
      'type Fn = () => number',
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

const prohibited = (statement: string): number =>
  calls(project(statement))
    .that()
    .withMethod('use')
    .should()
    .notHaveCallbackContaining(call('legacy'))
    .rule({ id: 'test/0324-callback' })
    .violations().length

const requirementUnmet = (statement: string): number =>
  calls(project(statement))
    .that()
    .withMethod('use')
    .should()
    .haveCallbackContaining(call('legacy'))
    .rule({ id: 'test/0324-requires' })
    .violations().length

/** Whether `within()` — the other reader of the same definition — searches the callback. */
const withinReports = (statement: string): boolean =>
  within(calls(project(statement)).that().withMethod('use'))
    .functions()
    .should()
    .notContain(expression(/legacy/))
    .rule({ id: 'test/0324-within' })
    .violations()
    .some((v) => v.message.includes('contains expression'))

/** The shapes bug 0324 measured at 0 for the callback conditions, plus the direct one as control. */
const CALLBACK_SHAPES = [
  'use({ handler: () => legacy(1) });',
  'use({ handler() { return legacy(1) } });',
  'use((() => legacy(1)));',
  'use(((() => legacy(1)) as Fn));',
  'use({ opts: { handler: () => legacy(1) } });',
  'use(() => legacy(1));',
  'use(function () { return legacy(1) });',
] as const

describe('bug 0324: the callback conditions read every callback the call passes', () => {
  it('reports a callback in an options object, a method shorthand and one behind a wrapper', () => {
    expect(CALLBACK_SHAPES.map(prohibited)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('takes the same callbacks as satisfying a requirement', () => {
    // The mirror direction: `haveCallbackContaining` reported each of these as MISSING the call.
    expect(CALLBACK_SHAPES.map(requirementUnmet)).toEqual([0, 0, 0, 0, 0, 0, 0])
    // And it still reports a call whose callback really does not contain it.
    expect(requirementUnmet('use({ handler: () => 1 });')).toBe(1)
  })

  it('agrees with within(), which reads the same definition', () => {
    expect(CALLBACK_SHAPES.map(withinReports)).toEqual([true, true, true, true, true, true, true])
  })

  it('reports nothing for an argument that holds no callback', () => {
    // `use(legacy(1))` is an argument, not a callback — `notHaveArgumentContaining` owns it.
    expect(prohibited('use(legacy(1));')).toBe(0)
    expect(prohibited('use({ value: legacy(1) });')).toBe(0)
  })

  it('still does not resolve a callback a name refers to, or one nested deeper than three levels', () => {
    // The limits of the one shared definition, named rather than discovered: a reference is not
    // resolved (it needs the type checker), and `collectObjectLiteralFunctions` stops at three
    // object literals. Both are silent passes, and `within()` reports the same nothing.
    expect(prohibited('use(handler);')).toBe(0)
    expect(prohibited('use({ a: { b: { c: { handler: () => legacy(1) } } } });')).toBe(0)
    expect(withinReports('use({ a: { b: { c: { handler: () => legacy(1) } } } });')).toBe(false)
  })

  it('numbers a newly read callback after the one read before it', () => {
    // 0.6.1 read the direct callback on the SECOND argument and reported it as #1. The callback in
    // the first argument's options object is newly read, so it takes #2 and the accepted identity
    // still names the same match.
    const ordinals = calls(project('use({ handler: () => legacy(1) },\n  () => legacy(2));'))
      .that()
      .withMethod('use')
      .should()
      .notHaveCallbackContaining(call('legacy'))
      .rule({ id: 'test/0324-order' })
      .violations()
      .map((v) => [Number(/at line (\d+)/.exec(v.message)?.[1]), (v.identity ?? '').slice(-2)])

    // Line 5 holds the options object, line 6 the direct callback.
    expect(ordinals).toEqual([
      [6, '#1'],
      [5, '#2'],
    ])
  })

  it('reads a callback in an object literal for functions() too, unchanged', () => {
    // The object-literal collection is opt-in and untouched by this fix; the guard is that the
    // shared traversal still names a property callback by its key.
    const named = functions(project('const api = { handler: () => legacy(1) };'), {
      includeObjectLiteralFunctions: true,
    })
      .should()
      .notContain(call('legacy'))
      .rule({ id: 'test/0324-functions' })
      .violations()
    expect(named.map((v) => v.element)).toEqual(['api.handler'])
  })
})
