import type { ClassDeclaration } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { createViolation, getElementName } from '../core/violation.js'
import { identifyMatches } from './match-identity.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import { searchClassBody, reportedLine } from '../helpers/body-traversal.js'

// ─── Class body conditions ──────────────────────────────────────────

/**
 * Class body must contain at least one node matching the matcher.
 *
 * Violation if nothing in the class's member code contains a match: method, constructor and
 * accessor bodies, parameter defaults, property initializers and static blocks. Not decorators,
 * computed names or `extends` — wiring cannot satisfy a must-contain rule (bug 0307).
 */
export function classContain(matcher: ExpressionMatcher): Condition<ClassDeclaration> {
  return {
    description: `contain ${matcher.description}`,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        const result = searchClassBody(cls, matcher, 'member-code')
        if (!result.found) {
          violations.push(
            createViolation(
              cls,
              `${getElementName(cls)} does not contain ${matcher.description}`,
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
 * Class body must NOT contain any node matching the matcher.
 *
 * Violation for EACH matching node found in any code the class runs: its member code, and every
 * decorator expression, computed member name and the `extends` expression (bug 0307).
 * Reports the specific line where the violation occurs.
 */
export function classNotContain(matcher: ExpressionMatcher): Condition<ClassDeclaration> {
  return {
    description: `not contain ${matcher.description}`,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        const result = searchClassBody(cls, matcher, 'all-code')
        const identities = identifyMatches(
          'class-body',
          cls.getSourceFile().getFilePath(),
          result.matchingNodes,
          matcher.description,
        )
        result.matchingNodes.forEach((node, index) => {
          violations.push({
            ...createViolation(
              cls,
              `${getElementName(cls)} contains ${matcher.description} at line ${String(reportedLine(node, result.triviaPositions[index]))}`,
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
 * Class body must use the 'good' pattern instead of the 'bad' pattern.
 *
 * Combines notContain(bad) and contain(good) into a single condition
 * with better violation messages.
 *
 * Two types of violations:
 * 1. Class contains the 'bad' pattern — "use X instead of Y at line N"
 * 2. Class does not contain the 'good' pattern — "expected X but not found"
 */
export function classUseInsteadOf(
  bad: ExpressionMatcher,
  good: ExpressionMatcher,
): Condition<ClassDeclaration> {
  return {
    description: `use ${good.description} instead of ${bad.description}`,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        const badResult = searchClassBody(cls, bad, 'all-code')
        const goodResult = searchClassBody(cls, good, 'member-code')

        // Report each occurrence of the bad pattern
        const identities = identifyMatches(
          'class-body',
          cls.getSourceFile().getFilePath(),
          badResult.matchingNodes,
          bad.description,
        )
        badResult.matchingNodes.forEach((node, index) => {
          violations.push({
            ...createViolation(
              cls,
              `${getElementName(cls)} contains ${bad.description} at line ${String(reportedLine(node, badResult.triviaPositions[index]))} — use ${good.description} instead`,
              context,
            ),
            identity: identities[index],
          })
        })

        // If the good pattern is missing entirely, report that too
        if (!goodResult.found) {
          violations.push(
            createViolation(
              cls,
              `${getElementName(cls)} does not contain ${good.description}`,
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
 * Class must not have an empty body (zero members).
 *
 * A class with only comments is still considered empty.
 */
export function classNotHaveEmptyBody(): Condition<ClassDeclaration> {
  return {
    description: 'not have an empty body',
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        if (cls.getMembers().length === 0) {
          violations.push(
            createViolation(
              cls,
              `${getElementName(cls)} has an empty body (zero members)`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}
