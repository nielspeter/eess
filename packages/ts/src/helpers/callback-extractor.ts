import { type CallExpression, Node, SyntaxKind } from 'ts-morph'
import type { ArchFunction } from '../models/arch-function.js'
import { fromObjectLiteralFunction, fromCallableNode } from '../models/arch-function.js'
import { throughWrappers, isValueWrapper } from '../core/through-wrappers.js'
import { collectObjectLiteralFunctions } from '../core/object-literal-functions.js'

/**
 * Represents a callback function extracted from a call expression argument.
 * Wraps the arrow function or function expression as an ArchFunction.
 */
export interface ExtractedCallback {
  /** The ArchFunction wrapping the callback. */
  fn: ArchFunction
  /** The call expression this callback was extracted from. */
  callSite: CallExpression
  /** Argument index within the call expression (0-based). */
  argIndex: number
}

/**
 * Extract all inline function arguments from a call expression.
 *
 * Handles:
 * - Arrow functions: `app.get('/path', (req, res) => { ... })`
 * - Function expressions: `app.get('/path', function(req, res) { ... })`
 * - Either behind parentheses, `as`, `<T>`, `satisfies` or `!` (bug 0324)
 * - Function-valued properties and method shorthands of an object-literal argument, to three
 *   levels: `use({ handler: () => ... })`
 *
 * Does NOT resolve named references (e.g., `app.get('/path', myHandler)`).
 * Reference resolution requires type-checker lookups and is deferred. A callback held by a
 * variable, and one nested deeper than three object literals, are not found either — the
 * limits of this one definition, shared by `within()` and the callback conditions (bug 0324).
 *
 * @returns Array of extracted callbacks with their source metadata
 */
export function extractCallbacks(callExpr: CallExpression): ExtractedCallback[] {
  const unwrapped: ExtractedCallback[] = []
  const behindAWrapper: ExtractedCallback[] = []
  const args = callExpr.getArguments()

  for (let i = 0; i < args.length; i++) {
    const raw = args[i]
    if (!raw) continue
    // Read through parentheses, `as`, `<T>`, `satisfies` and `!` (bug 0324): `use((() => …))`
    // passes the same callback as `use(() => …)`, and the wrappers are the ones the function
    // collector already reads a variable's initializer through (bug 0315).
    const arg = throughWrappers(raw)
    if (!arg) continue
    const fn = extractInlineFunction(arg, callExpr, i)
    const found = fn ? [fn] : extractFromObjectLiteral(arg, callExpr, i)
    // A callback reached THROUGH a wrapper — the argument's, or a property value's — is one this
    // function could not reach before bug 0324, so it goes LAST. A match's identity is numbered in
    // order across the subjects of one rule, and `within()` walks this list: numbered in place, a
    // newly reachable callback ahead of an accepted one takes its ordinal, which both hides the new
    // finding and re-reports the accepted one. Measured in the enforcement review of 0324 on
    // `use((() => legacy(1)), () => legacy(2))`, and again on
    // `use({ handler: (() => legacy(1)) }, () => legacy(2))` — the second is why this asks about
    // the PATH to the callback and not about the argument alone, which was the first answer.
    for (const callback of found) {
      const wrapped = reachedThroughAWrapper(callback.fn.getNode(), raw)
      ;(wrapped ? behindAWrapper : unwrapped).push(callback)
    }
  }

  return [...unwrapped, ...behindAWrapper]
}

/**
 * Whether the path from an argument down to a callback passes through a value wrapper — the
 * argument itself being one included. That is exactly "this callback is newly reachable since bug
 * 0324", which decides where it is ordered (see {@link extractCallbacks}).
 */
function reachedThroughAWrapper(callback: Node, argument: Node): boolean {
  let current: Node | undefined = callback
  while (current !== undefined) {
    if (isValueWrapper(current)) return true
    if (current === argument) return false
    current = current.getParent()
  }
  return false
}

/**
 * Extract function-valued properties from an object-literal argument as
 * callbacks, using the shared object-literal traversal (F3). Handles arrows,
 * function expressions, method shorthand, and nested object literals
 * (depth-limited). F3 supplies the traversal AND, since plan 0082, the naming:
 * `keyPath` reaches `fromObjectLiteralFunction`, so a property callback carries its
 * property name. (This said "names stay context-derived, arrows anonymous, exactly
 * as before" for one release after that stopped being true — directly contradicted
 * by the code six lines below it.) **Positional** callbacks are still anonymous and
 * identified by `argIndex`.
 */
