import path from 'node:path'
import { findConfigFile, extractSharedConfig } from '@nielspeter/eess/internal'
import { importConfigModule } from './import-config.js'
import type { CliConfig } from './config.js'

/**
 * Resolve CLI configuration from an explicit path or by searching for one.
 *
 * Finding the file and validating the loaded module are the kernel's — they were
 * duplicated with `eess-ts` (`findConfigFile` scored 100%). What is this
 * dialect's is which filenames to look for.
 */
const CONFIG_FILENAMES = [
  'eess-mermaid.config.ts',
  'eess-mermaid.config.js',
  'mermaidunit.config.ts',
  'mermaidunit.config.js',
]

export async function resolveConfig(explicitPath?: string): Promise<CliConfig> {
  const configPath = explicitPath ?? findConfigFile(CONFIG_FILENAMES)
  if (configPath === undefined) return {}
  const mod: unknown = await importConfigModule(path.resolve(configPath))
  return extractSharedConfig(mod)
}
