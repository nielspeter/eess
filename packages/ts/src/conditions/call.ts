import { ArchConfigError } from '@nielspeter/eess'
import { Node } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import type { ArchCall } from '../models/arch-call.js'
import { findMatchesInCode, findMatchesInEach, reportedLine } from '../helpers/body-traversal.js'
import { extractCallbacks } from '../helpers/callback-extractor.js'
import { identifyMatches } from './match-identity.js'
import { marksAssertsCardinality } from '@nielspeter/eess/internal'

/**
 * Helper to create a violation from an ArchCall.
 *
 * The `element` field uses the argument-enriched name when
 * `context.identifyByArgument` is set, but **never** elides — exclusion
 * patterns key on the element string, so stability is required.
 */
function createCallViolation(
  archCall: ArchCall,
  message: string,
  context: ConditionContext,
): ArchViolation {
  return {
    rule: context.rule,
    element: archCall.getName({ withArgument: context.identifyByArgument }) ?? '<call>',
    file: archCall.getSourceFile().getFilePath(),
    line: archCall.getStartLineNumber(),
    message,
    because: context.because,
  }
}

/**
 * The call's identity name — the same value `createCallViolation` puts in
 * `element`, without the message-only elision. Buckets matches per call, so
 * adding a second registration nearby does not renumber the first one's.
 */
function identityNameOf(archCall: ArchCall, context: ConditionContext): string {
  return archCall.getName({ withArgument: context.identifyByArgument }) ?? '<call>'
}

/**
 * Resolve the name for use in a violation MESSAGE (elision enabled).
 *
 * If `context.identifyByArgument` is set and the indexed argument's
 * `getText()` exceeds 80 characters, the literal portion is elided
 * (`slice(0, 38) + '…' + slice(-38)`) so CI output stays scannable.
 * The element field NEVER elides — see {@link createCallViolation}.
 */
function callNameForMessage(archCall: ArchCall, context: ConditionContext): string {
  return archCall.getName({ withArgument: context.identifyByArgument, elide: true }) ?? '<call>'
}

/**
 * The filtered call set must be empty --- no calls should match the predicates.
 */
export function notExist(): Condition<ArchCall> {
  // Satisfied by an EMPTY selection — registered rather than tagged, because a
  // symbol keyed on this object is readable off it and forgeable (bug 0050).
  return marksAssertsCardinality({
    description: 'not exist',
    // Zero subjects is this condition's PASSING state, so an empty selection
    // and an unsatisfiable selector glob are both correct here (plan 0074).
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      return elements.map((archCall) =>
        createCallViolation(
          archCall,
          `${callNameForMessage(archCall, context)} should not exist`,
          context,
        ),
      )
    },
  })
}

/**
 * Assert that at least one callback argument contains a match.
 *
 * Searches every callback the call passes — see {@link callbackBodies} — for a node matching the
 * given ExpressionMatcher.
 */
