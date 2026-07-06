import path from 'node:path'
import fs from 'node:fs'
import type { CliConfig } from './config.js'

const CONFIG_FILENAMES = [
  'eess-mermaid.config.ts',
  'eess-mermaid.config.js',
  'mermaidunit.config.ts',
  'mermaidunit.config.js',
]

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function extractDefault(mod: unknown): CliConfig {
  if (!isRecord(mod)) return {}
  if (!('default' in mod)) return {}
  const defaultExport = mod.default
  if (!isRecord(defaultExport)) return {}
  const obj = defaultExport
  const config: CliConfig = {}
  const format = obj['format']
  if (format === 'terminal' || format === 'json' || format === 'github' || format === 'auto') {
    config.format = format
  }
  if (Array.isArray(obj['rules'])) {
    config.rules = obj['rules'].filter((r): r is string => typeof r === 'string')
  }
  if (Array.isArray(obj['watchDirs'])) {
    config.watchDirs = obj['watchDirs'].filter((r): r is string => typeof r === 'string')
  }
  return config
}
