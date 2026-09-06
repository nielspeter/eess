import type { ArchViolation } from './violation.js'
import { type CollectResult, collectResult, hasEvidence } from './collect-result.js'
import {
  EMITTER_NO_RECEIPT,
  EMITTER_PASS_WITHOUT_EVIDENCE,
  noReceiptViolation,
  passWithoutEvidenceViolation,
  expiredDeclarationViolation,
  EMITTER_EXPIRED_DECLARATION,
} from './emitter-findings.js'

/** Is this one of the emitter's own findings, as opposed to a caller's? */
function isEmitterFinding(v: ArchViolation): boolean {
  return (
    v.ruleId === EMITTER_NO_RECEIPT ||
    v.ruleId === EMITTER_PASS_WITHOUT_EVIDENCE ||
    v.ruleId === EMITTER_EXPIRED_DECLARATION
  )
}
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

  /**
   * Declare that this preset's subject legitimately does not exist here —
   * [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3.
   *
   * **On the shared options type, not on six preset interfaces**, because
   * ADR-010 §3's second clause is about presets as a class: "A preset user does
   * not hold the builder; if a preset option cannot carry the user's
   * empty-declaration to the mint, their only reachable remedy is disabling the
   * option — deleting coverage permanently (ADR-009 rule 1's trained-suppression
   * dynamic, reproduced by this ADR's own gate if unaddressed)." A preset that
   * examines nothing and cannot be told so leaves its user exactly one exit, and
   * it is the wrong one.
   *
   * **It expires**, which is the only reason it is admissible at all: declare
   * this and then examine something, and the emitter reports
   * `emitter/expired-declaration`. A claim nothing can contradict is not an
   * assertion — the property ADR-014 §3's 2026-09-05 amendment turns on when it
   * refuses to infer a declaration from `overrides: 'off'`.
   *
   * Use it for a corpus with no ER diagrams, a suite with no exemptions, a
   * project that genuinely has none of this preset's subject. Do not use it to
   * quiet a preset whose glob is wrong: the day the glob is fixed, this reddens.
   */
  readonly expectEmpty?: boolean
}

/**
 * The single place that knows how to *emit* violations — text (stderr), JSON,
 * or GitHub annotations (stdout). No throw, no filtering, no control flow: just
 * emission. `executeCheck` (the `.check()` path) and `finishPreset` (the preset
 * path) both delegate here, so the two reporting paths can no longer diverge
 * (plan 0070). Emits nothing for an empty set.
 */
let violationsEmitted = 0

/**
 * How many violations this module has actually WRITTEN, ever.
 *
 * Read as a delta by a caller that aggregates reporting, to answer one question it
 * cannot otherwise answer: *did something emit while I was loading that module?*
 *
 * The alternative a caller might reach for — counting the writes it SUPPRESSED and
 * inferring "then nothing was written" — is a double negative and is unsound: a
 * module that suppresses one terminal and leaks through another satisfies it while
 * leaking. Measured on `eess-ts`, which shipped that inference and fell into
 * exactly that case. Count emissions, not silences.
 */
export function violationsEmittedCount(): number {
  return violationsEmitted
}

/**
 * The evidence gate both emitters share — ADR-014 §1, §4.
 *
 * Produced BEFORE the delivery mode is chosen, so the finding is in the value
 * returned under `return`, rides the throw under `throw`, and is in the text
 * written under `warn`. A contract that binds only one door does not bind.
 *
 * A value that already carries a finding passes through untouched (§4): a
 * terminal that examined nothing has already named its own cause, and "you
 * constructed nothing" beside "your glob is dead" is a false second remedy.
 */
