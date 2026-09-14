import { Node, SyntaxKind } from 'ts-morph'
import type { ClassDeclaration, SourceFile } from 'ts-morph'
import type { Condition } from '@nielspeter/eess'
import type { ArchFunction } from '../models/arch-function.js'
import { call, type ExpressionMatcher } from '../helpers/matchers.js'
import { classNotContain } from '../conditions/body-analysis.js'
import { functionNotContain } from '../conditions/body-analysis-function.js'
import { moduleNotContain } from '../conditions/body-analysis-module.js'

// ─── Reading a global however its name is spelled (bugs 0301, 0297) ──────
//
// `call('eval')` compared the callee's text, so `globalThis.eval(…)`, `(0, eval)(…)`
// and `Function(…)` without `new` passed rules — and a `recommended` floor — written
// to catch exactly those; `access('process.env')` did the same to `process['env']` and
// `globalThis.process.env`. These matchers read the name structurally instead. They are
// private to this module on purpose: the public `call()` and `access()` promise a text
// match, and adopters' own rules depend on that.
//
// They read names, not bindings, so a local binding misleads them both ways: a global
// first bound to a local name (`const ev = eval`, `const { log } = console`,
// `const { env } = process`, an `env` imported from `node:process`) is missed,
// and a local declaration that shadows a global (`function Function() {}`,
// `const console = {…}`) is reported as the global. Both need the binding followed,
// which is bug 0305. Only one leading global object is read through, so a doubled chain
// (`window.self.eval`) is not seen.

/** The names a global is reachable through: standard, browser, worker and Node. */
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(['globalThis', 'window', 'self', 'global'])

/** `x['y']` reads as `x.y` when the key is a literal; a computed key reads as nothing. */
function elementChainOf(node: Node): string | undefined {
  if (!Node.isElementAccessExpression(node)) return undefined
  const key = node.getArgumentExpression()
  const base = chainOf(node.getExpression())
  if (base === undefined) return undefined
  if (Node.isStringLiteral(key) || Node.isNoSubstitutionTemplateLiteral(key)) {
    return `${base}.${key.getLiteralValue()}`
  }
  return undefined
}

/**
 * The dotted name an expression reads, or `undefined` when it is not a plain name
 * chain. `x?.y` reads as `x.y`, and `(0, x)` — the indirect-call idiom — as `x`.
 * `this.x` reads as nothing, so a member of an instance is never a global.
 */
function chainOf(node: Node): string | undefined {
  if (Node.isIdentifier(node)) return node.getText()
  if (Node.isParenthesizedExpression(node)) {
    const inner = node.getExpression()
    const isComma =
      Node.isBinaryExpression(inner) && inner.getOperatorToken().getKind() === SyntaxKind.CommaToken
    return chainOf(isComma ? inner.getRight() : inner)
  }
  if (Node.isPropertyAccessExpression(node)) {
    const base = chainOf(node.getExpression())
    return base === undefined ? undefined : `${base}.${node.getName()}`
  }
  return elementChainOf(node)
}

/** The chain with a leading global object removed: `globalThis.eval` reads as `eval`. */
function globalNameOf(node: Node): string | undefined {
  const chain = chainOf(node)
  if (chain === undefined) return undefined
  const dot = chain.indexOf('.')
  return dot > 0 && GLOBAL_OBJECTS.has(chain.slice(0, dot)) ? chain.slice(dot + 1) : chain
}

/** A call to the global `name`. Described as `call()` describes it, so messages and baselines are unchanged. */
function globalCall(name: string): ExpressionMatcher {
  return {
    description: `call to '${name}'`,
    syntaxKinds: [SyntaxKind.CallExpression],
    matches: (node) => Node.isCallExpression(node) && globalNameOf(node.getExpression()) === name,
  }
}

/** The global `Function`, called or constructed — `Function(…)` is `new Function(…)`. */
function functionConstructor(): ExpressionMatcher {
  return {
    description: 'Function constructor',
    syntaxKinds: [SyntaxKind.NewExpression, SyntaxKind.CallExpression],
    matches: (node) =>
      (Node.isNewExpression(node) || Node.isCallExpression(node)) &&
      globalNameOf(node.getExpression()) === 'Function',
  }
}

