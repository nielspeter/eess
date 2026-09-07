import { isDescribable } from '@nielspeter/eess/internal'
import { loadRuleFiles } from '../load-rules.js'

export interface ExplainArgs {
  ruleFiles: string[]
  markdown?: boolean
}

interface RuleDescriptionLike {
  rule?: string
  id?: string
  because?: string
  suggestion?: string
  docs?: string
}

function isRuleDescription(value: unknown): value is RuleDescriptionLike {
  return value !== null && typeof value === 'object'
}

export async function runExplain(args: ExplainArgs): Promise<void> {
  const builders = await loadRuleFiles(args.ruleFiles)
  const rules: RuleDescriptionLike[] = []
  for (const builder of builders) {
    // `isDescribable` from the kernel, not a `describeRule` member on the
    // dialect's own builder type — bug 0269's review. The local
    // `RuleBuilderLike` copy carried `describeRule?` solely for this loop, and
    // keeping the copy is what made ADR-014's Tier-1 mechanism untrue of this
    // dialect. `eess-ts`'s `explain` already reads it this way.
    if (!isDescribable(builder)) continue
    const desc = builder.describeRule()
    if (isRuleDescription(desc)) rules.push(desc)
  }

  if (args.markdown === true) {
    process.stdout.write(formatMarkdown(rules))
  } else {
    process.stdout.write(JSON.stringify({ rules }, null, 2) + '\n')
  }
}

function formatMarkdown(rules: RuleDescriptionLike[]): string {
  const header = '| ID | Rule | Because | Suggestion |\n|---|---|---|---|\n'
  const rows = rules
    .map((r) => `| ${r.id ?? ''} | ${r.rule ?? ''} | ${r.because ?? ''} | ${r.suggestion ?? ''} |`)
    .join('\n')
  return header + rows + '\n'
}
