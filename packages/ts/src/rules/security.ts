import { Node, SyntaxKind } from 'ts-morph'
import type { ClassDeclaration, SourceFile } from 'ts-morph'
import type { Condition } from '@nielspeter/eess'
import type { ArchFunction } from '../models/arch-function.js'
import { call, type ExpressionMatcher } from '../helpers/matchers.js'
import { classNotContain } from '../conditions/body-analysis.js'
import { functionNotContain } from '../conditions/body-analysis-function.js'
import { moduleNotContain } from '../conditions/body-analysis-module.js'
import { globalChainOf } from '../helpers/global-binding.js'

// ─── Reading a global however its name is spelled (bugs 0301, 0297, 0308) ──────
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
// which is bug 0305. A type assertion, `satisfies` and a non-null assertion are read through,
// and so is any number of leading global objects (`window.self.eval`) — bug 0308.

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
 * `this.x` reads as nothing, so a member of an instance is never a global. A type assertion
 * (`as`, `<T>`), `satisfies` and a non-null assertion (`!`) read as the expression they wrap:
 * none of them changes the value at run time (bug 0308).
 */
function chainOf(node: Node): string | undefined {
  if (Node.isIdentifier(node)) return node.getText()
  if (
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node) ||
    Node.isTypeAssertion(node)
  ) {
    return chainOf(node.getExpression())
  }
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

/**
 * The chain with its leading global objects removed: `globalThis.eval` and `window.self.eval`
 * both read as `eval` (bug 0308). Only leading names are dropped, so `settings.window.eval` is
 * not the global.
 */
function globalNameOf(node: Node): string | undefined {
  // Through the binding first (bug 0305), then the leading global objects (bug 0308): a name bound
  // to `globalThis.eval` has to lose the `globalThis.` after the binding is followed, not before.
  let chain = globalChainOf(node, chainOf)
  if (chain === undefined) return undefined
  let dot = chain.indexOf('.')
  while (dot > 0 && GLOBAL_OBJECTS.has(chain.slice(0, dot))) {
    chain = chain.slice(dot + 1)
    dot = chain.indexOf('.')
  }
  return chain
}

/**
 * A call to the global `name`. Described as `call()` describes it, so messages are unchanged; a
 * newly reported call earlier in a declaration still renumbers the matches after it.
 */
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

/**
 * Any member of the global `console`. Described as the `access()` it replaces, so messages are
 * unchanged; a newly reported read earlier in a declaration still renumbers the matches after it.
 */
function consoleAccess(): ExpressionMatcher {
  return {
    description: 'access matching /^console\\./',
    syntaxKinds: [
      SyntaxKind.PropertyAccessExpression,
      SyntaxKind.ElementAccessExpression,
      // A member destructured out of `console` is reached by a bare NAME — `const { log } =
      // console; log(1)` — so the identifier itself has to be asked (bug 0305).
      SyntaxKind.Identifier,
    ],
    matches: (node) => readsAName(node) && globalNameOf(node)?.startsWith('console.') === true,
  }
}

/**
 * A read of the global `process.env`. Described as the `access()` it replaces, so messages are
 * unchanged; a newly reported read earlier in a member still renumbers the matches after it.
 */
function processEnvAccess(): ExpressionMatcher {
  return {
    description: "access to 'process.env'",
    syntaxKinds: [
      SyntaxKind.PropertyAccessExpression,
      SyntaxKind.ElementAccessExpression,
      // `const { env } = process; env.B` and `import { env } from 'node:process'` reach the
      // environment through a bare name (bug 0305).
      SyntaxKind.Identifier,
    ],
    matches: (node) => readsAName(node) && globalNameOf(node) === 'process.env',
  }
}

/**
 * Whether a node reads a name, rather than writing one down (bug 0305).
 *
 * With `Identifier` in a matcher's kinds, every occurrence of a name is a candidate — including the
 * name being DECLARED (`const { log } = console`) and the property part of an access
 * (`console.log`, whose `log` is not the root of its own chain). Reading those would report a
 * finding at the declaration beside the one at the use, and report `console.log` twice.
 */
function readsAName(node: Node): boolean {
  if (!Node.isIdentifier(node)) return true
  const parent = node.getParent()
  if (parent === undefined) return false
  if (Node.isPropertyAccessExpression(parent)) return parent.getExpression() === node
  if (Node.isBindingElement(parent) || Node.isVariableDeclaration(parent)) {
    return parent.getNameNode() !== node
  }
  if (Node.isImportSpecifier(parent) || Node.isParameterDeclaration(parent)) return false
  // A shorthand property's name IS its value — `const o = { console }` reads the global, where
  // `{ console: x }` writes the key and reads `x`. It changes no verdict today, because these
  // matchers read a MEMBER access (`console.log`, `process.env`) and a bare `console` handed on as
  // a value is not one; it is here so the predicate answers its own question truthfully.
  if (Node.isShorthandPropertyAssignment(parent)) return true
  if (Node.isPropertyAssignment(parent)) return parent.getNameNode() !== node
  return true
}

/**
 * No eval() calls in any code a class runs — `eval(…)`, through a global object
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
 * No process.env read in any code a class runs, as `notContain()` on the class
 * builder defines it, spelled `process.env`, `process['env']`, or through a
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
 * No console.log calls in any code a class runs — including `console['log']` and through a
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
