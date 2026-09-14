import { describe, it, expect } from 'vitest'
import { Project, SyntaxKind } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { noProcessEnv, noEval } from '../../src/rules/security.js'
import { classContain, classNotContain } from '../../src/conditions/body-analysis.js'
import { call, comment, expression } from '../../src/helpers/matchers.js'
import type { ExpressionMatcher } from '../../src/helpers/matchers.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0300 — `searchClassBody` walked method bodies, the last constructor's body and
 * accessors, and nothing else, so every class-level body rule missed code in a field
 * initializer, a static field, a parameter default, a static block and an arrow property.
 * It now walks the code each member runs: bodies, every parameter's default, property
 * initializers and static blocks.
 *
 * What it does not walk is anything outside a member's code. A member's docstring is pinned
 * by the CONTROL, so a fix that searched the whole class node — and started reporting
 * comments in docstrings under a `comment()` rule — cannot pass as this one. A decorator's
 * arguments are read since bug 0307, and the `noProcessEnv` test expects the one on line 12.
 *
 * Every read is spelled `process.env.X`, so this is not bug 0297. Expectations are the
 * lines the messages name, sorted, so a duplicated finding shows.
 */
const SERVICE = [
  'export class Service {', // 1
  '  field = process.env.FIELD', // 2
  '  static stat = process.env.STATIC', // 3
  '  constructor(private host = process.env.PARAM) {}', // 4
  '  static {', // 5
  '    void process.env.BLOCK', // 6
  '  }', // 7
  '  arrow = () => process.env.ARROW', // 8
  '  get getter() { return process.env.GETTER }', // 9
  '  method() { return process.env.METHOD }', // 10
  '  withDefault(x = process.env.METHOD_PARAM) { return x }', // 11
  '  @Inject(process.env.DECORATOR) injected = 1', // 12
  '}', // 13
  '',
].join('\n')

// Lines 2 and 4 are an initializer and a default that ARE the call; line 3 is a body.
const EVALUATOR = [
  'export class Evaluator {', // 1
  "  field = eval('1')", // 2
  "  method() { return eval('2') }", // 3
  "  withDefault(x = eval('3')) { return x }", // 4
  '}', // 5
  '',
].join('\n')

const DOCUMENTED = [
  'export class Documented {', // 1
  '  /** TODO: document the edge case */', // 2
  '  method() {', // 3
  '    // TODO: inside the body', // 4
  '    return 1', // 5
  '  }', // 6
  '}', // 7
  '',
].join('\n')

const REGISTRY = [
  "export class Tracked { tracker = register('tracked') }",
  'export class Untracked { value = 1 }',
  '',
].join('\n')