export function haveCallbackContaining(matcher: ExpressionMatcher): Condition<ArchCall> {
  return {
    description: `have callback containing ${matcher.description}`,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        const found = searchCallbacksFor(archCall, matcher)
        if (!found) {
          violations.push(
            createCallViolation(
              archCall,
              `${callNameForMessage(archCall, context)} does not have a callback containing ${matcher.description}`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * Assert that NO callback argument contains a match.
 *
 * Produces one violation per matching node found in any callback — see {@link callbackBodies} for
 * which arguments hold one.
 */
export function notHaveCallbackContaining(matcher: ExpressionMatcher): Condition<ArchCall> {
  return {
    description: `not have callback containing ${matcher.description}`,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        // Hoist the enriched name once per archCall — the inner match loop
        // produces multiple violations against the same call, and the
        // literal-shape walk inside getName({...}) is identical for each.
        const callName = callNameForMessage(archCall, context)
        // Flatten across arguments before assigning identities: a per-argument
        // counter would restart at 1 for each callback, so two callbacks with a
        // match in the same enclosing declaration would collide.
        const matches = findMatchesInEach(callbackBodies(archCall), matcher)
        const identities = identifyMatches(
          'call-callback',
          archCall.getSourceFile().getFilePath(),
          matches.map((m) => m.node),
          `${identityNameOf(archCall, context)} :: ${matcher.description}`,
        )
        matches.forEach((match, index) => {
          violations.push({
            ...createCallViolation(
              archCall,
              `${callName} has callback containing ${matcher.description} at line ${String(reportedLine(match.node, match.triviaPos))}`,
              context,
            ),
            identity: identities[index],
          })
        })
      }
      return violations
    },
  }
}

/**
 * The bodies the callback conditions search: every callback the call passes, as `extractCallbacks`
 * reads them — the definition `within()` already used (bug 0324).
 *
 * Before this fix these conditions had their own, narrower one: an argument that IS an arrow
 * function or a function expression. A handler in an options object — `use({ handler: () => … })`,
 * the shape the builder's own example is written for — and one behind parentheses were searched by
 * nothing, so `notHaveCallbackContaining` passed over them while `notHaveArgumentContaining`
 * reported them. Two places deciding what a callback is, is the bug; there is now one.
 *
 * **The callbacks read before this fix come first.** A match's identity is numbered within its
 * enclosing declaration, so a newly reachable callback on an earlier argument would otherwise take
 * the ordinal a baseline accepted on a later one — the same ordering `findMatchesInEach` keeps for
 * the roots bug 0323 made it test, and `searchClassBody` for the code bugs 0300, 0307 and 0309
 * made it read.
 */
function callbackBodies(archCall: ArchCall): Node[] {
  const args = archCall.getArguments()
  const callbacks = extractCallbacks(archCall.getNode())
  // A callback that IS the argument is what these conditions searched at 0.6.1, when they read an
  // argument's body themselves.
  const wasRead = (fn: Node): boolean => args.some((arg) => arg === fn)
  const ordered = [
    ...callbacks.filter((cb) => wasRead(cb.fn.getNode())),
    ...callbacks.filter((cb) => !wasRead(cb.fn.getNode())),
  ]
  return ordered.flatMap((cb) => {
    const body = cb.fn.getBody()
    return body ? [body] : []
  })
}

/**
 * Search all callback arguments of a call for a matcher hit.
 */
function searchCallbacksFor(archCall: ArchCall, matcher: ExpressionMatcher): boolean {
  for (const body of callbackBodies(archCall)) {
    if (findMatchesInCode(body, matcher).length > 0) return true
  }
  return false
}

/**
 * Collect property names from an ObjectLiteralExpression node.
 *
 * Handles both PropertyAssignment (`{ schema: {} }`) and
 * ShorthandPropertyAssignment (`{ schema }`).
 */
function getObjectLiteralPropertyNames(node: Node): Set<string> {
  const names = new Set<string>()
  if (!Node.isObjectLiteralExpression(node)) return names
  for (const prop of node.getProperties()) {
    if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
      names.add(prop.getName())
    }
  }
  return names
}

/**
 * Assert that at least one object literal argument has ALL named properties.
 *
 * Scans all arguments of each call for ObjectLiteralExpression nodes.
 * Passes if at least one object literal argument contains every
 * specified property name.
 *
 * @throws {Error} if called with zero property names
 */
export function haveArgumentWithProperty(...names: string[]): Condition<ArchCall> {
  if (names.length === 0) {
    throw new ArchConfigError(
      'haveArgumentWithProperty',
      'haveArgumentWithProperty requires at least one property name',
    )
  }
  const quotedNames = names.map((n) => `"${n}"`).join(', ')
  const description =
    names.length === 1
      ? `have argument with property "${names[0] ?? ''}"`
      : `have argument with properties ${quotedNames}`

  return {
    description,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        const args = archCall.getArguments()
        let found = false
        for (const arg of args) {
          const propNames = getObjectLiteralPropertyNames(arg)
          if (propNames.size > 0 && names.every((name) => propNames.has(name))) {
            found = true
            break
          }
        }
        if (!found) {
          const callName = callNameForMessage(archCall, context)
          violations.push(
            createCallViolation(
              archCall,
              `${callName} has no argument with properties ${quotedNames}`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * Assert that NO object literal argument has ANY of the named properties.
 *
 * Scans all arguments of each call for ObjectLiteralExpression nodes.
 * Reports one violation per forbidden property found in any argument.
 *
 * @throws {Error} if called with zero property names
 */
export function notHaveArgumentWithProperty(...names: string[]): Condition<ArchCall> {
  if (names.length === 0) {
    throw new ArchConfigError(
      'notHaveArgumentWithProperty',
      'notHaveArgumentWithProperty requires at least one property name',
    )
  }
  const quotedNames = names.map((n) => `"${n}"`).join(', ')
  const description =
    names.length === 1
      ? `not have argument with property "${names[0] ?? ''}"`
      : `not have argument with properties ${quotedNames}`

  return {
    description,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        // Hoist: inner nested loops (args × names) can produce multiple
        // violations against the same archCall — same identity work each time.
        const callName = callNameForMessage(archCall, context)
        const args = archCall.getArguments()
        for (const arg of args) {
          const propNames = getObjectLiteralPropertyNames(arg)
          for (const name of names) {
            if (propNames.has(name)) {
              violations.push(
                createCallViolation(
                  archCall,
                  `${callName} argument has forbidden property "${name}"`,
                  context,
                ),
              )
            }
          }
        }
      }
      return violations
    },
  }
}

/**
 * Assert that at least one argument subtree contains a match.
 *
 * Searches ALL arguments of each call recursively using `findMatchesInCode`,
 * which tests each argument itself too (bug 0323).
 * This is a superset of `haveCallbackContaining` — it searches the entire
 * subtree of every argument (object literals, callbacks, nested expressions),
 * not just function-like arguments. Use `haveCallbackContaining` when you
 * only want to search callback bodies.
 */
export function haveArgumentContaining(matcher: ExpressionMatcher): Condition<ArchCall> {
  return {
    description: `have argument containing ${matcher.description}`,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        const args = archCall.getArguments()
        let found = false
        for (const arg of args) {
          const matches = findMatchesInCode(arg, matcher)
          if (matches.length > 0) {
            found = true
            break
          }
        }
        if (!found) {
          violations.push(
            createCallViolation(
              archCall,
              `${callNameForMessage(archCall, context)} has no argument containing ${matcher.description}`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * Assert that NO argument subtree contains a match.
 *
 * Searches ALL arguments of each call recursively using `findMatchesInCode`,
 * which tests each argument itself too (bug 0323).
 * Produces one violation per matching node found in any argument.
 *
 * This is a superset of `notHaveCallbackContaining` — it searches the entire
 * subtree of every argument (object literals, callbacks, nested expressions),
 * not just function-like arguments. Use `notHaveCallbackContaining` when you
 * only want to search callback bodies.
 */
export function notHaveArgumentContaining(matcher: ExpressionMatcher): Condition<ArchCall> {
  return {
    description: `not have argument containing ${matcher.description}`,
    evaluate(elements: ArchCall[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const archCall of elements) {
        // Hoist: inner match loop produces multiple violations against the
        // same archCall — same identity work each time.
        const callName = callNameForMessage(archCall, context)
        const args = archCall.getArguments()
        const matches = findMatchesInEach(args, matcher)
        const identities = identifyMatches(
          'call-argument',
          archCall.getSourceFile().getFilePath(),
          matches.map((m) => m.node),
          `${identityNameOf(archCall, context)} :: ${matcher.description}`,
        )
        matches.forEach((match, index) => {
          violations.push({
            ...createCallViolation(
              archCall,
              `${callName} argument contains ${matcher.description} at line ${String(reportedLine(match.node, match.triviaPos))}`,
              context,
            ),
            identity: identities[index],
          })
        })
      }
      return violations
    },
  }
}
