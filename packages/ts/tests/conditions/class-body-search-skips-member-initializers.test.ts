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
 * What it still does not walk, on purpose, is anything that is not member code: a
 * decorator's arguments and a member's docstring. The CONTROL pins both, so a fix that
 * simply searched the whole class node — which would start reporting comments in
 * docstrings under a `comment()` rule — cannot pass as this one.
 *
 * Every read is spelled `process.env.X`, so this is not bug 0297. Expectations are exact
 * sets of the lines the messages name.
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

const EVALUATOR = [
  'export class Evaluator {', // 1
  "  field = eval('1')", // 2
  "  method() { return eval('2') }", // 3
  '}', // 4
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

function linesNamedIn(result: readonly { message: string }[]): Set<string> {
  return new Set(result.map((v) => /at line (\d+)/.exec(v.message)?.[1] ?? '?'))
}

describe('bug 0300: class-body search walks the code every member runs', () => {
  it('noProcessEnv on a class reads field initializers, static fields, parameter defaults, static blocks and arrow properties', () => {
    const result = classes(project('/src/service.ts', SERVICE))
      .should()
      .satisfy(noProcessEnv())
      .rule({ id: 'test/0300-positions' })
      .violations()

    // Every member's code: 2, 3, 4, 6, 8, 9, 10 and 11. Not the decorator argument on 12.
    expect(linesNamedIn(result)).toEqual(new Set(['2', '3', '4', '6', '8', '9', '10', '11']))
  })

  it('noEval on a class reads eval in a field initializer', () => {
    const result = classes(project('/src/evaluator.ts', EVALUATOR))
      .should()
      .satisfy(noEval())
      .rule({ id: 'test/0300-eval-field' })
      .violations()

    expect(linesNamedIn(result)).toEqual(new Set(['2', '3']))
  })

  it('classContain counts a call in a field initializer as the class containing it', () => {
    const result = classes(project('/src/registry.ts', REGISTRY))
      .should()
      .satisfy(classContain(call('register')))
      .rule({ id: 'test/0300-contain' })
      .violations()

    expect(new Set(result.map((v) => v.element))).toEqual(new Set(['Untracked']))
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

    expect(result.map((v) => /at line (\d+)/.exec(v.message)?.[1])).toEqual(['2'])
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

    expect(result.map((v) => /at line (\d+)/.exec(v.message)?.[1])).toEqual(['3'])
  })

  it('CONTROL — a docstring is not member code, so a comment rule still reads only the body', () => {
    const result = classes(project('/src/documented.ts', DOCUMENTED))
      .should()
      .satisfy(classNotContain(comment(/TODO/)))
      .rule({ id: 'test/0300-docstring' })
      .violations()

    expect(linesNamedIn(result)).toEqual(new Set(['4']))
  })
})
