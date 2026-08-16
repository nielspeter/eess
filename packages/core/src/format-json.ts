import type { ArchViolation } from './violation.js'

/**
 * Format violations as a JSON string.
 *
 * Useful for CI pipelines, custom dashboards, or piping to other tools.
 *
 * @example
 * const violations = collectViolations(rule1, rule2)
 * console.log(formatViolationsJson(violations))
 */
export function formatViolationsJson(violations: ArchViolation[], reason?: string): string {
  const output = {
    summary: {
      total: violations.length,
      reason: reason ?? null,
    },
    violations: violations.map((v) => ({
      rule: v.rule,
      ruleId: v.ruleId ?? null,
      element: v.element,
      file: v.file,
      line: v.line,
      message: v.message,
      because: v.because ?? null,
      suggestion: v.suggestion ?? null,
      docs: v.docs ?? null,
      codeFrame: v.codeFrame ?? null,
      // Bug 0012's measurement, on the wire (reconciled against ts-archunit,
      // plan 0147). Without it the ratchet was machine-readable only inside the
      // baseline file, and a dashboard wanting the number had to regex it back
      // out of the message.
      measured: v.measured ?? null,
      // What kind of finding this is, which drives what the reader should DO:
      // 'violation' — the code is wrong, edit the named file. 'configuration' —
      // the RULE enforces nothing (a dead selector, an expired
      // `.expectEmpty()`), so editing the code cannot clear it. Absent before
      // this, a consumer could not tell them apart by any field.
      kind: v.bypassFilters === true ? 'configuration' : 'violation',
    })),
  }
  return JSON.stringify(output, null, 2)
}