function withEvidenceGate(violations: readonly ArchViolation[]): CollectResult {
  // Deliberately looser than the exported signatures. The TYPE refuses a bare
  // array (D1/D2); this guard is for the untyped JavaScript caller the type
  // cannot reach — ADR-014's stated residual, and the field failure in
  // proposal 009 was exactly that consumer.
  if (!hasEvidence(violations)) {
    return collectResult([...violations, noReceiptViolation()], { examined: 0 })
  }
  // Expiry FIRST, and before the `examined > 0` exit — ADR-014 §3. A declaration
  // that cannot be contradicted is not an assertion, which is the whole reason
  // §3's amendment refuses to infer one from a config. Checked even when real
  // violations are present: the declaration is wrong independently of them.
  if (violations.declaredEmpty === true && violations.examined > 0) {
    return collectResult([...violations, expiredDeclarationViolation(violations.examined)], {
      examined: violations.examined,
      sourceEmpty: violations.sourceEmpty,
    })
  }
  if (violations.length > 0) return violations
  if (violations.examined > 0) return violations
  // `declaredEmpty` legitimises a zero; `sourceEmpty` does NOT, and treating the
  // two alike inverted ADR-010 §3's own gated precedence: "Zero loaded source
  // files is a configuration finding UNDER ANY DECLARATION." An empty source is
  // the stronger fault, not a weaker one.
  //
  // A terminal that loaded nothing already carries `zeroLoadedSourceViolation`,
  // so it exits at the `length > 0` line above and never reaches here. What does
  // reach here is a hand-assembled receipt claiming an empty source with nothing
  // to say about it — and passing that silently is the escape hatch this ADR
  // closes.
  if (violations.declaredEmpty === true) return violations
  return collectResult([passWithoutEvidenceViolation()], { examined: violations.examined })
}

export function reportViolations(
  violations: CollectResult,
  options: ReportOptions = {},
): CollectResult {
  const gated = withEvidenceGate(violations)
  if (gated.length === 0) return gated
  violationsEmitted += gated.length
  const format: OutputFormat = options.format ?? 'terminal'
  if (format === 'json') {
    process.stdout.write(formatViolationsJson(gated, options.reason) + '\n')
  } else if (format === 'github') {
    process.stdout.write(formatViolationsGitHub(gated, 'error') + '\n')
  } else {
    // Rich text to stderr — test runners show the plain-text Error message,
    // while stderr carries the colorized Why/Fix/Docs output.
    process.stderr.write(formatViolations(gated, options.reason) + '\n')
  }
  // ADR-014 §5: a bare `reportViolations` hands nothing back that a caller must
  // act on, so a printed unsuppressable finding above a zero exit is the lie by
  // another name. The gate's own finding escalates to a throw here.
  if (gated.some((v) => v.bypassFilters === true && isEmitterFinding(v))) {
    throw new ArchRuleError(gated, options.reason)
  }
  return gated
}

/**
 * Finish a preset: deliver its aggregated violations per the requested mode
 * (plan 0070). `throw` (default) emits then throws — backward-compatible with
 * `throwIfViolations`; `return` hands the violations back untouched (the caller
 * owns emission and control flow); `warn` emits without throwing. Always
 * returns the violations, so a caller can inspect them regardless of mode.
 */
export function finishPreset(
  violations: CollectResult,
  options: PresetReportOptions = {},
): CollectResult {
  const mode: ReportMode = options.report ?? 'throw'
  // A caller's declaration reaches the gate ON the receipt (ADR-014 §3), never
  // as a delivery option the gate reads separately — one boolean beside a sum
  // cannot be weighed against that sum's parts.
  const declared =
    options.expectEmpty === true && !violations.declaredEmpty
      ? collectResult(violations, {
          examined: violations.examined,
          sourceEmpty: violations.sourceEmpty,
          deadGlob: violations.deadGlob,
          declaredEmpty: true,
        })
      : violations
  // The gate runs before the mode is read, so every door carries the finding.
  const gated = withEvidenceGate(declared)
  if (mode === 'return') return gated
  const emitterFinding = gated.some((v) => isEmitterFinding(v))
  if (gated.length > 0) {
    violationsEmitted += gated.length
    const format: OutputFormat = options.format ?? 'terminal'
    if (format === 'json') {
      process.stdout.write(formatViolationsJson(gated, options.reason) + '\n')
    } else if (format === 'github') {
      process.stdout.write(formatViolationsGitHub(gated, 'error') + '\n')
    } else {
      process.stderr.write(formatViolations(gated, options.reason) + '\n')
    }
  }
  // §5 again: `warn` prints without failing for ordinary violations, but an
  // unsuppressable configuration finding printed above a zero exit is exactly
  // the silent green this ADR closes.
  if ((mode === 'throw' && gated.length > 0) || emitterFinding) {
    throw new ArchRuleError(gated, options.reason)
  }
  return gated
}
