import type { ArchViolation } from './violation.js'
import type { OutputFormat } from './check-options.js'
import { ArchRuleError } from './errors.js'
import { formatViolations } from './format.js'
import { formatViolationsJson } from './format-json.js'
import { formatViolationsGitHub } from './format-github.js'

/**
 * How a preset delivers its violations (plan 0070, ADR-008):
 * - `throw` (default) — emit, then throw `ArchRuleError` (today's behavior)
 * - `return` — return the violations, emit nothing (the caller owns reporting)
 * - `warn` — emit as a report, but do not throw
 */
export type ReportMode = 'throw' | 'return' | 'warn'

/** Emission options shared by the reporter and the preset finisher. */
export interface ReportOptions {
  /** Output format. Default `terminal` (rich text to stderr). */
  readonly format?: OutputFormat
  /** Rationale threaded into the emitted output. */
  readonly reason?: string
}

/** Reporting controls a preset accepts, on top of its own options. */
export interface PresetReportOptions extends ReportOptions {
  /** Delivery mode. Default `throw`. */
  readonly report?: ReportMode
}

/**
 * The single place that knows how to *emit* violations — text (stderr), JSON,
 * or GitHub annotations (stdout). No throw, no filtering, no control flow: just
 * emission. `executeCheck` (the `.check()` path) and `finishPreset` (the preset
 * path) both delegate here, so the two reporting paths can no longer diverge
 * (plan 0070). Emits nothing for an empty set.
 */
export function reportViolations(violations: ArchViolation[], options: ReportOptions = {}): void {
  if (violations.length === 0) return
  const format: OutputFormat = options.format ?? 'terminal'
  if (format === 'json') {
    process.stdout.write(formatViolationsJson(violations, options.reason) + '\n')
  } else if (format === 'github') {
    process.stdout.write(formatViolationsGitHub(violations, 'error') + '\n')
  } else {
    // Rich text to stderr — test runners show the plain-text Error message,
    // while stderr carries the colorized Why/Fix/Docs output.
    process.stderr.write(formatViolations(violations, options.reason) + '\n')
  }
}

/**
 * Finish a preset: deliver its aggregated violations per the requested mode
 * (plan 0070). `throw` (default) emits then throws — backward-compatible with
 * `throwIfViolations`; `return` hands the violations back untouched (the caller
 * owns emission and control flow); `warn` emits without throwing. Always
 * returns the violations, so a caller can inspect them regardless of mode.
 */
export function finishPreset(
  violations: ArchViolation[],
  options: PresetReportOptions = {},
): ArchViolation[] {
  const mode: ReportMode = options.report ?? 'throw'
  if (mode === 'return') return violations
  reportViolations(violations, options)
  if (mode === 'throw' && violations.length > 0) {
    throw new ArchRuleError(violations, options.reason)
  }
  return violations
}
