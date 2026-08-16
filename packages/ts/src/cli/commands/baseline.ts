import type { ArchViolation } from '@nielspeter/eess'
import { generateBaseline, ArchRuleError } from '@nielspeter/eess'
import { loadRuleFiles, type RuleBuilderLike } from '../load-rules.js'
import {
  attributeToRuleFile,
  failureOrViolations,
  ruleFileTruncated,
} from '../rule-file-findings.js'

/**
 * Collect one builder's violations without throwing. Prefers `.violations()`
 * (no print side effect); falls back to `.check()` + catch for a minimal
 * `RuleBuilderLike` that only implements `.check()` — same fallback
 * `cli/commands/check.ts`'s `--fix` path uses, for the same reason.
 */
function collectFromBuilder(builder: RuleBuilderLike): ArchViolation[] {
  if (typeof builder.violations === 'function') return builder.violations()
  try {
    builder.check()
    return []
  } catch (error: unknown) {
    return error instanceof ArchRuleError ? error.violations : []
  }
}

// eess-exclude eess/no-unused-exports: parameter type of the exported runBaseline API (must stay exported for declaration emit)
export interface BaselineArgs {
  ruleFiles: string[]
  output: string
}

/**
 * Generate a baseline file from current rule violations.
 *
 * Per rule file, not bulk-loaded — same reasoning as `runCheck` (plan 0147):
 * a rule file that cannot even be loaded must not discard every other file's
 * already-collected violations, and a `file: ''` configuration finding
 * (ADR-010's evidence gate) needs the rule file that produced it, or a
 * baseline holding two identical vacuous-rule findings across two files is
 * indistinguishable.
 */
export async function runBaseline(args: BaselineArgs): Promise<number> {
  const violations: ArchViolation[] = []
  const total = args.ruleFiles.length
  for (const file of args.ruleFiles) {
    let builders
    try {
      builders = await loadRuleFiles([file])
    } catch (error: unknown) {
      violations.push(
        ...(error instanceof ArchRuleError
          ? [ruleFileTruncated(file, total)]
          : failureOrViolations(file, error, total)),
      )
      continue
    }
    for (const builder of builders) {
      violations.push(...attributeToRuleFile(collectFromBuilder(builder), file))
    }
  }

  generateBaseline(violations, args.output)

  // Report what was actually WRITTEN, not what was collected.
  // `generateBaseline()` itself drops `bypassFilters` config findings (ADR-010
  // — a rule whose own instrument is broken right now can never legitimately
  // become "known, pre-existing debt"), so the written count is always
  // `violations.length - refused.length`. Printing the pre-filter count would
  // tell the user they had accepted findings that CI would still fail on,
  // with no hint why.
  const refused = violations.filter((v) => v.bypassFilters === true)
  const written = violations.length - refused.length

  process.stdout.write(`Baseline generated: ${String(written)} violations recorded\n`)
  process.stdout.write(`Written to: ${args.output}\n`)

  if (refused.length > 0) {
    process.stdout.write(
      `\n${String(refused.length)} finding(s) could NOT be baselined — each reports a rule ` +
        `that currently enforces nothing, so accepting it would hide the gap. Fix these:\n`,
    )
    for (const violation of refused) {
      const where = violation.file === '' ? '' : `${violation.file}: `
      process.stdout.write(`  - ${where}${violation.rule}: ${violation.message}\n`)
    }
  }

  // Non-zero when something could not be baselined: an agent reads `exit 0`
  // as "nothing to do", and this command sits on the documented upgrade
  // path. Exiting 0 here would mean `npm run arch:baseline` reported the
  // blocker, "succeeded", got committed, and the next `arch` job failed on
  // findings the baseline was supposed to have covered. The file is still
  // written — the findings that COULD be baselined are recorded, so
  // re-running after the fix is cheap.
  return refused.length > 0 ? 1 : 0
}
