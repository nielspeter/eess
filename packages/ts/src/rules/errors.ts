import { Node, SyntaxKind } from 'ts-morph'
import type { ClassDeclaration, SourceFile } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { createViolation, enclosingScopeName } from '../core/violation.js'
import { identifyMatches } from '../conditions/match-identity.js'
import type { ArchFunction } from '../models/arch-function.js'
import { newExpr, type ExpressionMatcher } from '../helpers/matchers.js'
import { codeOfParameters, searchClassBody } from '../helpers/body-traversal.js'
import { classNotContain } from '../conditions/body-analysis.js'
import { functionNotContain } from '../conditions/body-analysis-function.js'
import { moduleNotContain } from '../conditions/body-analysis-module.js'
import { findSilentCatches, silentCatchMessage } from '../conditions/catch-analysis.js'

/**
 * No throwing generic Error — use typed domain errors instead.
 *
 * @example
 * classes(p).that().extend('BaseService')
 *   .should().satisfy(noGenericErrors())
 *   .because('use DomainError, NotFoundError, etc.')
 *   .check()
 */
export function noGenericErrors(): Condition<ClassDeclaration> {
  return classNotContain(newExpr('Error'))
}

/**
 * No throwing TypeError — usually indicates a programming error, not a domain error.
 */
export function noTypeErrors(): Condition<ClassDeclaration> {
  return classNotContain(newExpr('TypeError'))
}

// ─── Function variants ────────────────────────────────────────────

export function functionNoGenericErrors(): Condition<ArchFunction> {
  return functionNotContain(newExpr('Error'))
}

export function functionNoTypeErrors(): Condition<ArchFunction> {
  return functionNotContain(newExpr('TypeError'))
}

// ─── Module variants ─────────────────────────────────────────────

/**
 * No throwing generic Error anywhere the FILE runs code — bug 0337.
 *
 * The third spelling of one rule, and the broadest: `noGenericErrors` reads a
 * class, `functionNoGenericErrors` a function, this one the whole module. Each is
 * the same `notContain(newExpr('Error'))` over a different subject, so there is no
 * second derivation of what a generic error is.
 *
 * It exists because `agentGuardrails` built `no-generic-errors` over `functions()`
 * while its own imperative says "Do NOT throw new Error()" — not "…in a
 * function". Measured before this: a `throw new Error()` at top level and one in a
 * class's static block were both reported as nothing.
 *
 * A rule reads exactly ONE of these three (bug 0333): the subject kinds nest, so
 * running two for one rule id reports the same throw twice.
 */
export function moduleNoGenericErrors(): Condition<SourceFile> {
  return moduleNotContain(newExpr('Error'))
}

// ─── Silent catch detection ──────────────────────────────────────

/** Every catch clause; `noSilentCatch` decides which of them are silent. */
const catchClause: ExpressionMatcher = {
  description: 'catch clause',
  syntaxKinds: [SyntaxKind.CatchClause],
  matches: (node) => Node.isCatchClause(node),
}

/**
 * Catch blocks anywhere a class runs code must reference the caught error variable: member
 * bodies, parameter defaults, property initializers (an arrow-function event handler included),
 * static blocks, decorators, computed names and `extends` (bug 0306). It forbids something, so
 * it reads all of it, as `notContain()` on the class builder does.
 *
 * Detects catch blocks that silently discard errors — no logging,
 * no rethrowing, no passing to another function. A common source of
 * hidden production bugs.
 */
export function noSilentCatch(): Condition<ClassDeclaration> {
  return {
    description: 'not have silent catch blocks (catch must reference the error)',
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        for (const node of searchClassBody(cls, catchClause, 'all-code').matchingNodes) {
          if (!Node.isCatchClause(node)) continue
          const message = silentCatchMessage(node)
          if (message !== undefined) violations.push(createViolation(node, message, context))
        }
      }
      return violations
    },
  }
}

export function functionNoSilentCatch(): Condition<ArchFunction> {
  return {
    description: 'not have silent catch blocks (catch must reference the error)',
    evaluate(elements: ArchFunction[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const fn of elements) {
        const body = fn.getBody()
        if (!body) continue
        // The body whatever its kind — a concise arrow's too — then what the parameters run at each
        // call (bug 0314). A catch clause is never the root of either, so walking below it is enough.
        for (const code of [body, ...codeOfParameters(fn.getParameters())]) {
          for (const result of findSilentCatches(code)) {
            violations.push(createViolation(result.node, result.message, context))
          }
        }
      }
      return violations
    },
  }
}

export function moduleNoSilentCatch(): Condition<SourceFile> {
  return {
    description: 'not have silent catch blocks (catch must reference the error)',
    evaluate(elements: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of elements) {
        const found = [...findSilentCatches(sf)]
        // Named and identified as the other module conditions do (bug 0333). `createViolation`
        // alone gave every module-scope catch `element = 'CatchClause'` — a KIND name, not a
        // subject — and no producer identity, so a baseline keyed on `element::message` collapsed
        // every top-level silent catch in a project into ONE bucket separated by a positional
        // suffix. Measured on an adopter project by the customer review of this fix: accepting one
        // catch accepted a different catch in a different file, and a delete-plus-add went green.
        // A catch inside a function was never affected — its element is the function's name — which
        // is why this surfaced only when the floor started reading module scope.
        const identities = identifyMatches(
          'module-body',
          sf.getFilePath(),
          found.map((result) => result.node),
          'silent catch',
        )
        found.forEach((result, index) => {
          violations.push({
            ...createViolation(result.node, result.message, context),
            element: enclosingScopeName(result.node) ?? sf.getBaseName(),
            identity: identities[index],
          })
        })
      }
      return violations
    },
  }
}
