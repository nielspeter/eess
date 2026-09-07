import type { ArchViolation } from './violation.js'
import { ArchRuleError } from './errors.js'

/**
 * Collect violations from rules WITHOUT throwing.
 *
 * Used to generate a baseline: run all rules, collect violations,
 * write them to a baseline file.
 *
 * **This bypasses the evidence gate, deliberately and knowingly** — see ADR-014
 * and proposal 011 ask C. Prefer a dialect's `baseline` command, which gates per
 * rule file and refuses a builder that certified nothing.
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
      if (error instanceof ArchRuleError) {
        allViolations.push(...error.violations)
      }
    }
  }

  return allViolations
}
