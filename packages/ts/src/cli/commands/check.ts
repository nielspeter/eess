import { applyFixes, detectFormat } from '@nielspeter/eess'
import { withBaseline } from '../../helpers/baseline.js'
import { diffAware } from '../../helpers/diff-aware.js'
import type { OutputFormat } from '@nielspeter/eess'
import type { ArchViolation, CheckOptions, RuleBuilderLike } from '@nielspeter/eess'
import { isArchRuleError } from '@nielspeter/eess'
import { withCallerAggregating, violationsWritten, writeReport } from '../../core/execute-rule.js'
import { suppressionNotice } from '@nielspeter/eess'
import { edgeCoverageNotice, resetEdgeCoverage, untestedRules } from '@nielspeter/eess'
import { commentSuppressionNotice, resetCommentSuppression } from '@nielspeter/eess'
import { writeStderr } from '@nielspeter/eess'
import { loadRuleFiles } from '../load-rules.js'
import { dedupeConfigFindings } from '@nielspeter/eess'
import {
  attributeToRuleFile,
  baselineNotApplied,
  failureOrViolations,
  ruleFileContributedNoRules,
  ruleFileTruncated,
} from '../rule-file-findings.js'

interface CheckArgs {
  ruleFiles: string[]
  baseline?: string
  changed: boolean
  base: string
  format: OutputFormat | 'auto'
  /** Use cache-busting imports for watch mode re-runs. */
  fresh?: boolean
  /** Apply deterministic fixes instead of only reporting (plan 0066). */
  fix?: boolean
  /** With `fix`, write to disk; otherwise dry-run (preview). */
  apply?: boolean
}

/**
 * Run architecture rules from the specified rule files.
 *
 * Unified pipeline (plan 0060): collect `.violations()` across every builder
 * (each stamped with its severity), apply baseline/diff, report ONCE, and set
 * the exit code from the error-severity count. Warns are reported but do not
 * fail. A rule file that throws `ArchRuleError` on import (a bare self-executing
 * preset call) is handled by a best-effort catch — error-severity only.
 */
export async function runCheck(args: CheckArgs): Promise<number> {
  // Per run: the tally is module state (the `diff-disclosure` pattern), and a
  // second `runCheck` in one process — the CLI's watch loop, or a test — must
  // not inherit the first run's rules.
  resetEdgeCoverage()
  resetCommentSuppression()
  const started = Date.now()
  const format: OutputFormat = args.format === 'auto' ? detectFormat() : args.format

  // `--fix` short-circuits the reporting pipeline: it renders what it changed
  // (or would change) instead of the findings, and its exit code is the count
  // of violations that have NO automatic fix — the real remaining failures.
  // eess's own capability (plan 0066); upstream has no equivalent and plan
  // 0165's engine copy dropped it. Restored in Phase 3.
  if (args.fix === true) {
    const builders = await loadRuleFiles(args.ruleFiles, { fresh: args.fresh })
    return runFix(builders, { format }, args.apply === true)
  }
  // This command reports once, at the end, across every rule file. So a
  // self-executing rule file's own terminals must not also write the findings that
  // travel on their thrown error — see `withCallerAggregating`.
  //
  // A SCOPED extent, not a latch. It used to be a bare
  // a bare flag-set that nothing ever reset, which was harmless
  // while `executeCheck` was the only reader and stopped being harmless the moment
  // presets and `checkAll()` read it too: a preset called directly after a
  // `runCheck` in the same process went silent for the rest of that process.
  return withCallerAggregating(async () => runCheckInner(args, format, started))
}

