import type { ArchViolation } from './violation.js'
import { severityFor } from './violation.js'
import type { RuleMetadata } from './rule-metadata.js'
import { formatViolations } from './format.js'
import { finishPreset, type PresetReportOptions } from './report.js'
import { writeStderr } from './stderr.js'
import { UNSUPPRESSABLE } from './unsuppressable.js'

/** Per-rule severity within a preset. */
export type RuleSeverity = 'error' | 'warn' | 'off'

/**
 * Base options every preset accepts: per-rule severity overrides, plus the
 * reporting controls (`report` / `format`) from ADR-008 — so every preset that
 * extends this can `{ report: 'return' }` without its own plumbing.
 */
export interface PresetBaseOptions extends PresetReportOptions {
  overrides?: Record<string, RuleSeverity>
}

/**
 * Anything with `.rule()` and `.violations()` — works with both
 * `RuleBuilder<T, P>` and `TerminalBuilder` hierarchies, across all dialects.
 */
export interface Dispatchable {
  rule(m: RuleMetadata): { violations(): ArchViolation[] }
  violations(): ArchViolation[]
}

/**
 * Dispatch a single rule within a preset.
 *
 * - `'off'`: skip entirely
 * - `'warn'`: log violations to stderr, do not collect for aggregated throw
 * - `'error'`: collect violations for aggregated throw
 */
export function dispatchRule(
  builder: Dispatchable,
  rule: string | (RuleMetadata & { id: string }),
  defaultSeverity: RuleSeverity,
  overrides: Record<string, RuleSeverity> | undefined,
): ArchViolation[] {
  // Accept either a bare id (existing layered/data-layer/boundaries callers) or
  // full metadata — the latter lets a preset attach because/suggestion/imperative
  // so the rule's guidance reaches `check --format json` and `explain --format
  // agent`, not just the id.
  const meta = typeof rule === 'string' ? { id: rule } : rule
  const effective = overrides?.[meta.id] ?? defaultSeverity
  if (effective === 'off') return []

  const violations = builder.rule(meta).violations()

  if (effective === 'warn') {
    if (violations.length > 0) {
      writeStderr(formatViolations(violations))
    }
    // `bypassFilters` outranks a per-rule `overrides: { id: 'warn' }` — see
    // `severityFor`. A config finding like `presetConstructsNothingViolation`
    // is `UNSUPPRESSABLE` by its own text; silently dropping it here just
    // because its OWN rule was downgraded is exactly the suppression path
    // that text promises does not exist.
    return violations.filter((v) => severityFor(v, 'warn') === 'error')
  }

  return violations
}

/**
 * Validate override keys against known rule IDs. Warns for unrecognized keys
 * (likely typos).
 */
export function validateOverrides(
  overrides: Record<string, RuleSeverity> | undefined,
  knownIds: string[],
): void {
  if (!overrides) return
  const knownSet = new Set(knownIds)
  for (const key of Object.keys(overrides)) {
    if (!knownSet.has(key)) {
      writeStderr(
        `[eess] Override key '${key}' does not match any rule in this preset. ` +
          `Available rules: ${knownIds.join(', ')}`,
      )
    }
  }
}

/**
 * A configuration finding for a preset call that constructed **zero** rules —
 * every optional capability was left off, or a required discovery pattern
 * (a folder glob, a repositories glob) matched nothing, so the call checked
 * nothing and would otherwise pass silently. The vacuity matrix
 * (`scripts/vacuity-matrix.mjs`) is what proves a preset needs this: it
 * probes every published preset at its minimal type-correct call, and a
 * preset reaching `fail-open` there is exactly this shape.
 *
 * Unsuppressable (ADR-010) for the same reason a zero-examined rule is: the
 * caller's mistake is in how the preset was configured, not in the code the
 * preset would have checked, and `.excluding()`/a baseline/`--changed` all
 * aim at the latter.
 *
 * @param presetName - The preset's own name, e.g. `'agentGuardrails'`.
 * @param optionsHint - The option names that would enable a rule, for the
 *   remedy — e.g. `'noGenericErrors, noStubs, noEmptyBodies'`.
 */
export function presetConstructsNothingViolation(
  presetName: string,
  optionsHint: string,
): ArchViolation {
  const message =
    `${presetName}(...) constructed zero rules at this call — no capability of this ` +
    `preset was enabled, or a discovery pattern matched nothing, so it checks nothing ` +
    `and passes silently. Enable at least one option (${optionsHint}), or remove the call.`
  return {
    rule: presetName,
    element: presetName,
    file: '',
    line: 0,
    message,
    suggestion: `${message} ${UNSUPPRESSABLE}`,
    bypassFilters: true,
  }
}

/**
 * Emit (stderr text) and throw a single `ArchRuleError` with all aggregated
 * violations, if any. Kept for backward compatibility; it is now `finishPreset`
 * in the default `throw` mode. New presets take `PresetReportOptions` and call
 * `finishPreset` so a caller can opt into `report: 'return'` / `--format json`
 * (plan 0070).
 */
export function throwIfViolations(violations: ArchViolation[]): void {
  finishPreset(violations, { report: 'throw' })
}
