import { ArchConfigError } from '@nielspeter/eess'
import type { SourceFile } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'

/**
 * Module must NOT have a default export.
 *
 * @example
 * modules(p).that().resideInFolder('** /src/** ')
 *   .should().notHaveDefaultExport()
 *   .check()
 */
export function notHaveDefaultExport(): Condition<SourceFile> {
  return moduleCondition(
    'not have a default export',
    (sf) => sf.getDefaultExportSymbol() !== undefined,
    (sf) => `${sf.getBaseName()} has a default export`,
  )
}

/**
 * Module must have a default export.
 *
 * @example
 * modules(p).that().resideInFolder('** /pages/** ')
 *   .should().haveDefaultExport()
 *   .check()
 */
export function haveDefaultExport(): Condition<SourceFile> {
  return moduleCondition(
    'have a default export',
    (sf) => sf.getDefaultExportSymbol() === undefined,
    (sf) => `${sf.getBaseName()} does not have a default export`,
  )
}

/**
 * A module-level condition: one violation per file that fails the test.
 *
 * `haveDefaultExport` and `notHaveDefaultExport` were byte-identical but for
 * the polarity of one `if` and the wording of two strings — `no-copy-paste`
 * reported them as literally the same text.
 *
 * They stay two exported functions and cannot become one. `not()` composes
 * predicates, which answer a boolean; a condition owns its violation MESSAGE,
 * and the negation of "does not have a default export" is not a mechanical
 * inversion of that sentence — it is "has a default export", which only the
 * author can write. A generic negation would emit the wrong remedy, which is
 * ADR-009 rule 2's whole subject. So the loop is shared and the sentence is not.
 *
 * `line: 1` because the finding is about the module, not a position in it.
 */
function moduleCondition(
  description: string,
  violatesWhen: (sf: SourceFile) => boolean,
  message: (sf: SourceFile) => string,
): Condition<SourceFile> {
  return {
    description,
    evaluate: (elements, context) =>
      elements.filter(violatesWhen).map((sf) => ({
        rule: context.rule,
        element: sf.getBaseName(),
        file: sf.getFilePath(),
        line: 1,
        message: message(sf),
        because: context.because,
      })),
  }
}

/**
 * Module must have at most `max` named exports.
 *
 * Counts distinct export names (not declarations — a re-export counts as one).
 * Default exports are not counted.
 *
 * @example
 * modules(p).that().resideInFolder('** /domain/** ')
 *   .should().haveMaxExports(1)
 *   .check()
 */
export function haveMaxExports(max: number): Condition<SourceFile> {
  if (!Number.isInteger(max) || max < 0) {
    throw new ArchConfigError(
      'haveMaxExports',
      `haveMaxExports: max must be a non-negative integer, got ${String(max)}`,
    )
  }
  return {
    description: `have at most ${String(max)} export(s)`,
    evaluate(elements: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of elements) {
        const exportMap = sf.getExportedDeclarations()
        // Count named exports — exclude 'default' key
        let count = 0
        for (const key of exportMap.keys()) {
          if (key !== 'default') count++
        }
        if (count > max) {
          violations.push({
            rule: context.rule,
            element: sf.getBaseName(),
            file: sf.getFilePath(),
            line: 1,
            message: `${sf.getBaseName()} has ${String(count)} named export(s), exceeding the limit of ${String(max)}`,
            because: context.because,
            // Hand-built rather than through `metricViolation`, because this
            // site has no `Node` to derive an element name from — it reports
            // against the file. Same two fields, same contract (bug 0012).
            identity: `${sf.getFilePath()}::${sf.getBaseName()}::named-exports`,
            measured: count,
            // Stamped by hand because this is the one metric finding that does not
            // go through `metricViolation` (there is no `Node` to derive from), and
            // the unit must not depend on which constructor a producer happened to
            // use — bug 0171.
            measuredUnit: 'named-exports',
          })
        }
      }
      return violations
    },
  }
}
