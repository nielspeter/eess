import type { ArchViolation, RuleBuilderLike } from '@nielspeter/eess'
import type { CheckOptions } from '@nielspeter/eess'
import {
  ArchRuleError,
  EMITTER_PASS_WITHOUT_EVIDENCE,
  finishPreset,
  mergeCollectResults,
} from '@nielspeter/eess'
import { UNSUPPRESSABLE } from '@nielspeter/eess/internal'
import { callerAggregates, writeReport } from './execute-rule.js'
import { dedupeConfigFindings } from '@nielspeter/eess/internal'
import { suppressionNotice } from '@nielspeter/eess/internal'
import { writeStderr } from '@nielspeter/eess/internal'
import { edgeCoverageNotice, resetEdgeCoverage, untestedRules } from '@nielspeter/eess/internal'
import { commentSuppressionNotice, resetCommentSuppression } from '@nielspeter/eess/internal'

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
  // **The receipt survives the aggregation** — plan 0263 Phase 2, and the reason
  // ADR-014's row for this door stayed `pending` after plan 0235 shipped the
  // contract. This line used to be `rules.flatMap((rule) => rule.violations())`,
  // and a `flatMap` over receipts yields a bare array: every `examined` on the
  // floor, and the evidence gate never reached. Measured before the change,
  // `checkAll([{ violations: () => [] }])` returned silently — a rule file
  // exporting an evidence-free builder passed through this door without a word,
  // which is bug 0206's shape at a different seam.
  //
  // `mergeCollectResults` is the kernel's one merge (ADR-014 §7) and is
  // fail-closed **per member**, so one evidence-free builder among twenty is
  // named rather than absorbed by the others' counts.
  // **The empty array answers for itself, because the kernel's message cannot.**
  // `mergeCollectResults([])` is zero examined and undeclared, so the gate below
  // fires `emitter/pass-without-evidence` — correct. But that finding's remedy
  // names `expectEmpty: true` in a preset's report options and `.expectEmpty()`
  // on a builder, and at THIS door there is no preset and no builder to call it
  // on: `CheckOptions` carries `baseline`, `diff` and `format` only. A finding
  // whose every stated remedy is unreachable is ADR-009 rule 2's failure, and
  // `emitter-findings.ts` records that this exact message was once rewritten for
  // exactly that reason. Four reviewers caught it being recreated here.
  //
  // So this door states the remedy a `checkAll` caller can actually act on. The
  // finding stays unsuppressable and error-severity like its sibling; only the
  // text is this door's.
  if (rules.length === 0) {
    throw new ArchRuleError([
      {
        rule: EMITTER_PASS_WITHOUT_EVIDENCE,
        ruleId: EMITTER_PASS_WITHOUT_EVIDENCE,
        element: EMITTER_PASS_WITHOUT_EVIDENCE,
        file: '',
        line: 0,
        message:
          'checkAll() was called with no rules, so this run examined nothing and cannot ' +
          'report a pass. Pass the rules you meant to check. If the array is computed — ' +
          "a preset in `report: 'builders'` mode, say — the emptiness is upstream, and " +
          'the preset is where it has to be declared or fixed; there is no declaration ' +
          'form at this door.',
        suggestion:
          'Pass the rules you meant to check. If the array is computed and legitimately ' +
          'empty, declare that where it is built — skipping the checkAll() call instead ' +
          'removes the check rather than satisfying it. ' +
          UNSUPPRESSABLE,
        bypassFilters: true,
      },
    ])
  }

  const receipt = mergeCollectResults(rules.map((rule) => rule.violations()))
  // ADR-008: this function owns its reporting below, so the gate runs under
  // `report: 'return'` and hands the findings back instead of emitting them.
  // An emitter finding carries `bypassFilters`, so it survives both the baseline
  // (`packages/core/src/baseline.ts:283`) and the diff filter, and it is
  // error-severity, so it rides the throw at the bottom.
  //
  // One option, one finding (plan 0074). A preset fans a single bad option out
  // across every generated rule, and only an aggregation point can see that.
  let violations = dedupeConfigFindings(finishPreset(receipt, { report: 'return' }))

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
