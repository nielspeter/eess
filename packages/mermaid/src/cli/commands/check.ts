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
  const started = Date.now()
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

  // Report the denominator so a fast green is provably non-vacuous, not silence.
  // Terminal only — JSON/GitHub-annotation output on stdout stays machine-clean.
  if (format === 'terminal') {
    const ms = Date.now() - started
    const time = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
    const rules = builders.length
    const files = args.ruleFiles.length
    const scope = `${rules} rule${rules === 1 ? '' : 's'} across ${files} file${files === 1 ? '' : 's'}`
    process.stderr.write(
      failures === 0
        ? `\n✓ eess-mermaid — ${scope} · 0 failing (${time})\n`
        : `\n✗ eess-mermaid — ${failures} of ${scope} failing (${time})\n`,
    )
  }

  return failures
}
