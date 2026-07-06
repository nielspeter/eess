import { detectFormat } from '@nielspeter/eess'
import type { CheckOptions, OutputFormat } from '@nielspeter/eess'
import { loadRuleFiles, type LoadOptions, type RuleBuilderLike } from '../load-rules.js'

export interface CheckArgs {
  ruleFiles: string[]
  format: OutputFormat | 'auto'
  fresh?: boolean
}

function isArchRuleError(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  // Duck-type: ArchRuleError class identity is unreliable across jiti boundaries
  // because the rule file may load its own copy of the kernel. Match by name.
  return 'name' in value && typeof value.name === 'string' && value.name === 'ArchRuleError'
}

export async function runCheck(args: CheckArgs): Promise<number> {
  const format: OutputFormat = args.format === 'auto' ? detectFormat() : args.format
  const options: CheckOptions = { format }

  const loadOptions: LoadOptions = { fresh: args.fresh }
  const builders: RuleBuilderLike[] = await loadRuleFiles(args.ruleFiles, loadOptions)

  let failures = 0
  for (const builder of builders) {
    try {
      builder.check(options)
    } catch (error: unknown) {
      if (isArchRuleError(error)) {
        failures++
      } else {
        throw error
      }
    }
  }

  return failures
}
