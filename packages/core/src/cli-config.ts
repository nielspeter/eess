import path from 'node:path'
import fs from 'node:fs'
import type { OutputFormat } from './check-options.js'
import { isRecord } from './type-guards.js'

/**
 * The parts of dialect CLI config handling that are the same everywhere.
 *
 * **Split along the kernel's existing seam, not behind a new injection point.**
 * `PathUniverse` sets the pattern: the kernel takes materialized data and the
 * dialect does the I/O. Here the pure halves are finding the config file and
 * validating what a loaded module claims — both were byte-identical between
 * `eess-ts` and `eess-mermaid` (`findConfigFile` scored 100%). The impure half,
 * actually importing the file, stays in each dialect because it needs `jiti`,
 * which the kernel cannot depend on.
 *
 * That leaves one genuinely shared subtlety in the impure half —
 * {@link isModuleFormatRefusal} — so it lives here too. It is pure, and it is
 * the part that is easy to get dangerously wrong.
 */

/** Config fields every dialect CLI understands. A dialect may add its own. */
export interface SharedCliConfig {
  rules?: string[]
  format?: OutputFormat | 'auto'
  watchDirs?: string[]
}

const FORMATS = new Set(['terminal', 'json', 'github', 'auto'])

/** The first of `filenames` that exists in the working directory. */
export function findConfigFile(filenames: readonly string[]): string | undefined {
  const cwd = process.cwd()
  for (const name of filenames) {
    const candidate = path.join(cwd, name)
    if (fs.existsSync(candidate)) return candidate
  }
  return undefined
}

/** Strings from an unknown array, dropping anything that is not one. */
function stringsOf(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined
}

/**
 * The shared config a loaded module claims, validated.
 *
 * Everything is checked rather than trusted: a config file is arbitrary user
 * code and its default export can be any shape at all. An unrecognised `format`
 * is dropped rather than passed through, so a typo falls back to the default
 * instead of reaching a formatter that has no case for it.
 */
export function extractSharedConfig(mod: unknown): SharedCliConfig {
  if (!isRecord(mod) || !('default' in mod)) return {}
  const defaultExport = mod.default
  if (!isRecord(defaultExport)) return {}

  const config: SharedCliConfig = {}
  const format = defaultExport['format']
  if (typeof format === 'string' && FORMATS.has(format)) {
    // Narrowed by the set above; the cast-free form is this re-check.
    config.format =
      format === 'terminal' || format === 'json' || format === 'github' ? format : 'auto'
  }
  const rules = stringsOf(defaultExport['rules'])
  if (rules) config.rules = rules
  const watchDirs = stringsOf(defaultExport['watchDirs'])
  if (watchDirs) config.watchDirs = watchDirs
  return config
}

/**
 * Did Node refuse this file for its MODULE FORMAT, rather than for anything the
 * file does?
 *
 * Narrow on purpose. A broad `catch` that fell back to a transpiling loader on
 * any error would re-execute a rule file that had already run — doubling its
 * output — and would hide a genuine syntax error behind a second,
 * differently-worded failure.
 *
 * The condition it detects is bug 0074: the CONSUMER project is
 * `"type": "commonjs"` (what `npm init -y` writes) and the config or rule file
 * uses ESM syntax.
 */
export function isModuleFormatRefusal(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false
  return (
    error.message.includes('Cannot use import statement outside a module') ||
    error.message.includes("Unexpected token 'export'")
  )
}

/**
 * Refuse a run that named no rule files, saying where to name them.
 *
 * Sets `process.exitCode` rather than throwing: the caller is a CLI entry point
 * that still wants to return normally. Returns whether the run may proceed.
 *
 * `configName` is the dialect's own config filename, because "set them in
 * config" is not an instruction — the two copies of this differed in exactly
 * that word, one naming the file and one not.
 */
export function requireRuleFiles(ruleFiles: readonly string[], configName: string): boolean {
  if (ruleFiles.length > 0) return true
  console.error(
    `Error: No rule files specified. Pass rule files as arguments or set them in ${configName}.`,
  )
  process.exitCode = 1
  return false
}
