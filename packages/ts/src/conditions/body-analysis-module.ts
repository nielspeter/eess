import type { Node, SourceFile } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { identifyMatches } from './match-identity.js'
import { enclosingScopeName } from '../core/violation.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import {
  searchModuleBody,
  type ModuleBodyOptions,
  reportedLine,
} from '../helpers/body-traversal.js'

// ─── Module body conditions ────────────────────────────────────────

/**
 * What a per-match module finding is ABOUT: the declaration containing the match, and the file only
 * when nothing does (bug 0333).
 *
 * One definition, because two module conditions report per-match findings and the expression was
 * written twice — which also left the sabotage matrix unable to name either site unambiguously, in
 * the commit that claimed to correct that matrix.
 */
function subjectOf(node: Node, sf: SourceFile): string {
  return enclosingScopeName(node) ?? sf.getBaseName()
}

/**
 * Module must contain at least one node matching the matcher.
 *
 * Default: searches the entire file. With `{ scopeToModule: true }`,
 * only searches top-level statements (skips class/function bodies).
 */
export function moduleContain(
  matcher: ExpressionMatcher,
  options?: ModuleBodyOptions,
): Condition<SourceFile> {
  return {
    description: `contain ${matcher.description}`,
    evaluate(elements: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of elements) {
        const result = searchModuleBody(sf, matcher, options)
        if (!result.found) {
          violations.push({
            rule: context.rule,
            element: sf.getBaseName(),
            file: sf.getFilePath(),
            line: 1,
            message: `${sf.getBaseName()} does not contain ${matcher.description}`,
            because: context.because,
          })
        }
      }
      return violations
    },
  }
}

/**
 * Module must NOT contain any node matching the matcher.
 *
 * Produces one violation per matching node found.
 * Default: searches the entire file. With `{ scopeToModule: true }`,
 * only searches top-level statements (skips class/function bodies).
 */
export function moduleNotContain(
  matcher: ExpressionMatcher,
  options?: ModuleBodyOptions,
): Condition<SourceFile> {
  return {
    description: `not contain ${matcher.description}`,
    evaluate(elements: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of elements) {
        const result = searchModuleBody(sf, matcher, options)
        const identities = identifyMatches(
          'module-body',
          sf.getFilePath(),
          result.matchingNodes,
          matcher.description,
        )
        result.matchingNodes.forEach((node, index) => {
          const subjectName = subjectOf(node, sf)
          violations.push({
            rule: context.rule,
            // The declaration that CONTAINS the match, and the file only when none does (bug 0333).
            // A module rule reads the whole file, so `element` was the file for every finding — and
            // `element` is what `.excluding()` keys on and what a reader looks at first. With the
            // `recommended` floor reading module subjects, that would have turned every finding it
            // already made from `runEval` into `dangerous.ts`.
            //
            // This does not change any existing baseline entry, because `identifyMatches` — which
            // is untouched — builds the identity. It is NOT independent of the name, though: the
            // key carries the match's own scope, so renaming the enclosing declaration moves the
            // entry. An earlier version of this comment said renames were safe; the method review
            // of PR #149 measured otherwise.
            element: subjectName,
            file: sf.getFilePath(),
            line: reportedLine(node, result.triviaPositions[index]),
            // The MESSAGE carries the same name as `element`, because the `github` emitter prints
            // the message and drops `element` — naming the declaration only in `element` made the
            // CI annotation LESS specific than before this rule changed subject, which the customer
            // review measured (`runEval contains …` became `legacy.ts contains …`).
            message: `${subjectName} contains ${matcher.description} at line ${String(reportedLine(node, result.triviaPositions[index]))}`,
            identity: identities[index],
            because: context.because,
          })
        })
      }
      return violations
    },
  }
}

/**
 * Module must use the 'good' pattern instead of the 'bad' pattern.
 *
 * Combines notContain(bad) and contain(good) into a single condition
 * with better violation messages.
 */
export function moduleUseInsteadOf(
  bad: ExpressionMatcher,
  good: ExpressionMatcher,
  options?: ModuleBodyOptions,
): Condition<SourceFile> {
  return {
    description: `use ${good.description} instead of ${bad.description}`,
    evaluate(elements: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of elements) {
        const badResult = searchModuleBody(sf, bad, options)
        const goodResult = searchModuleBody(sf, good, options)

        const identities = identifyMatches(
          'module-body',
          sf.getFilePath(),
          badResult.matchingNodes,
          bad.description,
        )
        badResult.matchingNodes.forEach((node, index) => {
          // Named like `moduleNotContain`'s matches (bug 0333): this is a finding ABOUT a match, so
          // it names what contains the match. The two absence findings in this file — `moduleContain`
          // above and the `goodResult` one below — are about the FILE not containing something, and
          // name the file, which is the subject there.
          const subjectName = subjectOf(node, sf)
          violations.push({
            rule: context.rule,
            element: subjectName,
            file: sf.getFilePath(),
            line: reportedLine(node, badResult.triviaPositions[index]),
            message: `${subjectName} contains ${bad.description} at line ${String(reportedLine(node, badResult.triviaPositions[index]))} — use ${good.description} instead`,
            identity: identities[index],
            because: context.because,
          })
        })

        if (!goodResult.found) {
          violations.push({
            rule: context.rule,
            element: sf.getBaseName(),
            file: sf.getFilePath(),
            line: 1,
            message: `${sf.getBaseName()} does not contain ${good.description}`,
            because: context.because,
          })
        }
      }
      return violations
    },
  }
}
