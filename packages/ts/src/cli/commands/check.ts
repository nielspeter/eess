import { detectFormat, applyFixes } from '@nielspeter/eess'
import { withBaseline } from '@nielspeter/eess'
import { diffAware } from '@nielspeter/eess'
import type { CheckOptions, OutputFormat, ArchViolation } from '@nielspeter/eess'
import { ArchRuleError, reportViolations, formatViolationsJson } from '@nielspeter/eess'
import { resetEdgeCoverage, edgeCoverageNotice, writeStderr } from '@nielspeter/eess'
import { suppressionNotice } from '@nielspeter/eess'
import { resetCommentSuppression, commentSuppressionNotice } from '@nielspeter/eess'
import { dedupeConfigFindings } from '@nielspeter/eess'
import { loadRuleFiles, type RuleBuilderLike } from '../load-rules.js'
import {
  attributeToRuleFile,
  failureOrViolations,
  ruleFileTruncated,
} from '../rule-file-findings.js'

// eess-exclude eess/no-unused-exports: parameter type of the exported runCheck API (must stay exported for declaration emit)
export interface CheckArgs {
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
 * Unified pipeline: collect every builder's `.violations()` across every rule
 * file, apply baseline/diff ONCE over the combined list, report ONCE, and
 * return the post-filter violation count as the exit code.
 *
 * Calling each builder's own `.check()` individually — the previous shape —
 * reports (and for `--format json`, writes a complete document) per builder,
 * so N failing rules concatenate N separate `{summary, violations}` documents
 * on stdout: not valid JSON as a whole, and exactly what `explain --format
 * agent`'s own generated instructions tell an agent to `JSON.parse()`.
 * Measured directly: two failing rules produced two complete JSON documents
 * back to back, and `JSON.parse()` on the combined output threw.
 */
export async function runCheck(args: CheckArgs): Promise<number> {
  // Per run: the tally is module state, and a second `runCheck` in one
  // process — the CLI's watch loop, or a test — must not inherit the first
  // run's rules.
  resetEdgeCoverage()
  resetCommentSuppression()
  const started = Date.now()
  const format: OutputFormat = args.format === 'auto' ? detectFormat() : args.format

  if (args.fix === true) {
    const builders = await loadRuleFiles(args.ruleFiles, { fresh: args.fresh })
    return runFix(builders, { format }, args.apply === true)
  }

  // Per rule file, not bulk-loaded: two independent failure boundaries. A rule
  // FILE that cannot even be loaded (a syntax error, or a self-executing rule
  // file whose first terminal throws at module scope) must not take every
  // other rule file down with it. Per-BUILDER too: one malformed rule must
  // not take its siblings in the same file down with it either.
  const collected: ArchViolation[] = []
  const total = args.ruleFiles.length
  let ruleCount = 0
  let failedRules = 0
  for (const file of args.ruleFiles) {
    let builders: RuleBuilderLike[]
    try {
      builders = await loadRuleFiles([file], { fresh: args.fresh })
    } catch (error: unknown) {
      // A user rule file that self-executes a throwing `.check()` at import
      // surfaces its violations rather than crashing.
      collected.push(...failureOrViolations(file, error, total))
      // For a thrown TERMINAL specifically, say that the file stopped there:
      // rules before it DID run and report, rules after did not. For any
      // other error nothing ran at all, and `ruleFileFailure` (inside
      // `failureOrViolations`) already says the file could not be evaluated.
      if (error instanceof ArchRuleError) collected.push(ruleFileTruncated(file, total))
      failedRules++
      continue
    }
    ruleCount += builders.length
    for (const builder of builders) {
      try {
        // Attributed here, where the rule file is known — a builder cannot do
        // it, since the same builder is legal in a test file, where vitest
        // supplies the frame instead.
        const violations = attributeToRuleFile(collectViolations(builder, {}), file)
        if (violations.length > 0) failedRules++
        collected.push(...violations)
      } catch (error: unknown) {
        failedRules++
        collected.push(...failureOrViolations(file, error, total))
      }
    }
  }

  let filtered = collected
  if (args.baseline !== undefined) {
    filtered = withBaseline(args.baseline).filterNew(filtered)
  }
  if (args.changed) {
    const before = filtered.length
    const diffFilter = diffAware(args.base)
    filtered = diffFilter.filterToChanged(filtered)
    const notice = suppressionNotice(before - filtered.length, diffFilter.size, args.base)
    if (notice !== undefined) writeStderr(`${notice}\n`)
  }

  // A preset that fans out combinatorially can produce many identical-shaped
  // bypassFilters findings from one misconfiguration — collapse those to one
  // finding-with-a-count before anything downstream (reporting, the exit
  // count, the terminal summary) counts them as separate edits.
  filtered = dedupeConfigFindings(filtered)

  // A `--format json` consumer always gets a parseable document — a clean run
  // included, so an agent piping stdout doesn't see nothing and stop.
  // `reportViolations` itself emits nothing for an empty set (correct for its
  // many other callers, where "no violations" means "print nothing"); only
  // this CLI path promises a document every time.
  if (filtered.length > 0) {
    reportViolations(filtered, { format })
  } else if (format === 'json') {
    process.stdout.write(formatViolationsJson(filtered) + '\n')
  }

  // A footnote, not a finding: an allowlist condition (`onlyImportFrom`,
  // `onlyHaveTypeImportsFrom`) that tested zero edges passed vacuously — for
  // the `only*` family zero edges is maximal compliance, not absent
  // evidence, so this discloses rather than fails. Always to stderr,
  // regardless of format — a `--format json` consumer's document stays
  // machine-clean, and the disclosure is still visible to a human running
  // the same command.
  const coverage = edgeCoverageNotice()
  if (coverage !== undefined) writeStderr(`${coverage}\n`)

  // Same disclosure discipline as edge-coverage above: the inline
  // `// eess-exclude` filter is the widest, and only silent, filter in the
  // pipeline — a run with every finding suppressed by comment reads as
  // clean unless this says otherwise.
  const commentNotice = commentSuppressionNotice()
  if (commentNotice !== undefined) writeStderr(`${commentNotice}\n`)

  // Report the denominator so a fast green is provably non-vacuous, not silence.
  // Terminal only — JSON/GitHub-annotation output on stdout stays machine-clean.
  if (format === 'terminal') {
    const ms = Date.now() - started
    const time = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
    const scope = `${ruleCount} rule${ruleCount === 1 ? '' : 's'} across ${total} file${total === 1 ? '' : 's'}`
    process.stderr.write(
      failedRules === 0
        ? `\n✓ eess-ts — ${scope} · 0 failing (${time})\n`
        : `\n✗ eess-ts — ${scope} · ${filtered.length} violation${filtered.length === 1 ? '' : 's'} (${time})\n`,
    )
  }

  return filtered.length
}

/** Collect a builder's violations without printing (prefers `.violations()`). */
function collectViolations(builder: RuleBuilderLike, options: CheckOptions): ArchViolation[] {
  if (typeof builder.violations === 'function') return builder.violations()
  try {
    builder.check(options)
    return []
  } catch (error: unknown) {
    if (error instanceof ArchRuleError) return error.violations
    throw error
  }
}

/**
 * Apply deterministic fixes (plan 0066). Dry-run unless `write`. Returns the
 * count of violations that have no automatic fix (the real remaining failures).
 */
function runFix(builders: RuleBuilderLike[], options: CheckOptions, write: boolean): number {
  const all = builders.flatMap((b) => collectViolations(b, options))
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
