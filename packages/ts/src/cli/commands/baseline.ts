import { collectViolations } from '@nielspeter/eess'
import { generateBaseline } from '@nielspeter/eess'
import { loadRuleFiles } from '../load-rules.js'

// eess-exclude eess/no-unused-exports: parameter type of the exported runBaseline API (must stay exported for declaration emit)
export interface BaselineArgs {
  ruleFiles: string[]
  output: string
}

/**
 * Generate a baseline file from current rule violations.
 *
 * Wraps existing APIs: collectViolations + generateBaseline.
 */
export async function runBaseline(args: BaselineArgs): Promise<void> {
  const builders = await loadRuleFiles(args.ruleFiles)
  const violations = collectViolations(...builders)

  generateBaseline(violations, args.output)

  process.stdout.write(`Baseline generated: ${String(violations.length)} violations recorded\n`)
  process.stdout.write(`Written to: ${args.output}\n`)
}