/** Any member of the global `console`. Described as the `access()` it replaces, so baselines are unchanged. */
function consoleAccess(): ExpressionMatcher {
  return {
    description: 'access matching /^console\\./',
    syntaxKinds: [SyntaxKind.PropertyAccessExpression, SyntaxKind.ElementAccessExpression],
    matches: (node) => globalNameOf(node)?.startsWith('console.') === true,
  }
}

/** A read of the global `process.env`. Described as the `access()` it replaces, so messages and baselines are unchanged. */
function processEnvAccess(): ExpressionMatcher {
  return {
    description: "access to 'process.env'",
    syntaxKinds: [SyntaxKind.PropertyAccessExpression, SyntaxKind.ElementAccessExpression],
    matches: (node) => globalNameOf(node) === 'process.env',
  }
}

/**
 * No eval() calls in a class's member code — `eval(…)`, through a global object
 * (`globalThis`, `window`, `self`, `global`), a string-keyed bracket, or the indirect
 * `(0, eval)(…)`. An `eval` bound to a local name first is not seen (bug 0305).
 *
 * @example
 * classes(p).should().satisfy(noEval()).check()
 */
export function noEval(): Condition<ClassDeclaration> {
  return classNotContain(globalCall('eval'))
}

/**
 * No Function constructor (equivalent to eval) — called with or without `new`, and
 * through a global object.
 *
 * @example
 * classes(p).should().satisfy(noFunctionConstructor()).check()
 */
export function noFunctionConstructor(): Condition<ClassDeclaration> {
  return classNotContain(functionConstructor())
}

/**
 * No process.env read in a class's member code — bodies, parameter defaults, property
 * initializers and static blocks — spelled `process.env`, `process['env']`, or through a
 * global object. An `env` destructured from `process` or imported from `node:process` is
 * not seen (bug 0305); `import.meta.env` is not Node's environment and is not reported.
 *
 * Use dependency injection for configuration instead.
 *
 * @example
 * classes(p).that().resideInFolder('** /domain/** ')
 *   .should().satisfy(noProcessEnv())
 *   .because('use Config injection instead')
 *   .check()
 */
export function noProcessEnv(): Condition<ClassDeclaration> {
  return classNotContain(processEnvAccess())
}

/**
 * No console.log calls in a class's member code — including `console['log']` and through a
 * global object.
 *
 * Use a logger abstraction instead.
 *
 * @example
 * classes(p).that().resideInFolder('** /src/** ')
 *   .should().satisfy(noConsoleLog())
 *   .check()
 */
export function noConsoleLog(): Condition<ClassDeclaration> {
  return classNotContain(globalCall('console.log'))
}

/**
 * No direct console access (any method: log, warn, error, debug, info), including
 * bracketed and global-object spellings.
 * Stricter than noConsoleLog — catches all console methods.
 */
export function noConsole(): Condition<ClassDeclaration> {
  return classNotContain(consoleAccess())
}

/**
 * No JSON.parse calls — centralize deserialization.
 */
export function noJsonParse(): Condition<ClassDeclaration> {
  return classNotContain(call('JSON.parse'))
}

// ─── Function variants ────────────────────────────────────────────

export function functionNoEval(): Condition<ArchFunction> {
  return functionNotContain(globalCall('eval'))
}

export function functionNoFunctionConstructor(): Condition<ArchFunction> {
  return functionNotContain(functionConstructor())
}

export function functionNoProcessEnv(): Condition<ArchFunction> {
  return functionNotContain(processEnvAccess())
}

export function functionNoConsoleLog(): Condition<ArchFunction> {
  return functionNotContain(globalCall('console.log'))
}

export function functionNoConsole(): Condition<ArchFunction> {
  return functionNotContain(consoleAccess())
}

export function functionNoJsonParse(): Condition<ArchFunction> {
  return functionNotContain(call('JSON.parse'))
}

// ─── Module variants ──────────────────────────────────────────────

export function moduleNoEval(): Condition<SourceFile> {
  return moduleNotContain(globalCall('eval'))
}

export function moduleNoProcessEnv(): Condition<SourceFile> {
  return moduleNotContain(processEnvAccess())
}

export function moduleNoConsoleLog(): Condition<SourceFile> {
  return moduleNotContain(globalCall('console.log'))
}
