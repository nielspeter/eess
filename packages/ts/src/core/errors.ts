import type { ArchViolation } from './violation.js'

/**
 * Thrown by `.check()` when architecture violations are found.
 *
 * Integrates naturally with vitest/jest — the test fails with a readable
 * error message listing all violations and their locations.
 */
export class ArchRuleError extends Error {
  public readonly violations: ArchViolation[]

  constructor(violations: ArchViolation[], reason?: string) {
    const summary = `Architecture violation${violations.length === 1 ? '' : 's'} (${String(violations.length)} found)`
    const reasonLine = reason ? ` — ${reason}` : ''
    super(`${summary}${reasonLine}`)
    this.name = 'ArchRuleError'
    this.violations = violations
  }
}

/**
 * Is this an `ArchRuleError` — including one thrown by a DIFFERENT copy of this
 * module?
 *
 * `instanceof` is an identity check, and a rule file does not necessarily load
 * through the same module registry as the CLI that loads it. `load-rules.ts`
 * uses jiti (bug 0074: a `.ts` rule file must load inside a `"type": "commonjs"`
 * consumer project), and jiti keeps its own registry — so the `ArchRuleError`
 * a self-executing rule file throws is a different class object from this one
 * and `instanceof` is FALSE for an error that is, in every way that matters,
 * an ArchRuleError.
 *
 * Measured: that made `check.ts` skip `ruleFileTruncated()`, so a rule file
 * whose first rule threw reported the finding and said nothing about the rules
 * after it that never ran — a silent gap in a red run, which is bug 0029
 * reopened by the loader. The same hazard exists for any consumer with two
 * copies of eess-ts on disk (a nested `node_modules`), where the loader is
 * irrelevant.
 *
 * Structural, therefore: the `name` this class stamps in its constructor plus
 * the `violations` array that is its whole reason to exist. Both are part of the
 * documented public shape (`ArchViolation[]` on a thrown error), so matching on
 * them is matching on the contract rather than on a coincidence.
 */
export function isArchRuleError(error: unknown): error is ArchRuleError {
  if (error instanceof ArchRuleError) return true
  return (
    error instanceof Error &&
    error.name === 'ArchRuleError' &&
    'violations' in error &&
    Array.isArray(error.violations)
  )
}
