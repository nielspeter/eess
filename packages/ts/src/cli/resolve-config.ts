import path from 'node:path'
import { importRuleModule } from './import-rule-module.js'
import { isRecord } from '../core/type-guards.js'
import fs from 'node:fs'
import type { CliConfig } from './config.js'

const CONFIG_FILENAMES = ['eess-ts.config.ts', 'eess-ts.config.js']

/**
 * Resolve CLI configuration from an explicit path or by searching for a config file.
 *
 * Config resolution order:
 * 1. CLI flags (highest priority) — handled by caller
 * 2. eess-ts.config.ts in project root
 * 3. Defaults (project: 'tsconfig.json', format: 'auto')
 */
export async function resolveConfig(explicitPath?: string): Promise<CliConfig> {
  const configPath = explicitPath ?? findConfigFile()

  if (configPath === undefined) return {}

  // Native `import()` first, jiti only if Node refuses the file's module format
  // — see `import-rule-module.ts`. A config in a `"type": "commonjs"` project is
  // bug 0074; a config in an ESM project must share the CLI's module registry.
  const mod: unknown = await importRuleModule(path.resolve(configPath), false)
  return extractDefault(mod)
}

function findConfigFile(): string | undefined {
  const cwd = process.cwd()
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(cwd, name)
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Extract the default export from an ESM module.
 * Supports both `export default config` and `module.exports = config`.
 */
function extractDefault(mod: unknown): CliConfig {
  if (mod === null || mod === undefined || typeof mod !== 'object') {
    return {}
  }
  // Dynamic import returns a module namespace — 'in' narrows safely
  if (!('default' in mod)) {
    return {}
  }
  const defaultExport: unknown = mod.default
  if (defaultExport === null || defaultExport === undefined || typeof defaultExport !== 'object') {
    return {}
  }
  // Runtime validate: only pick known CliConfig fields
  if (!isRecord(defaultExport)) return {}
  const obj = defaultExport
  const config: CliConfig = {}
  if (typeof obj['project'] === 'string') config.project = obj['project']
  if (typeof obj['baseline'] === 'string') config.baseline = obj['baseline']
  if (typeof obj['format'] === 'string') {
    // A guard over the literal union, so the narrowing is the check rather than
    // a cast that repeats it. `includes` on a `string[]` cannot narrow; a
    // predicate over the same list can.
    const isFormat = (v: string): v is NonNullable<CliConfig['format']> =>
      (['terminal', 'json', 'github', 'auto'] as const).some((f) => f === v)
    if (isFormat(obj['format'])) {
      config.format = obj['format']
    }
  }
  if (Array.isArray(obj['rules']))
    config.rules = obj['rules'].filter((r): r is string => typeof r === 'string')
  return config
}