function extractFromObjectLiteral(
  arg: Node,
  callSite: CallExpression,
  argIndex: number,
): ExtractedCallback[] {
  // `olf.keyPath` used to be dropped here, one line from where it is produced —
  // [ts-archunit plan 0082](https://github.com/nielspeter/ts-archunit/blob/main/plans/completed/0082-an-object-literal-callback-keeps-its-name.md).
  // `callbackArchFunction` routes an arrow to `fromArrowExpression`, which hardcodes
  // `getName: () => undefined`, so both callbacks on `{ preHandler, handler }` came
  // back anonymous AND shared an `argIndex` (the object's). Nothing in the shape
  // told them apart, so a rule about the `handler` callback was writable and
  // selected nothing — expressible, plausible, and empty.
  //
  // `fromObjectLiteralFunction` already existed, already exported, already
  // computing the name from exactly this `keyPath`. The gap was one call.
  return collectObjectLiteralFunctions(arg).map((olf) => ({
    // Falls back rather than dropping: `fromObjectLiteralFunction` returns
    // `undefined` for a node shape it does not recognise, and filtering those out
    // would turn an unnamed callback into a MISSING one — a silent under-report,
    // which is worse than the anonymity this change removes.
    //
    // **Unreachable today, and recorded rather than claimed load-bearing.**
    // `collectObjectLiteralFunctions` emits only arrows, function expressions and
    // method declarations — exactly the three kinds `fromObjectLiteralFunction`
    // accepts — so no runtime test covers this branch and none can while the
    // collector stays closed over those kinds. What guards it is the type: removing
    // the `??` is a compile error (TS2322), and CI runs `typecheck` before `test`.
    fn: fromObjectLiteralFunction(olf.node, olf.keyPath) ?? callbackArchFunction(olf.node),
    callSite,
    argIndex,
  }))
}

/** Wrap an object-literal function node as an ArchFunction for the callback path. */
function callbackArchFunction(node: Node): ArchFunction {
  if (Node.isArrowFunction(node)) return fromArrowExpression(node)
  if (Node.isFunctionExpression(node)) return fromFunctionExpression(node)
  return fromMethodDeclaration(node)
}

/**
 * Try to extract an ArchFunction from a single argument node.
 */
function extractInlineFunction(
  arg: Node,
  callSite: CallExpression,
  argIndex: number,
): ExtractedCallback | null {
  // Arrow function: (req, res) => { ... }
  if (arg.getKind() === SyntaxKind.ArrowFunction) {
    return {
      fn: fromArrowExpression(arg),
      callSite,
      argIndex,
    }
  }

  // Function expression: function(req, res) { ... }
  if (arg.getKind() === SyntaxKind.FunctionExpression) {
    return {
      fn: fromFunctionExpression(arg),
      callSite,
      argIndex,
    }
  }

  return null
}

/**
 * Wrap an arrow function argument as an ArchFunction.
 * Unlike fromArrowVariableDeclaration (plan 0009), this has no variable name.
 * The name is synthesized from the call site context.
 */
function fromArrowExpression(node: Node): ArchFunction {
  // Anonymous — the name is derived from the call site by the caller.
  return fromCallableNode(node.asKindOrThrow(SyntaxKind.ArrowFunction), () => undefined)
}

/**
 * Wrap a function expression argument as an ArchFunction.
 */
function fromFunctionExpression(node: Node): ArchFunction {
  const funcExpr = node.asKindOrThrow(SyntaxKind.FunctionExpression)
  // May name itself: `function handler() {}` passed as an argument.
  return fromCallableNode(funcExpr, () => funcExpr.getName())
}

/**
 * Wrap an object literal method declaration as an ArchFunction.
 * Handles: `{ handler(req, res) { ... } }`
 */
function fromMethodDeclaration(node: Node): ArchFunction {
  const method = node.asKindOrThrow(SyntaxKind.MethodDeclaration)
  return fromCallableNode(method, () => method.getName())
}
