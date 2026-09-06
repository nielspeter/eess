import { type CollectResult, collectResult } from './collect-result.js'
import { severityFor } from './violation.js'
import type { RuleMetadata } from './rule-metadata.js'
import { formatViolations } from './format.js'
import { finishPreset, type PresetReportOptions } from './report.js'
import { writeStderr } from './stderr.js'

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
  rule(m: RuleMetadata): { violations(): CollectResult }
  violations(): CollectResult
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
): CollectResult {
  // Accept either a bare id (existing layered/data-layer/boundaries callers) or
  // full metadata — the latter lets a preset attach because/suggestion/imperative
  // so the rule's guidance reaches `check --format json` and `explain --format
  // agent`, not just the id.
  const meta = typeof rule === 'string' ? { id: rule } : rule
  const effective = overrides?.[meta.id] ?? defaultSeverity
  if (effective === 'off') {
    // A real, measured zero — and deliberately NOT `declaredEmpty`.
    //
    // ADR-014 §3, amended 2026-09-05: a declaration is one a caller MADE over a
    // live instrument, never one eess infers from a configuration.
    // `overrides: { id: 'off' }` is an instruction, and it is byte-identical
    // whether the author meant "I have scoped this out" or "I turned this off to
    // stop a finding" — eess is not positioned to tell those apart, so by
    // ADR-013's rule it must not decide. Marking it declared here would mint,
    // on the author's behalf, exactly the declaration `declaredEmptyFindings`
    // refuses to let them write ("'off' deleted the rule, so the declaration
    // about it is dead").
    //
    // The consequence is deliberate: a preset with every rule off sums to zero
    // examined with no declaration, and the emitter reports it (bug 0261).
    return collectResult([], { examined: 0, notRun: true })
  }

  const violations = builder.rule(meta).violations()

  if (effective === 'warn') {
    if (violations.length > 0) {
      writeStderr(formatViolations(violations))
    }
    // `bypassFilters` outranks a per-rule `overrides: { id: 'warn' }` — see
    // `severityFor`. A config finding — a zero-examined rule, or a preset that
    // constructed nothing — is `UNSUPPRESSABLE` by its own text; silently
    // dropping it here just because its OWN rule was downgraded is exactly the
    // suppression path that text promises does not exist.
    return collectResult(
      violations.filter((v) => severityFor(v, 'warn') === 'error'),
      { examined: violations.examined },
    )
  }

  return violations
}

/**
 * Validate override keys against known rule IDs. Warns for unrecognized keys
 * (likely typos).
 */
export function validateOverrides(
  // `Partial<Record<...>>` and `readonly`, widened from the narrower shapes this
  // signature had, so `eess-ts`'s byte-identical copy could be deleted rather
  // than kept for its types. Both are strictly more permissive: `Partial` admits
  // an explicit `undefined` value, `readonly` admits a frozen list. No caller
  // loses anything.
  overrides: Partial<Record<string, RuleSeverity>> | undefined,
  knownIds: readonly string[],
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
 * Emit (stderr text) and throw a single `ArchRuleError` with all aggregated
 * violations, if any. Kept for backward compatibility; it is now `finishPreset`
 * in the default `throw` mode. New presets take `PresetReportOptions` and call
 * `finishPreset` so a caller can opt into `report: 'return'` / `--format json`
 * (plan 0070).
 */
export function throwIfViolations(violations: CollectResult): void {
  finishPreset(violations, { report: 'throw' })
}
