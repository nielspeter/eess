import type { ArchViolation } from './violation.js'
import type { RuleMetadata } from './rule-metadata.js'
import { formatViolations } from './format.js'
import { finishPreset, type PresetReportOptions } from './report.js'

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
interface Dispatchable {
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
      console.warn(formatViolations(violations))
    }
    return []
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
      console.warn(
        `[eess] Override key '${key}' does not match any rule in this preset. ` +
          `Available rules: ${knownIds.join(', ')}`,
      )
    }
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
