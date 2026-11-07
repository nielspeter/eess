import type { ArchViolation } from './violation.js'
import { isArchRuleError } from './errors.js'

/**
 * Collect the violations rules report, for a baseline. A rule's violations do not throw out of it;
 * anything else its `check()` throws does (bug 0586).
 *
 * Used to generate a baseline: run all rules, collect violations,
 * write them to a baseline file.
 *
 * **This bypasses the evidence gate, deliberately and knowingly** — see ADR-014
 * and proposal 011 ask C. Prefer a dialect's `baseline` command, which gates per
 * rule file and refuses a builder that certified nothing.
 *
 * It harvests only the violations a rule's `check()` throws as an
 * `ArchRuleError`, recognised by its structure (`isArchRuleError`), so one a
 * second kernel copy throws is harvested too. Anything else a `check()` throws, a configuration error
 * or a bug in the rule, is rethrown: a rule that refused to run is not a rule
 * with no violations (bug 0586).
 *
 * **Not the same function as `eess-ts`'s `collectViolations`.** This one takes
 * builders with a throwing `check()` and harvests the `ArchRuleError`; the
 * dialect's takes builders with a non-throwing `violations()`. Same name, same
 * `@example`, different contract.
 *
 * @example
 * const violations = collectViolations(
 *   classes(p).that().extend('Base').should().notContain(call('parseInt')),
 *   classes(p).that().extend('Base').should().notContain(newExpr('Error')),
 * )
 * generateBaseline(violations, 'arch-baseline.json')
 */
export function collectViolations(...builders: Array<{ check: () => void }>): ArchViolation[] {
  const allViolations: ArchViolation[] = []

  for (const builder of builders) {
    try {
      builder.check()
    } catch (error: unknown) {
      if (!isArchRuleError(error)) throw error
      allViolations.push(...error.violations)
    }
  }

  return allViolations
}
