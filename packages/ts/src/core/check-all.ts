import type { ArchViolation, RuleBuilderLike } from '@nielspeter/eess'
import type { CheckOptions } from '@nielspeter/eess'
import { ArchRuleError } from '@nielspeter/eess'
import { callerAggregates, writeReport } from './execute-rule.js'
import { dedupeConfigFindings } from '@nielspeter/eess'
import { suppressionNotice } from '@nielspeter/eess'
import { writeStderr } from '@nielspeter/eess'
import { edgeCoverageNotice, resetEdgeCoverage, untestedRules } from '@nielspeter/eess'
import { commentSuppressionNotice, resetCommentSuppression } from '@nielspeter/eess'

/**
 * Run an array of rules (e.g. a spread preset) and throw one aggregated
 * `ArchRuleError` if any **error-severity** violation is found. Warn-severity
 * violations are reported but never throw — the same severity contract as the
 * CLI `check`. This is the test-file terminal for the returning form:
 *
 * ```ts
 * checkAll(layeredArchitecture(p, opts))
 * checkAll([...recommended(p), ...layeredArchitecture(p, opts)])
 * ```
 *
 * Each builder's `.violations()` already carries its stamped severity
 * (via `.asSeverity()`), so aggregation and severity are preserved across the
 * whole array — one readable error listing every error-severity violation.
 */
export function checkAll(rules: RuleBuilderLike[], options?: CheckOptions): void {
  // Per run, like `runCheck` — a second `checkAll` in one vitest file must
  // not inherit the first's rules.
  resetEdgeCoverage()
  resetCommentSuppression()
  // One option, one finding (plan 0074). A preset fans a single bad option out
  // across every generated rule, and only an aggregation point can see that.
  let violations = dedupeConfigFindings(rules.flatMap((rule) => rule.violations()))

  if (options?.baseline) {
    violations = options.baseline.filterNew(violations)
  }
  // `checkAll` filters once for the whole array, so like the CLI it can state
  // the real number (plan 0071). The per-rule terminals cannot — see
  // `core/diff-disclosure.ts`.
  let notice: string | undefined
  if (options?.diff) {
    const before = violations.length
    violations = options.diff.filterToChanged(violations)
    notice = suppressionNotice(
      before - violations.length,
      options.diff.size,
      options.diff.baseBranch,
    )
    if (notice !== undefined) writeStderr(notice)
  }

  // `reason` is rendered as each violation's "Why:" line on the terminal path
  // (`format.ts`: `v.because ?? reason`), so a RUN-level notice must not travel
  // that way — it would appear as the justification for an unrelated finding.
  // `summary.reason` in JSON is genuinely run-level, so it goes there, and
  // stderr carries it for every other format. Found by sabotage: removing the
  // `writeStderr` call left the tests green because the notice was reaching
  // stderr through the "Why:" line instead.
  // Bug 0203 — the third emitter, and the same contract `executeCheck` and
  // `deliver()` now honour. A `checkAll()` at module scope used to print its
  // findings before an aggregating caller saw them, and the caller then reported
  // the same violations again off the throw below.
  //
  // **Suppress exactly what rides the throw, and nothing else** — ADR-008's
  // amendment, and this function is the case that gives it teeth. The throw at the
  // bottom carries only the ERROR-severity subset, so warn-severity findings ride
  // nothing. Suppressing them too is not "the caller will report it", it is
  // deleting them: measured, four warn findings produced and discarded under
  // `✓ eess-ts — 4 rules across 1 file · 0 failing`, exit 0. A fake green through
  // this package's own CLI. The first version of this guard did exactly that.
  //
  // The flag defaults to `false`, so `checkAll()` in a test file — where nobody
  // aggregates — still prints everything, exactly as before.
  const ridesTheThrow = (v: ArchViolation): boolean => (v.severity ?? 'error') === 'error'
  const toWrite = callerAggregates() ? violations.filter((v) => !ridesTheThrow(v)) : violations
  if (toWrite.length > 0 || (!callerAggregates() && options?.format === 'json')) {
    writeReport(
      toWrite,
      options?.format,
      options?.format === 'json' ? notice : undefined,
      untestedRules(),
    )
  }

  // Bug 0015 reaches the in-test path too. `checkAll` is the vitest-side
  // equivalent of `runCheck`, and a disclosure the recommended runner never
  // shows is a disclosure that does not exist — the same argument that got
  // `diagnose()` exported for the vitest half of the audience. The residual,
  // stated: a bare `.check()` per rule has no run boundary to reset or report
  // at, so it still shows nothing.
  if (options?.format !== 'json') {
    const coverage = edgeCoverageNotice()
    if (coverage !== undefined) writeStderr(`${coverage}\n`)
  }

  // Inline exclusion comments, same footnote position and the same reason. Kept
  // out of the JSON prose for the same reason coverage is: a consumer parsing
  // that document gets the identities structurally, not as a sentence to grep.
  if (options?.format !== 'json') {
    const suppressed = commentSuppressionNotice()
    if (suppressed !== undefined) writeStderr(`${suppressed}\n`)
  }

  const errors = violations.filter(ridesTheThrow)
  if (errors.length > 0) {
    throw new ArchRuleError(errors)
  }
}
