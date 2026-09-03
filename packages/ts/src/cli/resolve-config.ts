import path from 'node:path'
import { findConfigFile, extractSharedConfig, isRecord } from '@nielspeter/eess/internal'
import { importRuleModule } from './import-rule-module.js'
import type { CliConfig } from './config.js'

/**
 * Resolve CLI configuration from an explicit path or by searching for one.
 *
 * Config resolution order:
 * 1. CLI flags (highest priority) — handled by caller
 * 2. eess-ts.config.ts in project root
 * 3. Defaults (project: 'tsconfig.json', format: 'auto')
 *
 * Finding the file and validating the shared fields are the kernel's — they were
 * duplicated with `eess-mermaid` (`findConfigFile` scored 100%). What stays here
 * is this dialect's own filenames, its own two extra fields, and its loader.
 */
const CONFIG_FILENAMES = ['eess-ts.config.ts', 'eess-ts.config.js']

export async function resolveConfig(explicitPath?: string): Promise<CliConfig> {
  const configPath = explicitPath ?? findConfigFile(CONFIG_FILENAMES)
  if (configPath === undefined) return {}

  // Native `import()` first, jiti only if Node refuses the file's module format
  // — see `import-rule-module.ts`. A config in a `"type": "commonjs"` project is
  // bug 0074; a config in an ESM project must share the CLI's module registry.
  const mod: unknown = await importRuleModule(path.resolve(configPath), false)
  return { ...extractSharedConfig(mod), ...tsOnlyFields(mod) }
}

/** `project` and `baseline` — the two fields no other dialect has. */
function tsOnlyFields(mod: unknown): Pick<CliConfig, 'project' | 'baseline'> {
  if (!isRecord(mod) || !('default' in mod)) return {}
  const defaultExport = mod.default
  if (!isRecord(defaultExport)) return {}
  const out: Pick<CliConfig, 'project' | 'baseline'> = {}
  if (typeof defaultExport['project'] === 'string') out.project = defaultExport['project']
  if (typeof defaultExport['baseline'] === 'string') out.baseline = defaultExport['baseline']
  return out
}
