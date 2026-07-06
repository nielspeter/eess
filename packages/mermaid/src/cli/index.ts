import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { OutputFormat } from '@nielspeter/eess'
import { resolveConfig } from './resolve-config.js'
import { runCheck, type CheckArgs } from './commands/check.js'
import { runExplain, type ExplainArgs } from './commands/explain.js'
import { watchAndRerun, type WatchOptions } from './watch.js'

function getVersion(): string {
  const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json')
  const pkg: unknown = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (
    pkg !== null &&
    typeof pkg === 'object' &&
    'version' in pkg &&
    typeof pkg.version === 'string'
  ) {
    return pkg.version
  }
  return '0.0.0'
}

const HELP_TEXT = `
eess-mermaid — Architecture testing for Mermaid diagrams (the Mermaid dialect of eess)

Usage:
  eess-mermaid check [files...]      Run architecture rules
  eess-mermaid explain [files...]    Dump all active rules as JSON

Options:
  --format <format>     Output format: terminal, json, github, auto (default: auto)
  --markdown            Output explain results as markdown table
  -w, --watch           Watch for changes and re-run (check command only)
  --config <path>       Path to config file
  -v, --version         Show version number
  -h, --help            Show this help message
`

interface ParsedArgs {
  values: {
    format?: string
    config?: string
    help?: boolean
    version?: boolean
    watch?: boolean
    markdown?: boolean
  }
  positionals: string[]
}

function parseCliArgs(args: string[]): ParsedArgs {
  return parseArgs({
    args,
    options: {
      markdown: { type: 'boolean', default: false },
      format: { type: 'string' },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
      watch: { type: 'boolean', short: 'w', default: false },
    },
    allowPositionals: true,
    strict: true,
  })
}

function requireRuleFiles(ruleFiles: string[]): boolean {
  if (ruleFiles.length > 0) return true
  console.error(
    'Error: No rule files specified. Pass rule files as arguments or set them in eess-mermaid.config.ts.',
  )
  process.exitCode = 1
  return false
}

async function handleCheck(
  ruleFiles: string[],
  values: ParsedArgs['values'],
  config: Awaited<ReturnType<typeof resolveConfig>>,
  format: OutputFormat | 'auto',
): Promise<void> {
  if (!requireRuleFiles(ruleFiles)) return

  if (values.watch === true) {
    const watchDirs = config.watchDirs ?? ['src']
    const checkArgs: CheckArgs = { ruleFiles, format, fresh: true }

    process.stdout.write('eess-mermaid — watching for changes\n\n')
    await runCheck(checkArgs).catch(() => undefined)
    process.stdout.write('\nWatching for changes...\n')

    const watchOptions: WatchOptions = {
      watchDirs,
      watchFiles: ruleFiles,
      onChangeDetected: async () => {
        await runCheck(checkArgs)
      },
    }
    watchAndRerun(watchOptions)
  } else {
    const failures = await runCheck({ ruleFiles, format })
    if (failures > 0) {
      process.exitCode = 1
    }
  }
}

async function handleExplain(ruleFiles: string[], markdown: boolean | undefined): Promise<void> {
  if (!requireRuleFiles(ruleFiles)) return
  const explainArgs: ExplainArgs = { ruleFiles, markdown }
  await runExplain(explainArgs)
}

export async function run(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args)
  const { values, positionals } = parsed

  if (values.version === true) {
    process.stdout.write(getVersion() + '\n')
    return
  }

  if (values.help === true) {
    process.stdout.write(HELP_TEXT + '\n')
    return
  }

  const command = positionals[0]

  if (command === undefined) {
    console.error('Error: No command specified. Use --help for usage.')
    process.exitCode = 1
    return
  }

  if (values.watch === true && command !== 'check') {
    console.error('Error: --watch is only supported with the check command.')
    process.exitCode = 1
    return
  }

  const config = await resolveConfig(values.config)
  const ruleFiles = positionals.slice(1).length > 0 ? positionals.slice(1) : (config.rules ?? [])
  const rawFormat = values.format ?? config.format ?? 'auto'
  const format: OutputFormat | 'auto' =
    rawFormat === 'terminal' ||
    rawFormat === 'json' ||
    rawFormat === 'github' ||
    rawFormat === 'auto'
      ? rawFormat
      : 'auto'

  if (command === 'check') {
    await handleCheck(ruleFiles, values, config, format)
  } else if (command === 'explain') {
    await handleExplain(ruleFiles, values.markdown)
  } else {
    console.error(`Error: Unknown command "${command}". Use --help for usage.`)
    process.exitCode = 1
  }
}