async function runCheckInner(
  args: CheckArgs,
  format: OutputFormat,
  started: number,
): Promise<number> {
  const baseline = args.baseline !== undefined ? withBaseline(args.baseline) : undefined
  const diff = args.changed ? diffAware(args.base) : undefined
  let collected: ArchViolation[] = []
  const total = args.ruleFiles.length
  // The denominator for the summary line below. Accumulated here rather than
  // derived from `collected`, which counts violations and cannot distinguish
  // "20 rules, none failing" from "no rules loaded" — the whole point of the line.
  let ruleCount = 0
  let failedRules = 0
  for (const file of args.ruleFiles) {
    // TWO catches, at the two boundaries that can fail independently. Loading is
    // per file and can only be attributed to the file; evaluating is per builder,
    // so a single malformed rule must not take its twenty siblings in the same
    // file down with it — which one catch around the whole file would do
    // (bug 0025).
    let builders
    // Read before the module evaluates, so the delta below describes THIS file.
    const writtenBefore = violationsWritten()
    try {
      builders = await loadRuleFiles([file], { fresh: args.fresh })
    } catch (error: unknown) {
      // A user rule file that self-executes a throwing `.check()` at import
      // surfaces its violations rather than crashing. (Presets no longer throw
      // at import — they return builders.)
      collected.push(...failureOrViolations(file, error, total))
      // …and, for a thrown TERMINAL, say that the file stopped there — the part R3a
      // specified and did not build (bug 0029). A throw during import aborts the
      // module, so any rule declared after it never ran and its violations are not
      // in this report, while the run is red for the thrown finding so nothing else
      // reveals the gap.
      //
      // **Only for an `ArchRuleError`**, which is the signal that a terminal fired:
      // rules before it DID run and report, rules after did not. For any other error
      // — a syntax error, a missing dependency — nothing ran at all, and
      // `ruleFileFailure` already says the file could not be evaluated. Adding
      // "the rules after this never ran" there would imply some had, and point at a
      // "finding above" that is an error rather than a finding. Three of bug 0025's
      // own tests caught exactly that when this fired unconditionally.
      //
      // Only at THIS boundary either way. A throw from `builder.violations()` below
      // happens after the module finished, so nothing was truncated, and the
      // `export default [rule1, rule2]` shape never reaches here at all — an array
      // export builds every rule before any of them runs.
      if (isArchRuleError(error)) {
        collected.push(ruleFileTruncated(file, total))
        // Bug 0199 — the same boundary, the other consequence.
        //
        // `failureOrViolations` above DID collect this error's violations and
        // `baseline.filterNew` below DOES filter them. What escaped is the rule
        // file's OWN printing: `executeCheck` calls `writeReport` unconditionally
        // one line before it throws (`core/execute-rule.ts`), so a `.check()`
        // at module scope prints its findings before the CLI can filter anything.
        // the aggregation flag does not stop it — that flag is read only by
        // `executeWarn` (`:526`). Root cause is bug 0201.
        //
        // **Only when something was actually printed.** `executeWarn` throws the
        // same error type, and when the CLI is aggregating it writes only the
        // non-`bypassFilters` entries — for a configuration finding that is
        // nothing at all. Firing on the bare `isArchRuleError` condition claimed a
        // leak that did not happen, over a finding whose own text says a baseline
        // can never suppress it: ADR-009 rule 2, a failure asserting a cause it
        // cannot verify. Measured by review; `it('does not fire when the throw
        // carried nothing the rule file could print')` holds it.
        //
        // **Only when output actually leaked**, measured rather than inferred.
        //
        // More than two paths reach this catch and they do not agree on whether
        // they printed: a `.check()` (silent since bug 0201), a preset via the
        // kernel's `reportViolations`, `checkAll()`, and a `.warn()` with a live
        // selector. So the notice asks the only question it may assert — *did
        // anything emit while this module was loading?* — by reading a delta over
        // both emitters.
        //
        // **The first version inverted this and it was a measured defect.** It
        // counted the writes `executeCheck` SUPPRESSED and read the absence of a
        // suppression as "nothing leaked". A file that suppresses one terminal
        // while leaking through another satisfies that and leaks: measured, a
        // `report: 'warn'` preset beside a silenced `.check()` leaked 7 violation
        // blocks in total silence. A silence built on a stale signal is worse than
        // the false claim it replaced, because the run says nothing at all.
        const leaked = violationsWritten() > writtenBefore
        const printedUnfiltered = error.violations.some((v) => v.bypassFilters !== true)
        const filtering = args.baseline !== undefined || args.changed
        if (filtering && printedUnfiltered && leaked) {
          collected.push(
            baselineNotApplied(file, { baseline: args.baseline, changed: args.changed }),
          )
        }
      }
      failedRules++
      continue
    }
    // A file that loaded cleanly and produced nothing is the alarm value the
    // summary line exists to print — and `check` used to print `✓ … 0 rules` over
    // it while `doctor` refused the same file. See `ruleFileContributedNoRules`.
    if (builders.length === 0) {
      collected.push(ruleFileContributedNoRules(file))
      failedRules++
    }
    ruleCount += builders.length
    for (const builder of builders) {
      try {
        // Attributed here, where the rule file is known. A builder cannot do it
        // — the same builder is legal in a test file, where vitest supplies the
        // frame instead (bug 0026).
        const found = attributeToRuleFile(builder.violations(), file)
        if (found.length > 0) failedRules++
        collected.push(...found)
      } catch (error: unknown) {
        failedRules++
        collected.push(...failureOrViolations(file, error, total))
      }
    }
  }

  // One option, one finding (plan 0074) — after the per-file loop, because the
  // key includes the rule file: two files with the same bad preset option are
  // two edits and must both be reported.
  collected = dedupeConfigFindings(collected)

  let filtered = collected
  if (baseline) filtered = baseline.filterNew(filtered)

  // The one surface that can count. `filterToChanged` runs once here over every
  // collected violation, so `before - after` is the whole run's suppression —
  // unlike the per-rule terminals, which see one rule each (plan 0071,
  // `core/diff-disclosure.ts`). Derived by subtraction rather than asked of the
  // filter, so it holds for a caller-supplied `DiffFilterLike` too.
  let notice: string | undefined
  if (diff) {
    const before = filtered.length
    filtered = diff.filterToChanged(filtered)
    notice = suppressionNotice(before - filtered.length, diff.size, diff.baseBranch)
    if (notice !== undefined) writeStderr(notice)
  }

  // writeReport handles empties: json always emits one document (so a clean run
  // is still parseable), terminal/github emit nothing. The notice rides along as
  // `summary.reason` so a `--format json` consumer reading only stdout still
  // learns the report is partial — stderr and stdout are different streams, and
  // an agent piping one of them would otherwise see `total: 0` and stop.
  // `reason` is rendered as each violation's "Why:" line on the terminal path
  // (`format.ts`: `v.because ?? reason`), so a RUN-level notice must not travel
  // that way — it would appear as the justification for an unrelated finding.
  // `summary.reason` in JSON is genuinely run-level, so it goes there, and
  // stderr carries it for every other format. Found by sabotage: removing the
  // `writeStderr` call left the tests green because the notice was reaching
  // stderr through the "Why:" line instead.
  writeReport(filtered, format, format === 'json' ? notice : undefined, untestedRules())

  // Bug 0015, and it goes AFTER the report so it reads as a footnote rather than
  // as part of the findings. JSON carries the same information structurally in
  // `summary.untestedAllowlists`, so emitting the prose there too would duplicate
  // it into a document a consumer parses.
  if (format !== 'json') {
    const coverage = edgeCoverageNotice()
    if (coverage !== undefined) writeStderr(`${coverage}\n`)
  }

  // Inline exclusion comments, same footnote position and the same reason. Kept
  // out of the JSON prose for the same reason coverage is: a consumer parsing
  // that document gets the identities structurally, not as a sentence to grep.
  if (format !== 'json') {
    const suppressed = commentSuppressionNotice()
    if (suppressed !== undefined) writeStderr(`${suppressed}\n`)
  }

  // Report the denominator so a fast green is provably non-vacuous, not silence.
  // Terminal only — JSON/GitHub-annotation output on stdout stays machine-clean.
  //
  // Present on `main` and dropped by plan 0165's engine copy (`9489684`), which
  // overwrote this file wholesale. Restored here rather than treated as the
  // never-had-it gap bug 0174 filed it as: published `eess-ts@0.2.1` ships it,
  // so its absence was a regression, and a green run that prints nothing cannot
  // be told apart from a run that loaded no rules — the ADR-009/010 failure this
  // package exists to prevent, arriving through its own CLI.
  if (format === 'terminal') {
    const ms = Date.now() - started
    const time = ms < 1000 ? `${String(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
    const scope = `${String(ruleCount)} rule${ruleCount === 1 ? '' : 's'} across ${String(total)} file${total === 1 ? '' : 's'}`
    // **The symbol is computed from exactly what the exit code is computed from**
    // — the error-severity count after filtering. Two ways this line lied before,
    // both measured on the documented on-ramp:
    //
    //  - keyed on the RAW failure tally, a baseline that suppressed everything
    //    printed `✗ … · 0 violations` beside `exit 0`;
    //  - keyed on `filtered.length`, a warn-only run printed `✗` beside `exit 0`,
    //    because warnings are advisory and never fail (which the scaffold's own
    //    output tells the adopter).
    //
    // The symbol, the count and the exit code are three renderings of one fact.
    // Warnings are disclosed alongside rather than folded in or dropped — a run
    // with warnings is not failing, and is not the same as a silent one.
    //
    // `failedRules` is still counted because it answers a different question —
    // how many RULES failed, versus how many violations there were — and a run
    // where one rule produced forty is worth telling apart from forty rules
    // producing one each.
    const errors = filtered.filter((v) => (v.severity ?? 'error') === 'error').length
    const warns = filtered.length - errors
    const warnNote = warns === 0 ? '' : ` · ${String(warns)} warning${warns === 1 ? '' : 's'}`
    writeStderr(
      errors === 0
        ? `\n✓ eess-ts — ${scope} · 0 failing${warnNote} (${time})\n`
        : `\n✗ eess-ts — ${scope} · ${String(failedRules)} of ${String(ruleCount)} rule${ruleCount === 1 ? '' : 's'} failing · ${String(errors)} violation${errors === 1 ? '' : 's'}${warnNote} (${time})\n`,
    )
  }

  // Exit code = error-severity count; warns are reported but never fail.
  return filtered.filter((v) => (v.severity ?? 'error') === 'error').length
}

/**
 * Apply deterministic fixes (plan 0066). Dry-run unless `write`. Returns the
 * count of violations that have no automatic fix.
 *
 * The remaining-count IS the exit code, deliberately: a run that fixed
 * everything it could and still leaves real findings must not exit 0 just
 * because it did some work. `applyFixes` skips overlapping edits rather than
 * guessing, and says how many it skipped — a silently-dropped edit would leave
 * the file half-repaired with a green run to match.
 */
function runFix(builders: RuleBuilderLike[], options: CheckOptions, write: boolean): number {
  const all = builders.flatMap((b) => b.violations())
  const fixable = all.filter((v) => v.fix !== undefined)
  const result = applyFixes(fixable, { write })

  const header = write
    ? 'eess-ts --fix (applied)'
    : 'eess-ts --fix (dry run — pass --apply to write)'
  process.stdout.write(`${header}\n`)
  for (const d of result.descriptions)
    process.stdout.write(`  ${write ? 'fixed' : 'would fix'}: ${d}\n`)
  if (result.skipped > 0) {
    process.stdout.write(`  ${result.skipped} fix(es) skipped (overlapping — resolve manually)\n`)
  }
  const verb = write ? 'applied' : 'would apply'
  process.stdout.write(`${result.applied} fix(es) ${verb} across ${result.files.length} file(s)\n`)

  const remaining = all.filter((v) => v.fix === undefined)
  if (remaining.length > 0) {
    process.stdout.write(`${remaining.length} violation(s) with no automatic fix remain:\n`)
    for (const v of remaining)
      process.stdout.write(`  ${v.file}:${v.line}  ${v.message.split('\n')[0]}\n`)
  }
  return remaining.length
}