function project(path: string, text: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(path, text)
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

describe('bug 0300: class-body search walks the code every member runs', () => {
  it('noProcessEnv on a class reads field initializers, static fields, parameter defaults, static blocks and arrow properties', () => {
    const result = classes(project('/src/service.ts', SERVICE))
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0300-positions' })
      .violations()

    // Every member's code: 2, 3, 4, 6, 8, 9, 10 and 11, and the decorator argument on 12 (bug 0307).
    expect(linesNamedIn(result)).toEqual(['2', '3', '4', '6', '8', '9', '10', '11', '12'])
  })

  it('noEval on a class reads eval in a field initializer', () => {
    const result = classes(project('/src/evaluator.ts', EVALUATOR))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0300-eval-field' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['2', '3', '4'])
  })

  it('classContain counts a call in a field initializer as the class containing it', () => {
    const result = classes(project('/src/registry.ts', REGISTRY))
      .should()
      .satisfy(classContain(call('register')))
      .rule({ id: 'test/0300-contain' })
      .violations()

    expect(result.map((v) => v.element)).toEqual(['Untracked'])
  })

  it('a match in a parameter default is numbered after the body match of the same member', () => {
    // A baseline identity is numbered within the enclosing member, which a member's body and
    // defaults share. The body's match keeps #1, the ordinal the walk before bug 0300 gave it,
    // so a baseline that accepted it still accepts it, and the new match in the default is #2.
    const source = [
      'export class Ordered {', // 1
      "  m(x = eval('a')) {", // 2
      "    return eval('b')", // 3
      '  }', // 4
      '}', // 5
      '',
    ].join('\n')
    const result = classes(project('/src/ordered.ts', source))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0300-ordinals' })
      .violations()

    const byLine = new Map(result.map((v) => [lineOf(v), v.identity ?? '']))
    expect([...byLine.keys()].sort()).toEqual(['2', '3'])
    const scope = (identity: string): string => identity.replace(/#\d+$/, '')
    expect(scope(byLine.get('2') ?? '')).toBe(scope(byLine.get('3') ?? ''))
    expect(byLine.get('3')?.endsWith('#1')).toBe(true)
    expect(byLine.get('2')?.endsWith('#2')).toBe(true)
  })

  it('a broad matcher reports an initializer once, at its deepest match', () => {
    // `expression()` matches at every ancestor level and keeps only the deepest. The
    // initializer `eval('1')` matches as a whole AND through the identifier `eval` inside it,
    // so it must be reported once — at the identifier — not twice.
    const result = classes(
      project('/src/broad.ts', ['export class Broad {', "  field = eval('1')", '}', ''].join('\n')),
    )
      .should()
      .satisfy(classNotContain(expression(/eval/)))
      .rule({ id: 'test/0300-broad' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['2'])
  })

  it('a trivia matcher that narrows by kind reports a comment on an initializer once', () => {
    // A trivia matcher's own walk already includes the root, so the root is not added again.
    // `comment()` does not narrow by kind; a custom matcher may, and would be reported twice.
    // The comment sits on its own line: on the line of `=` it is that token's trailing trivia,
    // not the literal's leading trivia, and nothing would match at all.
    const todoOnLiteral: ExpressionMatcher = {
      description: 'TODO on a numeric literal',
      syntaxKinds: [SyntaxKind.NumericLiteral],
      matches: (node) => node.getLeadingCommentRanges().some((r) => r.getText().includes('TODO')),
      matchedTriviaPositions: (node) =>
        node
          .getLeadingCommentRanges()
          .filter((r) => r.getText().includes('TODO'))
          .map((r) => r.getPos()),
    }
    const result = classes(
      project(
        '/src/trivia.ts',
        ['export class Trivia {', '  field =', '    // TODO: a real value', '    1', '}', ''].join(
          '\n',
        ),
      ),
    )
      .should()
      .satisfy(classNotContain(todoOnLiteral))
      .rule({ id: 'test/0300-trivia' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['3'])
  })

  it('a matcher that narrows by kind is asked only about an initializer of that kind', () => {
    // A by-kind walk only ever hands a matcher nodes of its kinds, and a matcher may rely on it.
    // This one answers yes to anything, so asking it about the literal `1` would report it.
    const anyCall: ExpressionMatcher = {
      description: 'any call, trusting its kind',
      syntaxKinds: [SyntaxKind.CallExpression],
      matches: () => true,
    }
    const result = classes(
      project('/src/plain.ts', ['export class Plain {', '  field = 1', '}', ''].join('\n')),
    )
      .should()
      .satisfy(classNotContain(anyCall))
      .rule({ id: 'test/0300-kind' })
      .violations()

    expect(linesNamedIn(result)).toEqual([])
  })

  it('CONTROL — a docstring is not member code, so a comment rule still reads only the body', () => {
    const result = classes(project('/src/documented.ts', DOCUMENTED))
      .should()
      .satisfy(classNotContain(comment(/TODO/)))
      .rule({ id: 'test/0300-docstring' })
      .violations()

    expect(linesNamedIn(result)).toEqual(['4'])
  })
})
