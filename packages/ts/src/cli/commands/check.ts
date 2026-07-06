import { detectFormat, applyFixes } from '@nielspeter/eess'
import { withBaseline } from '@nielspeter/eess'
import { diffAware } from '@nielspeter/eess'
import type { CheckOptions, OutputFormat, ArchViolation } from '@nielspeter/eess'
import { ArchRuleError } from '@nielspeter/eess'
import { loadRuleFiles, type RuleBuilderLike } from '../load-rules.js'

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
 * Wraps existing programmatic APIs: withBaseline, diffAware, detectFormat.
 */
export async function runCheck(args: CheckArgs): Promise<number> {
  const format: OutputFormat = args.format === 'auto' ? detectFormat() : args.format

  const options: CheckOptions = { format }

  if (args.baseline !== undefined) {
    options.baseline = withBaseline(args.baseline)
  }
  if (args.changed) {
    options.diff = diffAware(args.base)
  }

  const builders = await loadRuleFiles(args.ruleFiles, { fresh: args.fresh })

  if (args.fix === true) {
    return runFix(builders, options, args.apply === true)
  }

  let failures = 0
  for (const builder of builders) {
    try {
      builder.check(options)
    } catch (error: unknown) {
      if (error instanceof ArchRuleError) {
        failures++
      } else {
        throw error
      }
    }
  }

  return failures
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
