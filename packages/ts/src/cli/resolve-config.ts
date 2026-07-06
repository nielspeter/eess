import path from 'node:path'
import fs from 'node:fs'
import type { CliConfig } from './config.js'

// Config file names, in resolution order. First match wins.
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

  const mod: unknown = await import(path.resolve(configPath))
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
  const defaultExport: unknown = mod['default']
  if (defaultExport === null || defaultExport === undefined || typeof defaultExport !== 'object') {
    return {}
  }
  // Runtime validate: only pick known CliConfig fields ('in' narrows each read)
  const config: CliConfig = {}
  if ('project' in defaultExport && typeof defaultExport.project === 'string')
    config.project = defaultExport.project
  if ('baseline' in defaultExport && typeof defaultExport.baseline === 'string')
    config.baseline = defaultExport.baseline
  if ('format' in defaultExport) {
    const format = defaultExport.format
    if (format === 'terminal' || format === 'json' || format === 'github' || format === 'auto') {
      config.format = format
    }
  }
  if ('rules' in defaultExport && Array.isArray(defaultExport.rules))
    config.rules = defaultExport.rules.filter((r): r is string => typeof r === 'string')
  return config
}
