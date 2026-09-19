import { Node, SyntaxKind } from 'ts-morph'
import type { ClassDeclaration, SourceFile } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { createViolation } from '../core/violation.js'
import type { ArchFunction } from '../models/arch-function.js'
import { newExpr, type ExpressionMatcher } from '../helpers/matchers.js'
import { codeOfParameters, searchClassBody } from '../helpers/body-traversal.js'
import { classNotContain } from '../conditions/body-analysis.js'
import { functionNotContain } from '../conditions/body-analysis-function.js'
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
        for (const result of findSilentCatches(sf)) {
          violations.push(createViolation(result.node, result.message, context))
        }
      }
      return violations
    },
  }
}
