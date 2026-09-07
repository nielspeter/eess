import type { ArchViolation } from '@nielspeter/eess'

/**
 * Collect violations from rules WITHOUT throwing.
 *
 * Used to generate a baseline: run all rules via their non-throwing
 * `.violations()` terminal (severity-stamped), and write them to a baseline
 * file.
 *
 * **This bypasses the evidence gate, deliberately and knowingly.** ADR-014
 * requires every emitter to refuse a verdict it has no evidence for, and
 * `eess-ts check` / `--fix` / `baseline` / `checkAll()` all do. This helper does
 * not: it is typed to accept a bare array and documented as not throwing, so
 * `collectViolations(...) + generateBaseline(...)` still mints a baseline from
 * builders that certified nothing. **Prefer `eess-ts baseline`**, which gates
 * per rule file and refuses. Closing this is a public-API decision — see
 * proposal 011 ask C — not a wiring one.
 *
 * @example
 * const violations = collectViolations(
 *   classes(p).that().extend('Base').should().notContain(call('parseInt')),
 *   classes(p).that().extend('Base').should().notContain(newExpr('Error')),
 * )
 * generateBaseline(violations, 'arch-baseline.json')
 */
export function collectViolations(
  ...builders: Array<{ violations: () => ArchViolation[] }>
): ArchViolation[] {
  return builders.flatMap((builder) => builder.violations())
}
